// Self-healing migrations — safe to call on every DB access.
// Each migration is idempotent: no-op once the schema is in target state.
import { all, get, getClient, run } from "./client";
import { ensureColumn } from "./internal";

// Self-healing: ensure the kategori table has the color columns.
export async function ensureKategoriColorColumns(): Promise<void> {
  await ensureColumn("kategori", "color_bg", "TEXT NOT NULL DEFAULT '#FEF3C7'");
  await ensureColumn("kategori", "color_text", "TEXT NOT NULL DEFAULT '#92400E'");
  await ensureColumn("kategori", "color_border", "TEXT NOT NULL DEFAULT '#FDE68A'");
}

// Self-healing: ensure pendaftar has juara_rank column for stage system.
// NULL = not a Juara; 1, 2, 3 = Juara rank within (lomba, kategori).
// Per (lomba, kategori) only one Juara 1 / 2 / 3 is allowed (enforced in app code).
export async function ensureJuaraColumn(): Promise<void> {
  await ensureColumn("pendaftar", "juara_rank", "INTEGER");
}

// Self-healing: ensure schema supports the 3-fase flow (Kualifikasi → Semi
// Final → Final). Per-lomba opt-in via `lomba.fase_enabled` (default 0 =
// legacy single-fase: just pick Juara 1/2/3 from the approved peserta).
// When enabled, the lomba progresses through:
//   1. Kualifikasi — uses existing `pendaftar.is_finalist`
//      (1 = lolos, 0 = gugur, null = pending)
//   2. Semi Final — uses new `pendaftar.is_semi_finalist`
//      (1 = lolos, 0 = gugur, null = pending / not advanced yet)
//   3. Final — reuses existing `pendaftar.juara_rank` (1/2/3 = Juara)
export async function ensureTigaFaseColumns(): Promise<void> {
  // 0 = legacy single-fase (default), 1 = 3-fase flow enabled
  await ensureColumn("lomba", "fase_enabled", "INTEGER NOT NULL DEFAULT 0");
  // Tri-state: 1 = lolos, 0 = gugur, null = belum diproses
  await ensureColumn("pendaftar", "is_semi_finalist", "INTEGER");
}

// Self-healing: ensure lomba has kualifikasi phase columns (v3 stage system).
// - finalis_count: how many finalists per kategori (default 5, range 1-50) — DEPRECATED in v4
// - phase: 'kualifikasi' | 'final' | NULL
//   NULL = lomba belum mulai kualifikasi (default for new lomba, also legacy v2 mode)
export async function ensureKualifikasiColumns(): Promise<void> {
  await ensureColumn("lomba", "finalis_count", "INTEGER NOT NULL DEFAULT 5");
  await ensureColumn("lomba", "phase", "TEXT");
}

