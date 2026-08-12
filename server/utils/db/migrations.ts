// Self-healing migrations — safe to call on every DB access.
// Each migration is idempotent: no-op once the schema is in target state.
// Postgres version — uses information_schema + ADD COLUMN IF NOT EXISTS.
import { all, get, getPool, run } from "./client";
import { ensureColumn } from "./internal";

export async function ensureKategoriColorColumns(): Promise<void> {
  await ensureColumn("kategori", "color_bg", "TEXT NOT NULL DEFAULT '#FEF3C7'");
  await ensureColumn("kategori", "color_text", "TEXT NOT NULL DEFAULT '#92400E'");
  await ensureColumn("kategori", "color_border", "TEXT NOT NULL DEFAULT '#FDE68A'");
}

// Per-kategori input mode (added 2026-08-11):
//   "button" → age grid in public daftar form (good for narrow ranges
//              like Balita 2-5 tahun — 4 buttons feel snappy).
//   "field"  → number input field in public daftar form (good for wide
//              ranges like Dewasa 18+ — avoids rendering 50+ buttons).
// Default "button" preserves prior behavior for existing rows.
export async function ensureKategoriInputModeColumn(): Promise<void> {
  await ensureColumn("kategori", "input_mode", "TEXT NOT NULL DEFAULT 'button'");
}

export async function ensureJuaraColumn(): Promise<void> {
  await ensureColumn("pendaftar", "juara_rank", "INTEGER");
}

export async function ensureTigaFaseColumns(): Promise<void> {
  await ensureColumn("lomba", "fase_enabled", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("pendaftar", "is_semi_finalist", "INTEGER");
}

export async function ensureKualifikasiColumns(): Promise<void> {
  await ensureColumn("lomba", "finalis_count", "INTEGER NOT NULL DEFAULT 5");
  await ensureColumn("lomba", "phase", "TEXT");
}

export async function ensureKualifikasiV4Columns(): Promise<void> {
  // is_finalist is already in schema.sql (added 2026-08-12). ensureColumn is
  // idempotent (ADD COLUMN IF NOT EXISTS) so calling it on fresh DB is no-op.
  await ensureColumn("pendaftar", "is_finalist", "INTEGER");
}

export async function ensurePjMultiSupport(): Promise<void> {
  // Schema already includes PRIMARY KEY (lomba_id, kategori_id, urutan).
  // This migration only exists to back-fill lomba_kategori rows on legacy DBs
  // where PJ was stored on lomba.pj_nama/pj_kontak. Caller is expected to
  // handle the backfill explicitly; the schema change itself is in schema.sql.
}

export async function ensureLombaJadwalTable(): Promise<void> {
  // Schema is in schema.sql. No-op here.
}

export async function ensurePendaftaranDibukaColumn(): Promise<void> {
  // Schema is in schema.sql. No-op here.
}

export async function ensureGenderSplitKategori(): Promise<void> {
  // Step 1: k_balita is seeded in seed.ts and must NOT be re-inserted here.
  // A previous version of this migration did `INSERT INTO kategori (...) VALUES
  // ('k_balita', ...)` on every getKategori() call when the row was missing,
  // which made admin manual deletes "stick" only until the next refresh. That
  // bug is gone: k_balita lifecycle is now seed-driven.
  //
  // k_anak_l / k_anak_p are created from the legacy k_anak row. Using
  // ON CONFLICT DO NOTHING so this is idempotent: a fresh SELECT from a
  // missing k_anak returns 0 rows, so no rows are inserted (admin can
  // delete these too).
  await run(
    `INSERT INTO kategori (id, nama, icon, min, max, urutan, auto_age, color_bg, color_text, color_border)
     SELECT 'k_anak_l', 'Anak (Laki-laki)', icon, min, max, urutan, auto_age, color_bg, color_text, color_border
     FROM kategori WHERE id = 'k_anak'
     ON CONFLICT (id) DO NOTHING`
  );
  await run(
    `INSERT INTO kategori (id, nama, icon, min, max, urutan, auto_age, color_bg, color_text, color_border)
     SELECT 'k_anak_p', 'Anak (Perempuan)', icon, min, max, urutan, auto_age, color_bg, color_text, color_border
     FROM kategori WHERE id = 'k_anak'
     ON CONFLICT (id) DO NOTHING`
  );

  // Step 2: create k_dewasa_p from k_dewasa.
  await run(
    `INSERT INTO kategori (id, nama, icon, min, max, urutan, auto_age, color_bg, color_text, color_border)
     SELECT 'k_dewasa_p', 'Ibu-Ibu', icon, min, max, urutan, auto_age, color_bg, color_text, color_border
     FROM kategori WHERE id = 'k_dewasa'
     ON CONFLICT (id) DO NOTHING`
  );
  // Cache kDewasa presence for step 7
  const kDewasa = await get<{ id: string }>("SELECT id FROM kategori WHERE id = 'k_dewasa'");

  // Step 3: migrate lomba_kategori rows
  await run(
    `INSERT INTO lomba_kategori (lomba_id, kategori_id, pj_nama, pj_kontak, urutan)
     SELECT lomba_id, 'k_anak_l', pj_nama, pj_kontak, urutan
     FROM lomba_kategori
     WHERE kategori_id = 'k_anak'
     ON CONFLICT (lomba_id, kategori_id, urutan) DO NOTHING`
  );
  await run("UPDATE lomba_kategori SET kategori_id = 'k_anak_p' WHERE kategori_id = 'k_anak'");
  await run("UPDATE lomba_kategori SET kategori_id = 'k_dewasa_p' WHERE kategori_id = 'k_dewasa'");

  // Step 4: migrate pendaftar rows
  await run("UPDATE pendaftar SET kategori_id = 'k_anak_l' WHERE kategori_id = 'k_anak' AND jenis_kelamin = 'L'");
  await run("UPDATE pendaftar SET kategori_id = 'k_anak_p' WHERE kategori_id = 'k_anak' AND jenis_kelamin = 'P'");
  await run("UPDATE pendaftar SET kategori_id = 'k_anak_l' WHERE kategori_id = 'k_anak' AND jenis_kelamin NOT IN ('L', 'P')");
  await run("UPDATE pendaftar SET kategori_id = 'k_dewasa_p' WHERE kategori_id = 'k_dewasa'");

  // Step 5: migrate lomba_jadwal rows
  await run(
    `INSERT INTO lomba_jadwal (lomba_id, kategori_id, tanggal, jam)
     SELECT lomba_id, 'k_anak_l', tanggal, jam
     FROM lomba_jadwal
     WHERE kategori_id = 'k_anak'
     ON CONFLICT (lomba_id, kategori_id) DO NOTHING`
  );
  await run("UPDATE lomba_jadwal SET kategori_id = 'k_anak_p' WHERE kategori_id = 'k_anak'");
  await run("UPDATE lomba_jadwal SET kategori_id = 'k_dewasa_p' WHERE kategori_id = 'k_dewasa'");

  // Step 6: migrate lomba.kategori_eligible JSON
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
      await run("UPDATE lomba SET kategori_eligible = $1 WHERE id = $2", JSON.stringify(newArr), l.id);
    }
  }

  // Step 7: delete old k_dewasa row
  if (kDewasa) {
    const kDewasaPNow = await get<{ id: string }>("SELECT id FROM kategori WHERE id = 'k_dewasa_p'");
    if (kDewasaPNow) {
      await run("DELETE FROM kategori WHERE id = 'k_dewasa'");
    }
  }

  // Step 8: delete old k_anak row
  await run("DELETE FROM kategori WHERE id = 'k_anak'");
}
