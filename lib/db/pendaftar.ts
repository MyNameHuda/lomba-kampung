// Pendaftar CRUD + counts + display grouping.
// Pendaftar is the participant — links to lomba + kategori.
// Number format: LMB-YYYY-NNNN (auto-incremented per year, no gaps).
import { all, get, getClient, run, type DbRow, type DbValue } from "./client";
import { toCamel, toCamelAll } from "./internal";
import { getKategori } from "./kategori";
import { ensureJuaraColumn, ensureKualifikasiV4Columns } from "./migrations";
import type { DisplaySection, DisplaySectionKey, JenisKelamin, Pendaftar, PendaftarStatus } from "./types";

// =================== Read ===================
export async function getPendaftar(): Promise<Pendaftar[]> {
  const rows = await all("SELECT * FROM pendaftar ORDER BY created_at DESC");
  return toCamelAll<Pendaftar>(rows);
}

export async function getPendaftarByLomba(lombaId: number, status?: PendaftarStatus): Promise<Pendaftar[]> {
  const sql = status
    ? "SELECT * FROM pendaftar WHERE lomba_id = ? AND status = ? ORDER BY nomor"
    : "SELECT * FROM pendaftar WHERE lomba_id = ? ORDER BY nomor";
  const params: DbValue[] = status ? [lombaId, status] : [lombaId];
  const rows = await all<DbRow>(sql, ...params);
  return toCamelAll<Pendaftar>(rows);
}

export async function getPendaftarByNomor(nomor: string): Promise<Pendaftar | null> {
  return toCamel<Pendaftar>(await get<DbRow>("SELECT * FROM pendaftar WHERE nomor = ?", nomor));
}

export async function getPendaftarById(id: number): Promise<Pendaftar | null> {
  return toCamel<Pendaftar>(await get<DbRow>("SELECT * FROM pendaftar WHERE id = ?", id));
}

