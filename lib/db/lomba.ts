// Lomba CRUD + PJ (penanggung jawab) management.
// A lomba has many kategori, each kategori can have multiple PJs (multi-PJ
// enabled via the (lomba_id, kategori_id, urutan) composite PK — see migrations.ts).
import { all, get, getClient, run, type DbRow } from "./client";
import { toCamel, toCamelAll } from "./internal";
import { ensurePjMultiSupport, ensureKualifikasiColumns, ensureKualifikasiV4Columns } from "./migrations";
import type { Lomba, LombaKategoriInput, Pj } from "./types";

// Load pjByKategori for many lomba at once (avoid N+1).
// Groups rows into per-kategori arrays so a single (lomba, kategori) combo
// can hold multiple PJs (e.g. 2 or 3 PJ per kategori).
async function loadPjBulk(): Promise<Map<number, Record<string, Pj[]>>> {
  await ensurePjMultiSupport();
  const rows = await all<{ lomba_id: number; kategori_id: string; pj_nama: string; pj_kontak: string | null; urutan: number }>(
    "SELECT lomba_id, kategori_id, pj_nama, pj_kontak, urutan FROM lomba_kategori ORDER BY lomba_id, kategori_id, urutan"
  );
  const map = new Map<number, Record<string, Pj[]>>();
  for (const r of rows) {
    let m = map.get(r.lomba_id);
    if (!m) { m = {}; map.set(r.lomba_id, m); }
    if (!m[r.kategori_id]) m[r.kategori_id] = [];
    m[r.kategori_id].push({ nama: r.pj_nama, kontak: r.pj_kontak });
  }
  return map;
}

// Load per-kategori kualifikasi Tutup state for many lomba at once (avoid N+1).
// Returns Map<lombaId, Record<kategoriId, tutupAt | null>>. null/absent = not yet Tutup.
//
// v4: state is stored as a JSON object in the existing `lomba.phase` column
// (TEXT, added in v3 — fully replicated to all replicas, no schema-cache race).
// Schema: `{ "k_anak": 1750000000, "k_remaja": null }`.
//   - absent key  → kualifikasi ongoing
//   - null value  → explicitly "not Tutup" (sparse semantics; usually omitted)
//   - number      → unix-ms timestamp when admin clicked Tutup
//
// Defensive: if SELECT fails or JSON is malformed, return empty Map. The
// v4 per-kategori Tutup will just appear as "not Tutup" everywhere.
export function parseLombaKategoriTutup(phase: string | null | undefined): Record<string, number | null> {
  if (!phase) return {};
  try {
    const parsed = JSON.parse(phase);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
      else if (v === null) out[k] = null;
    }
    return out;
  } catch {
    return {};
  }
}

async function loadKategoriTutupBulk(): Promise<Map<number, Record<string, number | null>>> {
  try {
    // Only SELECT lomba with non-null phase (fast — most lomba have NULL).
    const rows = await all<{ id: number; phase: string | null }>(
      "SELECT id, phase FROM lomba WHERE phase IS NOT NULL"
    );
    const map = new Map<number, Record<string, number | null>>();
    for (const r of rows) {
      const parsed = parseLombaKategoriTutup(r.phase);
      if (Object.keys(parsed).length > 0) map.set(r.id, parsed);
    }
    return map;
  } catch {
    return new Map();
  }
}

function attachPj<T extends { id: number }>(row: T, pjBulk: Map<number, Record<string, Pj[]>>): T & { pjByKategori: Record<string, Pj[]> } {
  return { ...row, pjByKategori: pjBulk.get(row.id) || {} };
}

function attachKategoriTutup<T extends { id: number }>(
  row: T,
  tutupBulk: Map<number, Record<string, number | null>>
): T & { kategoriTutupAt: Record<string, number | null> } {
  return { ...row, kategoriTutupAt: tutupBulk.get(row.id) || {} };
}

// =================== Read ===================
export async function getLomba(includeInactive = false): Promise<Lomba[]> {
  await ensureKualifikasiColumns();
  const sql = includeInactive
    ? "SELECT * FROM lomba ORDER BY urutan"
    : "SELECT * FROM lomba WHERE status = 'aktif' ORDER BY urutan";
  const rows = toCamelAll<Lomba>(await all<DbRow>(sql));
  const [pjBulk, tutupBulk] = await Promise.all([loadPjBulk(), loadKategoriTutupBulk()]);
  return rows.map((r) => attachKategoriTutup(attachPj(r, pjBulk), tutupBulk));
}

export async function getLombaById(id: number): Promise<Lomba | null> {
  await ensureKualifikasiColumns();
  const row = toCamel<Lomba>(await get<DbRow>("SELECT * FROM lomba WHERE id = ?", id));
  if (!row) return null;
  const [pjBulk, tutupBulk] = await Promise.all([loadPjBulk(), loadKategoriTutupBulk()]);
  return attachKategoriTutup(attachPj(row, pjBulk), tutupBulk);
}