// Self-healing: ensure kualifikasi v4 columns (finalist split from juara_rank).
// - pendaftar.is_finalist: tri-state (NULL=pending, 1=lolos, 0=gugur)
//   Replaces v3's reuse of juara_rank for kualifikasi slot. v4 keeps juara_rank
//   for Juara 1/2/3 only (final phase).
//
// Per-kategori Tutup state was originally stored in a `kualifikasi_tutup_at`
// column on `lomba_kategori`. That column has been removed from the schema
// because the libSQL HTTP client in Vercel Lambda has a per-connection schema
// cache that does NOT refresh after ALTER, causing UPDATEs on the new column
// to intermittently fail with "no such column". The state is now stored as a
// JSON object in the existing `lomba.phase` column instead — see
// `lib/db/lomba.ts` (`parseLombaKategoriTutup`, `tutupKualifikasiKategori`).
//
// Implementation: per-statement with try/catch. The libSQL HTTP client has
// a known issue where the schema cache is not refreshed after ALTER within
// the same Lambda invocation. We work around it by catching "no such column"
// errors and re-trying the migration + SELECT sequence.
let v4MigrationPromise: Promise<void> | null = null;
export function ensureKualifikasiV4Columns(): Promise<void> {
  if (!v4MigrationPromise) {
    v4MigrationPromise = (async () => {
      const client = getClient();
      // Only is_finalist now — kualifikasi_tutup_at was abandoned.
      for (const sql of [
        "ALTER TABLE pendaftar ADD COLUMN is_finalist INTEGER",
      ]) {
        try {
          await client.execute({ sql, args: [] });
        } catch (e) {
          const msg = String(e);
          if (!msg.includes("duplicate column") && !msg.includes("already exists")) {
            throw e;
          }
        }
      }
      // Verify schema is now visible. If not, clear global client and retry.
      try {
        await client.execute({ sql: "SELECT is_finalist FROM pendaftar LIMIT 0", args: [] });
      } catch {
        if ((globalThis as { __libsqlClient?: unknown }).__libsqlClient) {
          (globalThis as { __libsqlClient?: unknown }).__libsqlClient = undefined;
        }
        try {
          await getClient().execute({ sql: "ALTER TABLE pendaftar ADD COLUMN is_finalist INTEGER", args: [] });
        } catch {}
      }
    })();
  }
  return v4MigrationPromise;
}

// Self-healing: ensure lomba_kategori supports multiple PJs per (lomba, kategori).
// Old PK: (lomba_id, kategori_id) — only 1 PJ allowed per combo.
// New PK: (lomba_id, kategori_id, urutan) — multiple PJs allowed, ordered by `urutan`.
// SQLite can't DROP CONSTRAINT, so we detect old schema via PRAGMA and recreate the table.
export async function ensurePjMultiSupport(): Promise<void> {
  // Look at the auto-indexes on lomba_kategori (PK creates one).
  // If any of them includes the 'urutan' column, the new schema is already in place.
  const autoIndexes = await all<{ name: string; sql: string | null }>(
    `SELECT name, sql FROM sqlite_master
     WHERE type = 'index' AND tbl_name = 'lomba_kategori' AND name LIKE 'sqlite_autoindex_%'`
  );
  for (const idx of autoIndexes) {
    if (idx.sql && idx.sql.includes('urutan')) return; // already migrated
  }
  // Migrate: recreate table with new PK, copy data, drop old.
  // Each existing row keeps its urutan — they were already unique globally.
  // Run all statements in one `batch()` so it's atomic (Turso HTTP requires batch,
  // not multi-statement execute — that returns SQL_MANY_STATEMENTS error).
  await getClient().batch(
    [
      `CREATE TABLE IF NOT EXISTS lomba_kategori_new (
         lomba_id INTEGER NOT NULL,
         kategori_id TEXT NOT NULL,
         pj_nama TEXT NOT NULL,
         pj_kontak TEXT,
         urutan INTEGER NOT NULL DEFAULT 0,
         PRIMARY KEY (lomba_id, kategori_id, urutan),
         FOREIGN KEY (lomba_id) REFERENCES lomba(id) ON DELETE CASCADE,
         FOREIGN KEY (kategori_id) REFERENCES kategori(id) ON DELETE CASCADE
       )`,
      `INSERT OR IGNORE INTO lomba_kategori_new (lomba_id, kategori_id, pj_nama, pj_kontak, urutan)
         SELECT lomba_id, kategori_id, pj_nama, COALESCE(pj_kontak, ''), urutan FROM lomba_kategori`,
      `DROP TABLE IF EXISTS lomba_kategori`,
      `ALTER TABLE lomba_kategori_new RENAME TO lomba_kategori`,
      `CREATE INDEX IF NOT EXISTS idx_lomba_kategori_lomba ON lomba_kategori(lomba_id)`,
      `CREATE INDEX IF NOT EXISTS idx_lomba_kategori_kat ON lomba_kategori(kategori_id)`,
    ],
    "write"
  );
}