// =================== Write ===================
export async function createPendaftar(
  data: Omit<Pendaftar, "id" | "nomor" | "createdAt" | "updatedAt" | "status" | "alasanTolak" | "hadir" | "juaraRank" | "isFinalist"> & {
    status?: PendaftarStatus;
    alasanTolak?: string | null;
    hadir?: boolean;
    juaraRank?: 1 | 2 | 3 | null;
    isFinalist?: 0 | 1 | null;
  }
): Promise<{ id: number; nomor: string }> {
  const year = new Date().getFullYear();
  // Use MAX of numeric suffix (cast to INTEGER) for the safest auto-increment.
  // Format: 'LMB-2026-0001' — numeric suffix starts at char 10 (1-indexed).
  // Avoids: (1) substr-length bug from before, (2) gap if some rows were
  // rejected/deleted, (3) double-counting from manual inserts.
  const maxRow = await get<{ m: number | null }>(
    `SELECT MAX(CAST(substr(nomor, 10) AS INTEGER)) as m
     FROM pendaftar
     WHERE nomor LIKE ?`,
    `LMB-${year}-%`
  );
  const nextNum = (maxRow?.m ?? 0) + 1;
  const nomor = `LMB-${year}-${String(nextNum).padStart(4, "0")}`;
  const result = await run(
    `INSERT INTO pendaftar (nomor, nama, no_wa, jenis_kelamin, kategori_id, umur, lomba_id, status, sumber, hadir)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    nomor,
    data.nama,
    data.noWa ?? null,
    data.jenisKelamin,
    data.kategoriId,
    data.umur,
    data.lombaId,
    data.status ?? "pending",
    data.sumber,
    data.hadir ? 1 : 0
  );
  return { id: Number(result.lastInsertRowid), nomor };
}

export async function updatePendaftar(id: number, updates: Partial<Pendaftar>): Promise<void> {
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  const map: Record<keyof Pendaftar, string> = {
    id: "id",
    nomor: "nomor",
    nama: "nama",
    noWa: "no_wa",
    jenisKelamin: "jenis_kelamin",
    kategoriId: "kategori_id",
    umur: "umur",
    lombaId: "lomba_id",
    status: "status",
    alasanTolak: "alasan_tolak",
    sumber: "sumber",
    hadir: "hadir",
    juaraRank: "juara_rank",
    isFinalist: "is_finalist",
    createdAt: "created_at",
    updatedAt: "updated_at",
  };
  for (const [k, v] of Object.entries(updates)) {
    if (k === "id" || k === "createdAt" || k === "updatedAt") continue;
    if (k === "hadir") { sets.push("hadir = ?"); vals.push(v ? 1 : 0); }
    else { sets.push(`${map[k as keyof Pendaftar]} = ?`); vals.push(v as string | number | null); }
  }
  // Auto-clear juara_rank when a pendaftar is rejected — they're no longer
  // eligible to hold a Juara rank in this (lomba, kategori).
  if (updates.status === "ditolak") {
    sets.push("juara_rank = ?");
    vals.push(null);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = unixepoch()");
  vals.push(id);
  await run(`UPDATE pendaftar SET ${sets.join(", ")} WHERE id = ?`, ...(vals as DbValue[]));
}

export async function deletePendaftar(id: number): Promise<void> {
  await run("DELETE FROM pendaftar WHERE id = ?", id);
}

/**
 * Bulk delete pendaftar rows.
 *  - scope: "pending" → only rows still awaiting approval (status='pending')
 *  - scope: "all"     → every row in the table
 * Returns the number of rows actually deleted.
 */
export async function bulkDeletePendaftar(scope: "pending" | "all"): Promise<number> {
  const sql = scope === "all"
    ? "DELETE FROM pendaftar"
    : "DELETE FROM pendaftar WHERE status = 'pending'";
  const result = await run(sql);
  return result.changes;
}

// =================== Counts ===================
export async function countLombaAktif(): Promise<number> {
  const row = await get<{ c: number }>("SELECT COUNT(*) as c FROM lomba WHERE status = 'aktif'");
  return Number(row?.c ?? 0);
}

export async function countPendaftarByStatus(status: PendaftarStatus): Promise<number> {
  const row = await get<{ c: number }>("SELECT COUNT(*) as c FROM pendaftar WHERE status = ?", status);
  return Number(row?.c ?? 0);
}

export async function countAllPendaftar(): Promise<number> {
  const row = await get<{ c: number }>("SELECT COUNT(*) as c FROM pendaftar");
  return Number(row?.c ?? 0);
}

export async function countPendaftarHadir(lombaId?: number): Promise<number> {
  const row = lombaId
    ? await get<{ c: number }>("SELECT COUNT(*) as c FROM pendaftar WHERE hadir = 1 AND lomba_id = ?", lombaId)
    : await get<{ c: number }>("SELECT COUNT(*) as c FROM pendaftar WHERE hadir = 1");
  return Number(row?.c ?? 0);
}

export async function countPendaftarByLomba(lombaId: number, status?: PendaftarStatus): Promise<number> {
  // When status is explicit, count that exact status (e.g. "disetujui"
  // for the public home "X peserta" badge).
  //
  // When status is omitted, count "active" pendaftar (pending + disetujui)
  // — i.e. exclude `ditolak`. Declined pendaftar are removed from the
  // approval section, so they should not appear in any admin count
  // either (lomba card, peserta card, top lomba). Callers that
  // genuinely need the "all" count should pass an explicit status or
  // use a new query.
  const row = status
    ? await get<{ c: number }>("SELECT COUNT(*) as c FROM pendaftar WHERE lomba_id = ? AND status = ?", lombaId, status)
    : await get<{ c: number }>(
        "SELECT COUNT(*) as c FROM pendaftar WHERE lomba_id = ? AND status != 'ditolak'",
        lombaId
      );
  return Number(row?.c ?? 0);
}

// =================== Public grouping (Balita / Anak L / Anak P / Dewasa) ===================
// Display grouping is derived from the master `kategori` table — single source of truth.
// Section classification is based on the kategori row's `min` field:
//   - balita:  min < 5   (typically 0–4)
//   - anak:    5 <= min < 18  (split by L/P)
//   - dewasa:  min >= 18 (typically 18+)
// The range shown per section is computed from the min/max of the actual kategori rows in that section.

type SectionKind = "balita" | "anak" | "dewasa";
function sectionForKategori(k: { min: number; max: number }): SectionKind {
  if (k.min < 5) return "balita";
  if (k.min < 18) return "anak";
  return "dewasa";
}

export async function groupPendaftarForLomba(lombaId: number): Promise<{
  balita: { nama: string; umur: number }[];
  anakL: { nama: string; umur: number }[];
  anakP: { nama: string; umur: number }[];
  dewasa: { nama: string; umur: number }[];
  // Richer structure used by both public + admin pages (range is auto-derived)
  sections: DisplaySection[];
}> {
  // Get all approved peserta for this lomba + master kategori in parallel
  const [rows, kats] = await Promise.all([
    all<{ nama: string; umur: number; jenis_kelamin: JenisKelamin; kategori_id: string; created_at: number }>(
      "SELECT nama, umur, jenis_kelamin, kategori_id, created_at FROM pendaftar WHERE lomba_id = ? AND status = 'disetujui'",
      lombaId
    ),
    getKategori(),
  ]);

  const katMap = new Map(kats.map((k) => [k.id, k]));

  // Bucket rows by section + gender (for anak: split L/P)
  const balita: typeof rows = [];
  const anakL: typeof rows = [];
  const anakP: typeof rows = [];
  const dewasa: typeof rows = [];

  for (const r of rows) {
    const k = katMap.get(r.kategori_id);
    if (!k) continue; // orphan row, skip
    const sec = sectionForKategori(k);
    if (sec === "balita") balita.push(r);
    else if (sec === "anak") {
      if (r.jenis_kelamin === "L") anakL.push(r);
      else anakP.push(r);
    } else dewasa.push(r);
  }

  // Sort rules:
  //   - Dewasa: by created_at ASC (registration order)
  //   - Balita / Anak: by umur ASC, then by created_at as tiebreaker
  const sortByUmur = (a: typeof rows[number], b: typeof rows[number]) =>
    a.umur - b.umur || a.created_at - b.created_at || 0;
  const sortByDaftar = (a: typeof rows[number], b: typeof rows[number]) =>
    a.created_at - b.created_at || 0;
  balita.sort(sortByUmur);
  anakL.sort(sortByUmur);
  anakP.sort(sortByUmur);
  dewasa.sort(sortByDaftar);

  // Compute range per section from the kategori rows that fall in that section.
  // Only consider kategori rows that have at least one peserta in this section.
  // If no peserta, fall back to default range.
  function rangeFor(section: SectionKind, fallback: string): string {
    const katsInSection = kats.filter((k) => sectionForKategori(k) === section);
    if (katsInSection.length === 0) return fallback;
    const mins = katsInSection.map((k) => k.min);
    const maxs = katsInSection.map((k) => k.max);
    const lo = Math.min(...mins);
    const hi = Math.max(...maxs);
    if (hi >= 999) return `${lo}+ tahun`;
    return `${lo}–${hi} tahun`;
  }

  // Build flat `peserta` per section (with gender info for L/P split)
  const buildPeserta = (arr: typeof rows) => arr.map((r) => ({ nama: r.nama, umur: r.umur, jenisKelamin: r.jenis_kelamin }));

  // Build rich sections array (for unified display across public + admin)
  // Section titles use the master `kategori.nama` for k_balita / k_anak_l /
  // k_anak_p (so they pick up the canonical display). Dewasa pulls from the
  // single dewasa kategori (renamed to k_dewasa_p / "Ibu-Ibu" in the gender
  // split migration).
  const findNamaByMin = (max: number) => kats.find((k) => k.min === 0 && k.max === 4)?.nama || "Balita";
  const findAnakL = () => kats.find((k) => k.id === "k_anak_l")?.nama || "Anak (Laki-laki)";
  const findAnakP = () => kats.find((k) => k.id === "k_anak_p")?.nama || "Anak (Perempuan)";
  const findDewasaNama = () => {
    // Use the actual kategori name (e.g. "Ibu-Ibu" after the gender-split
    // migration). Fall back to "Dewasa" if no dewasa kategori is found.
    const dewasaKat = kats.find((k) => k.min >= 18);
    return dewasaKat?.nama || "Dewasa";
  };

  const sections: DisplaySection[] = [];
  if (balita.length > 0) {
    sections.push({ key: "balita", title: findNamaByMin(4), rangeLabel: rangeFor("balita", "0–4 tahun"), peserta: buildPeserta(balita) });
  }
  if (anakL.length > 0) {
    sections.push({ key: "anakL", title: findAnakL(), rangeLabel: rangeFor("anak", "5–17 tahun"), peserta: buildPeserta(anakL) });
  }
  if (anakP.length > 0) {
    sections.push({ key: "anakP", title: findAnakP(), rangeLabel: rangeFor("anak", "5–17 tahun"), peserta: buildPeserta(anakP) });
  }
  if (dewasa.length > 0) {
    sections.push({ key: "dewasa", title: findDewasaNama(), rangeLabel: rangeFor("dewasa", "18+ tahun"), peserta: buildPeserta(dewasa) });
  }

  return {
    balita: balita.map((r) => ({ nama: r.nama, umur: r.umur })),
    anakL: anakL.map((r) => ({ nama: r.nama, umur: r.umur })),
    anakP: anakP.map((r) => ({ nama: r.nama, umur: r.umur })),
    dewasa: dewasa.map((r) => ({ nama: r.nama, umur: r.umur })),
    sections,
  };
}

// =================== Juara (stage system MVP) ===================
// Juara 1/2/3 are picked per (lomba, kategori). Scope is enforced via
// WHERE clause on lomba_id + kategori_id + juara_rank. No DB-level
// uniqueness constraint (libSQL doesn't enforce partial unique indexes
// the way Postgres does), so app code MUST always go through setJuaraRank
// which un-picks existing Juara with the same rank first.

// Slim shape used by client + public Juara display.
export type JuaraSlim = {
  pendaftarId: number;
  nama: string;
  kategoriId: string;
  juaraRank: 1 | 2 | 3;
  umur: number;
  jenisKelamin: JenisKelamin;
};

/**
 * Set Juara rank for a pendaftar. Atomically:
 *  1. Un-pick any existing Juara with the same rank in the same (lomba, kategori)
 *  2. Set this pendaftar to the new rank
 *
 * Rank is a positive integer. In v2 (legacy / final phase), rank is 1, 2, or 3.
 * In v3 (kualifikasi phase), rank is 1..finalisCount. The API layer validates
 * the range based on lomba.phase and finalisCount.
 *
 * Returns the pendaftar's (lomba, kategori) so caller can revalidate paths.
 * If pendaftarId doesn't exist, no-op (API layer should validate first).
 */
export async function setJuaraRank(
  pendaftarId: number,
  rank: number
): Promise<{ lombaId: number; kategoriId: string; rank: number } | null> {
  await ensureJuaraColumn();
  // Get the (lomba, kategori) of the target pendaftar so the un-pick is scoped
  const p = await get<{ lomba_id: number; kategori_id: string }>(
    "SELECT lomba_id, kategori_id FROM pendaftar WHERE id = ?",
    pendaftarId
  );
  if (!p) return null;

  // Step 1: un-pick old Juara with same rank in same (lomba, kategori)
  await run(
    `UPDATE pendaftar SET juara_rank = NULL
     WHERE lomba_id = ? AND kategori_id = ? AND juara_rank = ? AND id != ?`,
    p.lomba_id,
    p.kategori_id,
    rank,
    pendaftarId
  );
  // Step 2: set new Juara
  await run(
    "UPDATE pendaftar SET juara_rank = ? WHERE id = ?",
    rank,
    pendaftarId
  );
  return { lombaId: p.lomba_id, kategoriId: p.kategori_id, rank };
}

/**
 * Clear Juara rank for a pendaftar (set to NULL).
 * No-op if pendaftar already has no Juara rank.
 */
export async function clearJuaraRank(pendaftarId: number): Promise<void> {
  await run(
    "UPDATE pendaftar SET juara_rank = NULL WHERE id = ?",
    pendaftarId
  );
}

/**
 * Get all Juara (1/2/3) for a lomba, grouped by kategori.
 * Returns Map<kategoriId, JuaraSlim[]>. Each kategori array is sorted
 * by juaraRank ASC. Kategori with no Juara are absent from the map.
 */
export async function getJuaraByLomba(
  lombaId: number
): Promise<Record<string, JuaraSlim[]>> {
  await ensureJuaraColumn();
  const rows = await all<{
    id: number;
    nama: string;
    kategori_id: string;
    juara_rank: number;
    umur: number;
    jenis_kelamin: JenisKelamin;
  }>(
    `SELECT id, nama, kategori_id, juara_rank, umur, jenis_kelamin
     FROM pendaftar
     WHERE lomba_id = ? AND juara_rank IS NOT NULL
     ORDER BY kategori_id, juara_rank`,
    lombaId
  );
  const grouped: Record<string, JuaraSlim[]> = {};
  for (const r of rows) {
    if (!grouped[r.kategori_id]) grouped[r.kategori_id] = [];
    grouped[r.kategori_id].push({
      pendaftarId: r.id,
      nama: r.nama,
      kategoriId: r.kategori_id,
      juaraRank: r.juara_rank as 1 | 2 | 3,
      umur: r.umur,
      jenisKelamin: r.jenis_kelamin,
    });
  }
  return grouped;
}

/**
 * Count Juara per rank for a (lomba, kategori). Used to validate
 * "Selesaikan Lomba" (need at least Juara 1 + Juara 2 per kategori).
 * Returns Record<rank, count>. Absent keys mean count = 0.
 */
export async function countJuaraByKategori(
  lombaId: number,
  kategoriId: string
): Promise<Record<1 | 2 | 3, number>> {
  await ensureJuaraColumn();
  const rows = await all<{ juara_rank: number; c: number }>(
    `SELECT juara_rank, COUNT(*) as c
     FROM pendaftar
     WHERE lomba_id = ? AND kategori_id = ? AND juara_rank IS NOT NULL
     GROUP BY juara_rank`,
    lombaId,
    kategoriId
  );
  const out: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
  for (const r of rows) {
    if (r.juara_rank === 1 || r.juara_rank === 2 || r.juara_rank === 3) {
      out[r.juara_rank] = Number(r.c);
    }
  }
  return out;
}

// =================== Finalist (stage system v4) ===================
// Finalists (pendaftar who passed kualifikasi) are tracked via is_finalist
// (tri-state: null=pending, 1=lolos, 0=gugur). Separate from juara_rank
// which is for Juara 1/2/3 only (set in final phase).
//
// Gugur is REVERSIBLE — admin can un-gugur (back to null) or un-loloskan
// (back to null) anytime during kualifikasi. Once kategori Tutup, finalist
// state is locked and only Juara rank can be set/cleared.

/**
 * Set finalist state for a pendaftar. Used during kualifikasi phase
 * (before kategori Tutup). Caller must validate pendaftar exists, belongs
 * to the right lomba, and the kategori is not yet Tutup.
 *
 * @param status 1 = lolos, 0 = gugur, null = reset to pending
 * Retries on libSQL HTTP schema cache race.
 */
export async function setFinalist(
  pendaftarId: number,
  status: 0 | 1 | null
): Promise<void> {
  await ensureKualifikasiV4Columns();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await getClient().execute({
        sql: "UPDATE pendaftar SET is_finalist = ? WHERE id = ?",
        args: [status, pendaftarId],
      });
      return;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
}

/**
 * Per-kategori kualifikasi status summary. Used by admin UI tabs and
 * Tutup Kualifikasi readiness check.
 *
 * Returns:
 *   - lolos: count of pendaftar with is_finalist = 1
 *   - gugur: count of pendaftar with is_finalist = 0
 *   - pending: count of pendaftar with is_finalist IS NULL
 *   - total: pendaftar count (status='disetujui')
 *   - readyToTutup: true iff pending === 0 (all decided)
 */
export type KualifikasiKategoriStatus = {
  lolos: number;
  gugur: number;
  pending: number;
  total: number;
  readyToTutup: boolean;
};

export async function getKualifikasiStatusByKategori(
  lombaId: number,
  kategoriId: string
): Promise<KualifikasiKategoriStatus> {
  await ensureKualifikasiV4Columns();
  const rows = await all<{ c: number; s: number | null }>(
    `SELECT is_finalist as s, COUNT(*) as c
     FROM pendaftar
     WHERE lomba_id = ? AND kategori_id = ? AND status = 'disetujui'
     GROUP BY is_finalist`,
    lombaId,
    kategoriId
  );
  let lolos = 0, gugur = 0, pending = 0;
  for (const r of rows) {
    if (r.s === 1) lolos = Number(r.c);
    else if (r.s === 0) gugur = Number(r.c);
    else pending = Number(r.c);
  }
  const total = lolos + gugur + pending;
  return { lolos, gugur, pending, total, readyToTutup: pending === 0 };
}

/**
 * Finalist readiness per eligible kategori for a lomba. Used to compute
 * the global "Tutup Kualifikasi" badge + button state.
 *
 *   - perKategori: keyed by kategoriId
 *   - allReady: every eligible kategori with >=1 pendaftar has readyToTutup
 *   - anyInKualifikasi: at least one kategori still has pending decisions
 *   - allInFinal: every eligible kategori is Tutup (kualifikasi_tutup_at set)
 */
export async function getLombaKualifikasiStatus(
  lombaId: number,
  eligibleKategoriIds: string[],
  kategoriTutupAt: Record<string, number | null>
): Promise<{
  perKategori: Record<string, KualifikasiKategoriStatus>;
  allReady: boolean;
  anyInKualifikasi: boolean;
  allInFinal: boolean;
}> {
  await ensureKualifikasiV4Columns();
  const perKategori: Record<string, KualifikasiKategoriStatus> = {};
  for (const kid of eligibleKategoriIds) {
    perKategori[kid] = await getKualifikasiStatusByKategori(lombaId, kid);
  }
  // allReady = every eligible kategori with pendaftar has no pending
  const allReady = eligibleKategoriIds.every((kid) => perKategori[kid].readyToTutup);
  // anyInKualifikasi = at least one eligible kategori has pending
  const anyInKualifikasi = eligibleKategoriIds.some((kid) => perKategori[kid].pending > 0);
  // allInFinal = every eligible kategori has kualifikasi_tutup_at set
  const allInFinal = eligibleKategoriIds.every((kid) => !!kategoriTutupAt[kid]);
  return { perKategori, allReady, anyInKualifikasi, allInFinal };
}
