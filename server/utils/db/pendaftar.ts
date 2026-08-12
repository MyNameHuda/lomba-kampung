// Pendaftar CRUD + counts + display grouping + Juara/finalist/semi-finalist.
// Postgres port. Differences vs SQLite/libSQL version:
//   - ? placeholders → $1, $2, $3 ...
//   - `substr(nomor, 10)` → `SUBSTRING(nomor FROM 10)` (Postgres is 1-based)
//   - INSERT uses `RETURNING id` instead of `lastInsertRowid`
//   - `unixepoch()` → `EXTRACT(EPOCH FROM NOW())::bigint`
//   - `getClient().execute({sql, args})` → `getPool().query(sql, args)`
import { all, get, getPool, returningId, run, type DbRow, type DbValue } from "./client";
import { toCamel, toCamelAll } from "./internal";
import { getKategori } from "./kategori";
import { ensureJuaraColumn, ensureKualifikasiV4Columns } from "./migrations";
import type { DisplaySection, JenisKelamin, Pendaftar, PendaftarStatus } from "./types";

// =================== Read ===================
export async function getPendaftar(): Promise<Pendaftar[]> {
  const rows = await all("SELECT * FROM pendaftar ORDER BY created_at DESC");
  return toCamelAll<Pendaftar>(rows);
}

// =================== Filtered reads (avoid loading all rows) ===================

// Read pendaftar filtered by status at SQL level. Pass `limit` for top-N queries.
export async function getPendaftarByStatus(
  status: PendaftarStatus,
  limit?: number
): Promise<Pendaftar[]> {
  const sql = limit
    ? "SELECT * FROM pendaftar WHERE status = $1 ORDER BY created_at DESC LIMIT $2"
    : "SELECT * FROM pendaftar WHERE status = $1 ORDER BY created_at DESC";
  const args = limit ? [status, limit] : [status];
  return toCamelAll<Pendaftar>(await all<DbRow>(sql, ...args));
}

// Read recent pendaftar (any status), ordered by created_at DESC. For dashboard.
export async function getRecentPendaftar(limit: number): Promise<Pendaftar[]> {
  const rows = await all<DbRow>(
    "SELECT * FROM pendaftar ORDER BY created_at DESC LIMIT $1",
    limit
  );
  return toCamelAll<Pendaftar>(rows);
}

// Single-query count for ALL pendaftar statuses. Replaces 4 separate
// countPendaftarByStatus() round-trips on the dashboard.
export async function getPendaftarCountsByStatus(): Promise<{
  total: number;
  pending: number;
  disetujui: number;
  ditolak: number;
}> {
  const rows = await all<{ status: string; c: number }>(
    "SELECT status, COUNT(*) as c FROM pendaftar GROUP BY status"
  );
  const out = { total: 0, pending: 0, disetujui: 0, ditolak: 0 };
  for (const r of rows) {
    const n = Number(r.c);
    out.total += n;
    if (r.status === "pending") out.pending = n;
    else if (r.status === "disetujui") out.disetujui = n;
    else if (r.status === "ditolak") out.ditolak = n;
  }
  return out;
}

// Batched per-lomba count by status. Returns { [lombaId]: { disetujui, pending, total } }
// where total = all pendaftar except 'ditolak'. Single query for all lomba.
export async function getPendaftarCountsByLombaBatch(
  lombaIds: number[]
): Promise<Map<number, { disetujui: number; pending: number; total: number }>> {
  const map = new Map<number, { disetujui: number; pending: number; total: number }>();
  for (const id of lombaIds) map.set(id, { disetujui: 0, pending: 0, total: 0 });
  if (lombaIds.length === 0) return map;
  const rows = await all<{ lomba_id: number; status: string; c: number }>(
    "SELECT lomba_id, status, COUNT(*) as c FROM pendaftar WHERE lomba_id = ANY($1) GROUP BY lomba_id, status",
    [lombaIds]
  );
  for (const r of rows) {
    const m = map.get(Number(r.lomba_id));
    if (!m) continue;
    const n = Number(r.c);
    if (r.status === "disetujui") m.disetujui = n;
    else if (r.status === "pending") m.pending = n;
    if (r.status !== "ditolak") m.total += n;
  }
  return map;
}