// Self-healing: ensure lomba_jadwal table exists (per-kategori execution date).
// Idempotent — safe to call on every DB access. Uses `client.execute()` for
// DDL since CREATE TABLE IF NOT EXISTS is single-statement and reliable.
export async function ensureLombaJadwalTable(): Promise<void> {
  await getClient().execute({
    sql: `CREATE TABLE IF NOT EXISTS lomba_jadwal (
      lomba_id INTEGER NOT NULL,
      kategori_id TEXT NOT NULL,
      tanggal INTEGER,
      jam TEXT,
      PRIMARY KEY (lomba_id, kategori_id),
      FOREIGN KEY (lomba_id) REFERENCES lomba(id) ON DELETE CASCADE,
      FOREIGN KEY (kategori_id) REFERENCES kategori(id) ON DELETE CASCADE
    )`,
    args: [],
  });
}

// Self-healing: ensure lomba.pendaftaran_dibuka column exists.
// Idempotent — safe to call on every DB access. Returns early if column
// already present (PRAGMA table_info check).
export async function ensurePendaftaranDibukaColumn(): Promise<void> {
  const cols = await all<{ name: string }>("PRAGMA table_info(lomba)");
  if (cols.some((c) => c.name === "pendaftaran_dibuka")) return;
  // Default 1 = open. NOT NULL with DEFAULT 1 so existing rows get a sane value.
  await getClient().execute({
    sql: "ALTER TABLE lomba ADD COLUMN pendaftaran_dibuka INTEGER NOT NULL DEFAULT 1",
    args: [],
  });
}