export async function getLombaWithCount(): Promise<{ id: number; nama: string; emoji: string; count: number; pjByKategori: Record<string, Pj[]> }[]> {
  await ensureKualifikasiColumns();
  const rows = await all<DbRow>(`
    SELECT l.id, l.nama, l.emoji, COUNT(p.id) as count
    FROM lomba l
    LEFT JOIN pendaftar p ON p.lomba_id = l.id
    GROUP BY l.id
    ORDER BY l.urutan
  `);
  const pjBulk = await loadPjBulk();
  return rows.map((r) => ({
    id: r.id as number,
    nama: r.nama as string,
    emoji: r.emoji as string,
    count: Number(r.count),
    pjByKategori: pjBulk.get(r.id as number) || {},
  }));
}

// =================== Write ===================
// Input excludes DB-managed fields (id, createdAt, pjByKategori, kategoriTutupAt
// — the latter is auto-derived via loadKategoriTutupBulk on read).
export async function createLomba(data: Omit<Lomba, "id" | "createdAt" | "pjByKategori" | "kategoriTutupAt">): Promise<number> {
  await ensureKualifikasiColumns();
  const result = await run(
    `INSERT INTO lomba (nama, emoji, deskripsi, syarat, kategori_eligible, status, urutan, finalis_count, phase)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.nama,
    data.emoji,
    data.deskripsi,
    JSON.stringify(data.syarat || []),
    JSON.stringify(data.kategoriEligible || []),
    data.status,
    data.urutan,
    data.finalisCount,
    data.phase
  );
  return Number(result.lastInsertRowid);
}

export async function setLombaKategori(lombaId: number, list: LombaKategoriInput[]): Promise<void> {
  // Self-healing: ensure the table can hold multiple PJs per (lomba, kategori).
  await ensurePjMultiSupport();
  // Replace all pj rows for this lomba with the new list
  await run("DELETE FROM lomba_kategori WHERE lomba_id = ?", lombaId);
  // `urutan` resets per-kategori so PJs of the same kategori stay contiguous in display
  // (e.g. k_balita: urutan 0,1,2  then  k_anak: urutan 0,1,2).
  const urutanByKat = new Map<string, number>();
  for (const pj of list) {
    const urutan = urutanByKat.get(pj.kategoriId) ?? 0;
    urutanByKat.set(pj.kategoriId, urutan + 1);
    await run(
      "INSERT INTO lomba_kategori (lomba_id, kategori_id, pj_nama, pj_kontak, urutan) VALUES (?, ?, ?, ?, ?)",
      lombaId,
      pj.kategoriId,
      pj.pjNama,
      pj.pjKontak,
      urutan
    );
  }
}

export async function updateLomba(id: number, updates: Partial<Omit<Lomba, "id" | "createdAt" | "pjByKategori" | "kategoriTutupAt" | "phase">>): Promise<void> {
  // Note: `phase` is intentionally NOT updatable via this function. It holds
  // a JSON object (per-kategori Tutup state) that should only be written via
  // `tutupKualifikasiKategori` / `bukaKualifikasiKategori`. Letting callers
  // write arbitrary text here would corrupt the JSON and break v4 phase logic.
  const map: Record<string, string> = {
    nama: "nama",
    emoji: "emoji",
    deskripsi: "deskripsi",
    status: "status",
    urutan: "urutan",
    finalisCount: "finalis_count",
  };
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(updates)) {
    if (k === "syarat") { sets.push("syarat = ?"); vals.push(JSON.stringify(v)); }
    else if (k === "kategoriEligible") { sets.push("kategori_eligible = ?"); vals.push(JSON.stringify(v)); }
    else if (map[k]) { sets.push(`${map[k]} = ?`); vals.push(v as string | number | null); }
  }
  if (sets.length > 0) {
    vals.push(id);
    await run(`UPDATE lomba SET ${sets.join(", ")} WHERE id = ?`, ...(vals as any[]));
  }
}

export async function deleteLomba(id: number): Promise<void> {
  // lomba_kategori cascades via FK ON DELETE CASCADE; pendaftar cascade manually
  await run("DELETE FROM pendaftar WHERE lomba_id = ?", id);
  await run("DELETE FROM lomba WHERE id = ?", id);
}

// =================== Juara readiness (stage system MVP) ===================
// Check if a lomba is ready to be "Selesaikan" — meaning every eligible
// kategori has at least Juara 1 + Juara 2 selected (Juara 3 is optional
// since some kategori may have < 3 pendaftar).
import { countJuaraByKategori } from "./pendaftar";

export type JuaraReadiness = {
  allReady: boolean;
  // List of kategori ids that are missing Juara 1 or Juara 2
  missingKategori: string[];
  // Per-kategori breakdown for UI display
  perKategori: Record<string, { ju1: number; ju2: number; ju3: number }>;
};

export async function getJuaraReadiness(lombaId: number): Promise<JuaraReadiness> {
  const lomba = await getLombaById(lombaId);
  if (!lomba) {
    return { allReady: false, missingKategori: [], perKategori: {} };
  }
  const perKategori: Record<string, { ju1: number; ju2: number; ju3: number }> = {};
  const missingKategori: string[] = [];
  // Only check kategori that are eligible for this lomba AND actually have
  // at least 1 disetujui pendaftar (kategori with 0 peserta are skipped —
  // a lomba with 0 peserta can't be "Selesaikan" but is also not actionable).
  for (const katId of lomba.kategoriEligible) {
    const counts = await countJuaraByKategori(lombaId, katId);
    perKategori[katId] = { ju1: counts[1], ju2: counts[2], ju3: counts[3] };
    if (counts[1] < 1 || counts[2] < 1) {
      missingKategori.push(katId);
    }
  }
  return {
    allReady: missingKategori.length === 0,
    missingKategori,
    perKategori,
  };
}

// Mark a lomba as "selesai". Caller should have already validated readiness
// via getJuaraReadiness — this is the atomic "commit" step.
export async function markLombaSelesai(lombaId: number): Promise<void> {
  await run(
    "UPDATE lomba SET status = 'selesai' WHERE id = ? AND status = 'aktif'",
    lombaId
  );
}

// =================== Per-kategori Tutup Kualifikasi (stage system v4) ===================
// v4: each kategori can be Tutup'd independently. When Tutup:
//   - All is_finalist decisions are locked (admin can no longer Loloskan/Gugur)
//   - Admin now picks Juara 1/2/3 from finalists (is_finalist = 1)
//
// This is a per-(lomba, kategori) action — different kategori can be in
// different phases. Tutup is reversible (admin can "Buka Kualifikasi" to
// unlock and edit finalist decisions, as long as Juara 1/2/3 not yet picked).
//
// Storage: JSON in `lomba.phase` (TEXT column, added in v3, fully replicated
// to all replicas). Avoids the libSQL HTTP schema-cache race that plagued
// the original `lomba_kategori.kualifikasi_tutup_at` column approach.

/**
 * Mark a (lomba, kategori) as Tutup. All pendaftar must be decided
 * (is_finalist IS NOT NULL) before this succeeds.
 *
 * Returns true on success, false if any pendaftar is still pending.
 */
export async function tutupKualifikasiKategori(
  lombaId: number,
  kategoriId: string
): Promise<boolean> {
  await ensureKualifikasiV4Columns();
  // Verify all pendaftar decided
  const pendingRow = await get<{ c: number }>(
    `SELECT COUNT(*) as c FROM pendaftar
     WHERE lomba_id = ? AND kategori_id = ? AND status = 'disetujui'
       AND is_finalist IS NULL`,
    lombaId,
    kategoriId
  );
  if ((pendingRow?.c ?? 0) > 0) return false;
  // Read-modify-write the JSON in lomba.phase. No schema race because the
  // column already exists on every replica.
  const row = await get<{ phase: string | null }>(
    "SELECT phase FROM lomba WHERE id = ?",
    lombaId
  );
  const map = parseLombaKategoriTutup(row?.phase);
  map[kategoriId] = Date.now();
  await run(
    "UPDATE lomba SET phase = ? WHERE id = ?",
    JSON.stringify(map),
    lombaId
  );
  return true;
}

/**
 * Re-open Tutup — admin can edit is_finalist again. Only allowed if no
 * Juara 1/2/3 has been picked yet (otherwise we'd silently clear them).
 * Returns true on success, false if Juara already picked.
 */
export async function bukaKualifikasiKategori(
  lombaId: number,
  kategoriId: string
): Promise<boolean> {
  await ensureKualifikasiV4Columns();
  // Verify no Juara picked yet
  const juaraRow = await get<{ c: number }>(
    `SELECT COUNT(*) as c FROM pendaftar
     WHERE lomba_id = ? AND kategori_id = ? AND juara_rank IS NOT NULL`,
    lombaId,
    kategoriId
  );
  if ((juaraRow?.c ?? 0) > 0) return false;
  // Read-modify-write the JSON in lomba.phase. Remove the key to mark
  // the kategori as "ongoing" again.
  const row = await get<{ phase: string | null }>(
    "SELECT phase FROM lomba WHERE id = ?",
    lombaId
  );
  const map = parseLombaKategoriTutup(row?.phase);
  delete map[kategoriId];
  await run(
    "UPDATE lomba SET phase = ? WHERE id = ?",
    JSON.stringify(map),
    lombaId
  );
  return true;
}