export async function getPendaftarByLomba(lombaId: number, status?: PendaftarStatus): Promise<Pendaftar[]> {
  const sql = status
    ? "SELECT * FROM pendaftar WHERE lomba_id = $1 AND status = $2 ORDER BY nomor"
    : "SELECT * FROM pendaftar WHERE lomba_id = $1 ORDER BY nomor";
  const params: DbValue[] = status ? [lombaId, status] : [lombaId];
  const rows = await all<DbRow>(sql, ...params);
  return toCamelAll<Pendaftar>(rows);
}

export async function getPendaftarByNomor(nomor: string): Promise<Pendaftar | null> {
  return toCamel<Pendaftar>(await get<DbRow>("SELECT * FROM pendaftar WHERE nomor = $1", nomor));
}

// =================== Write ===================
export async function createPendaftar(
  data: Omit<Pendaftar, "id" | "nomor" | "createdAt" | "updatedAt" | "status" | "alasanTolak" | "hadir" | "juaraRank" | "isFinalist" | "isSemiFinalist"> & {
    status?: PendaftarStatus;
    alasanTolak?: string | null;
    hadir?: boolean;
    juaraRank?: 1 | 2 | 3 | null;
    isFinalist?: 0 | 1 | null;
    isSemiFinalist?: 0 | 1 | null;
  }
): Promise<{ id: number; nomor: string }> {
  const year = new Date().getFullYear();
  const maxRow = await get<{ m: number | null }>(
    `SELECT MAX(CAST(SUBSTRING(nomor FROM 10) AS INTEGER)) as m
     FROM pendaftar
     WHERE nomor LIKE $1`,
    `LMB-${year}-%`
  );
  const nextNum = (maxRow?.m ?? 0) + 1;
  const nomor = `LMB-${year}-${String(nextNum).padStart(4, "0")}`;
  // Postgres has no lastInsertRowid — use RETURNING id. Tipe parser will keep
  // id as number (oid 23 = int4) thanks to client.ts setTypeParser(23, ...).
  const id = await returningId<{ id: number }>(
    `INSERT INTO pendaftar (nomor, nama, no_wa, jenis_kelamin, kategori_id, umur, lomba_id, status, sumber, hadir)
     VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    nomor,
    data.nama,
    data.jenisKelamin,
    data.kategoriId,
    data.umur,
    data.lombaId,
    data.status ?? "pending",
    data.sumber,
    data.hadir ? 1 : 0
  );
  return { id, nomor };
}

export async function updatePendaftar(id: number, updates: Partial<Pendaftar>): Promise<void> {
  // Build SET clause and parameter list with explicit placeholder numbers from
  // the start (Postgres doesn't accept skipped placeholders, so we can't just
  // use $1 everywhere and renumber).
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  const map: Record<keyof Pendaftar, string> = {
    id: "id",
    nomor: "nomor",
    nama: "nama",
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
    isSemiFinalist: "is_semi_finalist",
    createdAt: "created_at",
    updatedAt: "updated_at",
  };
  for (const [k, v] of Object.entries(updates)) {
    if (k === "id" || k === "createdAt" || k === "updatedAt") continue;
    const colName = map[k as keyof Pendaftar];
    if (!colName) continue;
    const paramIdx = vals.length + 1; // +1 because the WHERE id placeholder will be appended after
    if (k === "hadir") { sets.push(`hadir = $${paramIdx}`); vals.push(v ? 1 : 0); }
    else { sets.push(`${colName} = $${paramIdx}`); vals.push(v as string | number | null); }
  }
  if (updates.status === "ditolak") {
    const paramIdx = vals.length + 1;
    sets.push(`juara_rank = $${paramIdx}`);
    vals.push(null);
  }
  if (sets.length === 0) return;
  // updated_at is a fixed expression (no placeholder).
  sets.push("updated_at = EXTRACT(EPOCH FROM NOW())::bigint");
  // WHERE id = last placeholder
  const whereIdx = vals.length + 1;
  vals.push(id);
  await run(
    `UPDATE pendaftar SET ${sets.join(", ")} WHERE id = $${whereIdx}`,
    ...(vals as DbValue[])
  );
}

export async function deletePendaftar(id: number): Promise<void> {
  await run("DELETE FROM pendaftar WHERE id = $1", id);
}

export async function bulkCopyPendaftar(
  sourceLombaId: number,
  targetLombaId: number,
  targetEligibleKategori: string[]
): Promise<{ copied: number; skippedDuplicate: number; skippedKategori: number; copiedIds: number[] }> {
  const sourceRows = await getPendaftarByLomba(sourceLombaId, "disetujui");
  if (sourceRows.length === 0) {
    return { copied: 0, skippedDuplicate: 0, skippedKategori: 0, copiedIds: [] };
  }

  const targetRows = await getPendaftarByLomba(targetLombaId);
  const eligibleSet = new Set(targetEligibleKategori);
  const normalize = (s: string) => s.trim().toLowerCase();
  const existingNames = new Set(targetRows.map((p) => normalize(p.nama)));

  let copied = 0;
  let skippedDuplicate = 0;
  let skippedKategori = 0;
  const copiedIds: number[] = [];
  for (const src of sourceRows) {
    if (!eligibleSet.has(src.kategoriId)) {
      skippedKategori++;
      continue;
    }
    if (existingNames.has(normalize(src.nama))) {
      skippedDuplicate++;
      continue;
    }
    const result = await createPendaftar({
      nama: src.nama,
      jenisKelamin: src.jenisKelamin,
      kategoriId: src.kategoriId,
      umur: src.umur,
      lombaId: targetLombaId,
      sumber: "manual",
      hadir: true,
    });
    copiedIds.push(result.id);
    copied++;
    existingNames.add(normalize(src.nama));
  }
  return { copied, skippedDuplicate, skippedKategori, copiedIds };
}

// =================== Counts ===================
export async function countLombaAktif(): Promise<number> {
  const row = await get<{ c: number }>("SELECT COUNT(*) as c FROM lomba WHERE status = 'aktif'");
  return Number(row?.c ?? 0);
}

export async function countPendaftarByStatus(status: PendaftarStatus): Promise<number> {
  const row = await get<{ c: number }>("SELECT COUNT(*) as c FROM pendaftar WHERE status = $1", status);
  return Number(row?.c ?? 0);
}

export async function countAllPendaftar(): Promise<number> {
  const row = await get<{ c: number }>("SELECT COUNT(*) as c FROM pendaftar");
  return Number(row?.c ?? 0);
}

// Mirror countPendaftarByLomba's `status != 'ditolak'` filter so admin
// counts stay self-consistent. See Kupas Telor Puyuh incident 2026-08-10.
export async function countPendaftarHadir(lombaId?: number): Promise<number> {
  const row = lombaId
    ? await get<{ c: number }>("SELECT COUNT(*) as c FROM pendaftar WHERE hadir = 1 AND lomba_id = $1 AND status != 'ditolak'", lombaId)
    : await get<{ c: number }>("SELECT COUNT(*) as c FROM pendaftar WHERE hadir = 1 AND status != 'ditolak'");
  return Number(row?.c ?? 0);
}

export async function countPendaftarByLomba(lombaId: number, status?: PendaftarStatus): Promise<number> {
  const row = status
    ? await get<{ c: number }>("SELECT COUNT(*) as c FROM pendaftar WHERE lomba_id = $1 AND status = $2", lombaId, status)
    : await get<{ c: number }>(
        "SELECT COUNT(*) as c FROM pendaftar WHERE lomba_id = $1 AND status != 'ditolak'",
        lombaId
      );
  return Number(row?.c ?? 0);
}

// Batched variant — single SQL roundtrip for N lomba. Replaces the N+1 pattern
// where each lomba got its own COUNT(*). On Neon pooler (max=1 per Vercel
// instance) the N+1 pattern serialized 21 queries to ~10s for a 21-lomba home
// page. This version runs 1 query for all of them.
//
// pg requires JS arrays to be wrapped in an extra `[]` for parameter binding —
// the inner array becomes the Postgres int[] value.
export async function countPendaftarByLombaBatch(
  lombaIds: number[],
  status?: PendaftarStatus
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (lombaIds.length === 0) return map;
  // Build the SQL string + params based on whether `status` is provided.
  // Two separate strings (NOT a ternary on `all()`) so the bundler can't
  // collapse branches — the v1 bundler once dropped the 1-param branch and
  // shipped a query that expected 2 params when called with 1.
  const idsParam = [lombaIds];
  let rows: Array<{ lomba_id: number; c: number }>;
  if (status) {
    // Spread the args so each is a separate pg parameter ($1, $2).
    // DO NOT pass `[idsParam, status]` as a single array — that would bind
    // $1 = [idsParam, status] and leave $2 unbound (causing "bind message
    // supplies 1 parameters, but prepared statement requires 2").
    rows = await all<{ lomba_id: number; c: number }>(
      "SELECT lomba_id, COUNT(*) as c FROM pendaftar WHERE lomba_id = ANY($1) AND status = $2 GROUP BY lomba_id",
      idsParam,
      status
    );
  } else {
    rows = await all<{ lomba_id: number; c: number }>(
      "SELECT lomba_id, COUNT(*) as c FROM pendaftar WHERE lomba_id = ANY($1) AND status != 'ditolak' GROUP BY lomba_id",
      idsParam
    );
  }
  for (const r of rows) {
    map.set(Number(r.lomba_id), Number(r.c));
  }
  return map;
}

// =================== Public grouping ===================
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
  sections: DisplaySection[];
}> {
  const [rows, kats] = await Promise.all([
    all<{ nama: string; umur: number; jenis_kelamin: JenisKelamin; kategori_id: string; created_at: number }>(
      `SELECT nama, umur, jenis_kelamin, kategori_id, created_at
       FROM pendaftar
       WHERE lomba_id = $1 AND status = 'disetujui'
       ORDER BY created_at ASC`,
      lombaId
    ),
    getKategori(),
  ]);

  const katMap = new Map(kats.map((k) => [k.id, k]));

  const balita: typeof rows = [];
  const anakL: typeof rows = [];
  const anakP: typeof rows = [];
  const dewasa: typeof rows = [];

  for (const r of rows) {
    const k = katMap.get(r.kategori_id);
    if (!k) continue;
    const sec = sectionForKategori(k);
    if (sec === "balita") balita.push(r);
    else if (sec === "anak") {
      if (r.jenis_kelamin === "L") anakL.push(r);
      else anakP.push(r);
    } else dewasa.push(r);
  }

  const sortByUmur = (a: typeof rows[number], b: typeof rows[number]) =>
    a.umur - b.umur || a.created_at - b.created_at || 0;
  const sortByDaftar = (a: typeof rows[number], b: typeof rows[number]) =>
    a.created_at - b.created_at || 0;
  balita.sort(sortByUmur);
  anakL.sort(sortByUmur);
  anakP.sort(sortByUmur);
  dewasa.sort(sortByDaftar);

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

  const buildPeserta = (arr: typeof rows) => arr.map((r) => ({ nama: r.nama, umur: r.umur, jenisKelamin: r.jenis_kelamin, kategoriId: r.kategori_id }));

  const findNamaByMin = () => kats.find((k) => k.min === 0 && k.max === 4)?.nama || "Balita";
  const findAnakL = () => kats.find((k) => k.id === "k_anak_l")?.nama || "Anak (Laki-laki)";
  const findAnakP = () => kats.find((k) => k.id === "k_anak_p")?.nama || "Anak (Perempuan)";
  const findDewasaNama = () => {
    const dewasaKat = kats.find((k) => k.min >= 18);
    return dewasaKat?.nama || "Dewasa";
  };

  const sections: DisplaySection[] = [];
  if (balita.length > 0) {
    sections.push({ key: "balita", title: findNamaByMin(), rangeLabel: rangeFor("balita", "0–4 tahun"), peserta: buildPeserta(balita) });
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
type JuaraSlim = {
  pendaftarId: number;
  nama: string;
  kategoriId: string;
  juaraRank: 1 | 2 | 3;
  umur: number;
  jenisKelamin: JenisKelamin;
};

export async function setJuaraRank(
  pendaftarId: number,
  rank: number
): Promise<{ lombaId: number; kategoriId: string; rank: number } | null> {
  await ensureJuaraColumn();
  const p = await get<{ lomba_id: number; kategori_id: string }>(
    "SELECT lomba_id, kategori_id FROM pendaftar WHERE id = $1",
    pendaftarId
  );
  if (!p) return null;

  await run(
    `UPDATE pendaftar SET juara_rank = NULL
     WHERE lomba_id = $1 AND kategori_id = $2 AND juara_rank = $3 AND id != $4`,
    p.lomba_id,
    p.kategori_id,
    rank,
    pendaftarId
  );
  await run(
    "UPDATE pendaftar SET juara_rank = $1 WHERE id = $2",
    rank,
    pendaftarId
  );
  return { lombaId: p.lomba_id, kategoriId: p.kategori_id, rank };
}

export async function clearJuaraRank(pendaftarId: number): Promise<void> {
  await run(
    "UPDATE pendaftar SET juara_rank = NULL WHERE id = $1",
    pendaftarId
  );
}

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
     WHERE lomba_id = $1 AND juara_rank IS NOT NULL
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

export async function countJuaraByKategori(
  lombaId: number,
  kategoriId: string
): Promise<Record<1 | 2 | 3, number>> {
  await ensureJuaraColumn();
  const rows = await all<{ juara_rank: number; c: number }>(
    `SELECT juara_rank, COUNT(*) as c
     FROM pendaftar
     WHERE lomba_id = $1 AND kategori_id = $2 AND juara_rank IS NOT NULL
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

// Batched juara summary — single query for ALL (lomba, kategori) pairs.
// Replaces the per-lomba loop in /api/admin/lomba that called
// countJuaraByKategori 3-4 times per lomba (N×3 sequential queries).
//
// Caller passes the lomba list so we can use their `kategoriEligible` to
// determine `allReady` without refetching each lomba.
//
// Returns: { [lombaId]: { totalJuara: number; allReady: boolean } }
export async function getJuaraSummaryBatch(
  lombaList: Array<{ id: number; kategoriEligible?: string[] | null }>
): Promise<Record<number, { totalJuara: number; allReady: boolean }>> {
  await ensureJuaraColumn();
  const summary: Record<number, { totalJuara: number; allReady: boolean }> = {};
  if (lombaList.length === 0) return summary;
  for (const l of lombaList) {
    summary[l.id] = { totalJuara: 0, allReady: true };
  }

  // One query, GROUP BY (lomba_id, kategori_id, juara_rank). Returns at most
  // 3 rows per (lomba, kategori) that has winners.
  const rows = await all<{ lomba_id: number; kategori_id: string; juara_rank: number; c: number }>(
    `SELECT lomba_id, kategori_id, juara_rank, COUNT(*) as c
     FROM pendaftar
     WHERE juara_rank IS NOT NULL
     GROUP BY lomba_id, kategori_id, juara_rank`,
  );

  // Build (lombaId, kategoriId) → { ju1, ju2, ju3 } pivot
  const pivot = new Map<string, { ju1: number; ju2: number; ju3: number }>();
  for (const r of rows) {
    const key = `${r.lomba_id}|${r.kategori_id}`;
    let cell = pivot.get(key);
    if (!cell) {
      cell = { ju1: 0, ju2: 0, ju3: 0 };
      pivot.set(key, cell);
    }
    const rank = Number(r.juara_rank);
    if (rank === 1) cell.ju1 = Number(r.c);
    else if (rank === 2) cell.ju2 = Number(r.c);
    else if (rank === 3) cell.ju3 = Number(r.c);
    summary[Number(r.lomba_id)].totalJuara += Number(r.c);
  }

  // allReady = every eligible kategori has at least 1 ju1 AND 1 ju2
  for (const l of lombaList) {
    const eligible = Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [];
    if (eligible.length === 0) {
      // No eligible kategori — vacuously "ready" (no winners expected)
      continue;
    }
    for (const katId of eligible) {
      const cell = pivot.get(`${l.id}|${katId}`);
      if (!cell || cell.ju1 < 1 || cell.ju2 < 1) {
        summary[l.id].allReady = false;
        break;
      }
    }
  }

  return summary;
}

// =================== Finalist (stage system v4) ===================
export async function setFinalist(
  pendaftarId: number,
  status: 0 | 1 | null
): Promise<void> {
  await ensureKualifikasiV4Columns();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // pg.Pool.query signature: query(sql, params?) — params must be array.
      // If status is null we need to bind NULL, not "null" string.
      await getPool().query("UPDATE pendaftar SET is_finalist = $1 WHERE id = $2", [status, pendaftarId]);
      return;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
}

export async function setSemiFinalist(
  pendaftarId: number,
  status: 0 | 1 | null
): Promise<void> {
  await ensureKualifikasiV4Columns();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await getPool().query("UPDATE pendaftar SET is_semi_finalist = $1 WHERE id = $2", [status, pendaftarId]);
      return;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
}

type SemiFinalKategoriStatus = {
  lolos: number;
  gugur: number;
  pending: number;
  total: number;
  readyToTutup: boolean;
};

export async function getSemiFinalStatusByKategori(
  lombaId: number,
  kategoriId: string
): Promise<SemiFinalKategoriStatus> {
  await ensureKualifikasiV4Columns();
  const rows = await all<{ c: number; s: number | null }>(
    `SELECT is_semi_finalist as s, COUNT(*) as c
     FROM pendaftar
     WHERE lomba_id = $1 AND kategori_id = $2 AND status = 'disetujui'
       AND is_finalist = 1
     GROUP BY is_semi_finalist`,
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

type KualifikasiKategoriStatus = {
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
     WHERE lomba_id = $1 AND kategori_id = $2 AND status = 'disetujui'
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