// Self-healing: ensure gender-split kategori exist (Balita, Anak L/P, Ibu-Ibu).
// Migration from the v1 single-gender schema:
//
//   v1                              v2 (this migration)
//   ─────────────────────────       ──────────────────────────────
//   k_anak     (5–11, mixed L/P)    k_anak_l  (5–11, Laki-laki)
//                                  k_anak_p  (5–11, Perempuan)
//   k_remaja   (12–17, mixed)       k_remaja  (12–17, mixed, unchanged)
//   k_dewasa   (18+, mixed)         k_dewasa_p (18+, "Ibu-Ibu", only female)
//                                  k_balita  (0–4, single, NEW)
//
// Why split k_anak? Stage system v4 picks Juara 1/2/3 per (lomba, kategori).
// With L/P mixed, the same rank lives in the same section — but warga can't
// tell which is which without a gender suffix. Splitting gives a clean Juara
// 1 (L) + Juara 1 (P) display.
//
// Why rename k_dewasa → k_dewasa_p? The kampung lomba has a single-female
// "Ibu-Ibu" Dewasa category. Keeping the DB id (`k_dewasa_p`) preserves FK
// consistency in lomba_kategori / pendaftar / lomba_jadwal after migration.
//
// Why add k_balita? Was implicitly a "k_anak" subgroup in v1, but separating
// 0–4 into its own row gives a clearer section header on the public page
// and on the form picker.
//
// Idempotent: no-op once new kats exist and old refs are migrated. Steps
// are order-sensitive — k_dewasa DELETE is last (after all FK refs moved).
export async function ensureGenderSplitKategori(): Promise<void> {
  // ===== Step 1: ensure new k_balita / k_anak_l / k_anak_p exist =====
  // Cheap PK-lookup → no-op if already present.
  //
  // k_balita: only inserted if NOT present. If the user has already
  // customized their k_balita (age, color, icon), we leave it alone.
  const kBalita = await get<{ id: string }>("SELECT id FROM kategori WHERE id = 'k_balita'");
  if (!kBalita) {
    await getClient().execute({
      sql: `INSERT INTO kategori (id, nama, icon, min, max, urutan, auto_age, color_bg, color_text, color_border)
            VALUES ('k_balita', 'Balita', 'fa-baby', 0, 4, 0, 1, ?, ?, ?)`,
      args: ["#FCE7F3", "#9D174D", "#FBCFE8"],
    });
  }
  // k_anak_l / k_anak_p: COPY from the existing k_anak row (preserving the
  // user's age range, color, icon) and only override the id + nama. If k_anak
  // doesn't exist (e.g. on a fresh DB that's already been seeded with the v2
  // schema), the SELECT returns 0 rows and the INSERT OR IGNORE is a no-op.
  await getClient().execute({
    sql: `INSERT OR IGNORE INTO kategori (id, nama, icon, min, max, urutan, auto_age, color_bg, color_text, color_border)
          SELECT 'k_anak_l', 'Anak (Laki-laki)', icon, min, max, urutan, auto_age, color_bg, color_text, color_border
          FROM kategori WHERE id = 'k_anak'`,
    args: [],
  });
  await getClient().execute({
    sql: `INSERT OR IGNORE INTO kategori (id, nama, icon, min, max, urutan, auto_age, color_bg, color_text, color_border)
          SELECT 'k_anak_p', 'Anak (Perempuan)', icon, min, max, urutan, auto_age, color_bg, color_text, color_border
          FROM kategori WHERE id = 'k_anak'`,
    args: [],
  });

  // ===== Step 2: create k_dewasa_p from k_dewasa (only if v1 row exists) =====
  // We can't just UPDATE the id (PRIMARY KEY), so we INSERT a new row from
  // the old one with overridden nama + id, then DELETE the old at the end.
  const kDewasa = await get<{ id: string }>("SELECT id FROM kategori WHERE id = 'k_dewasa'");
  const kDewasaP = await get<{ id: string }>("SELECT id FROM kategori WHERE id = 'k_dewasa_p'");
  if (kDewasa && !kDewasaP) {
    await getClient().execute({
      sql: `INSERT INTO kategori (id, nama, icon, min, max, urutan, auto_age, color_bg, color_text, color_border)
            SELECT 'k_dewasa_p', 'Ibu-Ibu', icon, min, max, urutan, auto_age, color_bg, color_text, color_border
            FROM kategori WHERE id = 'k_dewasa'`,
      args: [],
    });
  }

  // ===== Step 3: migrate lomba_kategori rows =====
  // k_anak → k_anak_l (NEW row, copy of all PJ fields) + UPDATE original → k_anak_p
  // The PJ typically oversees the whole "Anak" age group, so we duplicate
  // the row for both genders (same PJ info, same urutan).
  // INSERT OR IGNORE so re-runs are safe (no-op if k_anak_l row already exists).
  await getClient().execute({
    sql: `INSERT OR IGNORE INTO lomba_kategori (lomba_id, kategori_id, pj_nama, pj_kontak, urutan)
          SELECT lomba_id, 'k_anak_l', pj_nama, pj_kontak, urutan
          FROM lomba_kategori
          WHERE kategori_id = 'k_anak'`,
    args: [],
  });
  await getClient().execute({
    sql: "UPDATE lomba_kategori SET kategori_id = 'k_anak_p' WHERE kategori_id = 'k_anak'",
    args: [],
  });
  await getClient().execute({
    sql: "UPDATE lomba_kategori SET kategori_id = 'k_dewasa_p' WHERE kategori_id = 'k_dewasa'",
    args: [],
  });

  // ===== Step 4: migrate pendaftar rows =====
  // k_anak → k_anak_l / k_anak_p based on jenis_kelamin (one pendaftar is one person)
  await getClient().execute({
    sql: "UPDATE pendaftar SET kategori_id = 'k_anak_l' WHERE kategori_id = 'k_anak' AND jenis_kelamin = 'L'",
    args: [],
  });
  await getClient().execute({
    sql: "UPDATE pendaftar SET kategori_id = 'k_anak_p' WHERE kategori_id = 'k_anak' AND jenis_kelamin = 'P'",
    args: [],
  });
  // Edge case: pendaftar without jenis_kelamin set (shouldn't happen — schema
  // requires NOT NULL — but be defensive so we don't leave orphans).
  await getClient().execute({
    sql: "UPDATE pendaftar SET kategori_id = 'k_anak_l' WHERE kategori_id = 'k_anak' AND jenis_kelamin NOT IN ('L', 'P')",
    args: [],
  });
  await getClient().execute({
    sql: "UPDATE pendaftar SET kategori_id = 'k_dewasa_p' WHERE kategori_id = 'k_dewasa'",
    args: [],
  });

  // ===== Step 5: migrate lomba_jadwal rows =====
  // Same pattern as lomba_kategori — duplicate k_anak row to k_anak_l.
  await getClient().execute({
    sql: `INSERT OR IGNORE INTO lomba_jadwal (lomba_id, kategori_id, tanggal, jam)
          SELECT lomba_id, 'k_anak_l', tanggal, jam
          FROM lomba_jadwal
          WHERE kategori_id = 'k_anak'`,
    args: [],
  });
  await getClient().execute({
    sql: "UPDATE lomba_jadwal SET kategori_id = 'k_anak_p' WHERE kategori_id = 'k_anak'",
    args: [],
  });
  await getClient().execute({
    sql: "UPDATE lomba_jadwal SET kategori_id = 'k_dewasa_p' WHERE kategori_id = 'k_dewasa'",
    args: [],
  });

  // ===== Step 6: migrate lomba.kategori_eligible JSON =====
  // Replace k_anak with [k_anak_l, k_anak_p], k_dewasa with k_dewasa_p.
  // Dedupe (in case a lomba already had k_anak_l from a partial migration).
  const allLomba = await all<{ id: number; kategori_eligible: string }>(
    "SELECT id, kategori_eligible FROM lomba"
  );
  for (const l of allLomba) {
    let arr: string[];
    try { arr = JSON.parse(l.kategori_eligible); } catch { arr = []; }
    if (!Array.isArray(arr)) continue;
    const newArr: string[] = [];
    for (const kid of arr) {
      if (kid === "k_anak") {
        if (!newArr.includes("k_anak_l")) newArr.push("k_anak_l");
        if (!newArr.includes("k_anak_p")) newArr.push("k_anak_p");
      } else if (kid === "k_dewasa") {
        if (!newArr.includes("k_dewasa_p")) newArr.push("k_dewasa_p");
      } else {
        if (!newArr.includes(kid)) newArr.push(kid);
      }
    }
    if (JSON.stringify(newArr) !== l.kategori_eligible) {
      await run("UPDATE lomba SET kategori_eligible = ? WHERE id = ?", JSON.stringify(newArr), l.id);
    }
  }

  // ===== Step 7: delete old k_dewasa row (last, after all FK refs moved) =====
  // Safe now because lomba_kategori / pendaftar / lomba_jadwal all point
  // to k_dewasa_p. The FK ON DELETE CASCADE on lomba_kategori /
  // lomba_jadwal will not fire (no rows reference k_dewasa anymore).
  //
  // Re-check k_dewasa_p in the DB (not the snapshot at the top) — the
  // top-of-function check would have stored kDewasaP=null if it didn't
  // exist yet, even though Step 2 above just created it. Without the
  // re-check, this DELETE would silently skip and k_dewasa would stick
  // around forever.
  if (kDewasa) {
    const kDewasaPNow = await get<{ id: string }>("SELECT id FROM kategori WHERE id = 'k_dewasa_p'");
    if (kDewasaPNow) {
      await run("DELETE FROM kategori WHERE id = 'k_dewasa'");
    }
  }

  // ===== Step 8: delete old k_anak row (orphan after split) =====
  // After Step 3, all lomba_kategori / lomba_jadwal rows reference
  // k_anak_l or k_anak_p. pendaftar.kategori_id points to k_anak_l/p
  // too. So k_anak has zero FK references left and can be safely
  // removed. Leaving it around would just confuse the admin in the
  // kategori edit view.
  await run("DELETE FROM kategori WHERE id = 'k_anak'");
}
