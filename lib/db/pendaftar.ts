// Pendaftar CRUD + counts + display grouping.
// Pendaftar is the participant — links to lomba + kategori.
// Number format: LMB-YYYY-NNNN (auto-incremented per year, no gaps).
import { all, get, run, type DbRow, type DbValue } from "./client";
import { toCamel, toCamelAll } from "./internal";
import { getKategori } from "./kategori";
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
  data: Omit<Pendaftar, "id" | "nomor" | "createdAt" | "updatedAt" | "status" | "alasanTolak" | "hadir"> & {
    status?: PendaftarStatus;
    alasanTolak?: string | null;
    hadir?: boolean;
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
    createdAt: "created_at",
    updatedAt: "updated_at",
  };
  for (const [k, v] of Object.entries(updates)) {
    if (k === "id" || k === "createdAt" || k === "updatedAt") continue;
    if (k === "hadir") { sets.push("hadir = ?"); vals.push(v ? 1 : 0); }
    else { sets.push(`${map[k as keyof Pendaftar]} = ?`); vals.push(v as string | number | null); }
  }
  if (sets.length === 0) return;
  sets.push("updated_at = unixepoch()");
  vals.push(id);
  await run(`UPDATE pendaftar SET ${sets.join(", ")} WHERE id = ?`, ...(vals as DbValue[]));
}

export async function deletePendaftar(id: number): Promise<void> {
  await run("DELETE FROM pendaftar WHERE id = ?", id);
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
  const row = status
    ? await get<{ c: number }>("SELECT COUNT(*) as c FROM pendaftar WHERE lomba_id = ? AND status = ?", lombaId, status)
    : await get<{ c: number }>("SELECT COUNT(*) as c FROM pendaftar WHERE lomba_id = ?", lombaId);
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
  const sections: DisplaySection[] = [];
  if (balita.length > 0) {
    sections.push({ key: "balita", title: "Balita", rangeLabel: rangeFor("balita", "0–4 tahun"), peserta: buildPeserta(balita) });
  }
  if (anakL.length > 0) {
    sections.push({ key: "anakL", title: "Anak (Laki-laki)", rangeLabel: rangeFor("anak", "5–17 tahun"), peserta: buildPeserta(anakL) });
  }
  if (anakP.length > 0) {
    sections.push({ key: "anakP", title: "Anak (Perempuan)", rangeLabel: rangeFor("anak", "5–17 tahun"), peserta: buildPeserta(anakP) });
  }
  if (dewasa.length > 0) {
    sections.push({ key: "dewasa", title: "Dewasa", rangeLabel: rangeFor("dewasa", "18+ tahun"), peserta: buildPeserta(dewasa) });
  }

  return {
    balita: balita.map((r) => ({ nama: r.nama, umur: r.umur })),
    anakL: anakL.map((r) => ({ nama: r.nama, umur: r.umur })),
    anakP: anakP.map((r) => ({ nama: r.nama, umur: r.umur })),
    dewasa: dewasa.map((r) => ({ nama: r.nama, umur: r.umur })),
    sections,
  };
}
