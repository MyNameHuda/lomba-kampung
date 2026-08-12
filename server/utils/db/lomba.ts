// Lomba CRUD + PJ management + Stage system (Tutup Kualifikasi / Semi Final).
// Postgres port. Differences vs libSQL version:
//   - ? placeholders → $1, $2, $3 ...
//   - INSERT uses `RETURNING id` instead of `lastInsertRowid`
import { all, get, returningId, run, type DbRow } from "./client";
import { toCamel, toCamelAll } from "./internal";
import {
  ensurePjMultiSupport,
  ensureKualifikasiColumns,
  ensureKualifikasiV4Columns,
  ensureLombaJadwalTable,
  ensurePendaftaranDibukaColumn,
  ensureTigaFaseColumns,
} from "./migrations";
import type { Lomba, LombaKategoriInput, Pj } from "./types";

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

function parseLombaKategoriTutup(phase: string | null | undefined): Record<string, number | null> {
  return parseFaseState(phase).kual;
}

type FaseState = {
  kual: Record<string, number | null>;
  semi: Record<string, number | null>;
};

function parseFaseState(phase: string | null | undefined): FaseState {
  const empty: FaseState = { kual: {}, semi: {} };
  if (!phase) return empty;
  try {
    const parsed = JSON.parse(phase);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return empty;

    if (parsed.kual || parsed.semi) {
      const cleanMap = (m: unknown): Record<string, number | null> => {
        if (typeof m !== 'object' || m === null) return {};
        const out: Record<string, number | null> = {};
        for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
          if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
          else if (v === null) out[k] = null;
        }
        return out;
      };
      return {
        kual: cleanMap(parsed.kual),
        semi: cleanMap(parsed.semi),
      };
    }

    const kual: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) kual[k] = v;
      else if (v === null) kual[k] = null;
    }
    return { kual, semi: {} };
  } catch {
    return empty;
  }
}

async function loadKategoriTutupBulk(): Promise<Map<number, FaseState>> {
  try {
    const rows = await all<{ id: number; phase: string | null }>(
      "SELECT id, phase FROM lomba WHERE phase IS NOT NULL"
    );
    const map = new Map<number, FaseState>();
    for (const r of rows) {
      const state = parseFaseState(r.phase);
      if (Object.keys(state.kual).length > 0 || Object.keys(state.semi).length > 0) {
        map.set(r.id, state);
      }
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
  tutupBulk: Map<number, FaseState>
): T & { kategoriTutupAt: FaseState } {
  return { ...row, kategoriTutupAt: tutupBulk.get(row.id) || { kual: {}, semi: {} } };
}

function attachJadwal<T extends { id: number }>(
  row: T,
  jadwalBulk: Map<number, Record<string, JadwalEntry>>
): T & { jadwalByKategori: Record<string, JadwalEntry> } {
  return { ...row, jadwalByKategori: jadwalBulk.get(row.id) || {} };
}

// =================== Read ===================
export async function getLomba(includeInactive = false): Promise<Lomba[]> {
  await Promise.all([ensureKualifikasiColumns(), ensurePendaftaranDibukaColumn(), ensureTigaFaseColumns()]);
  const sql = includeInactive
    ? "SELECT * FROM lomba ORDER BY urutan"
    : "SELECT * FROM lomba WHERE status = 'aktif' ORDER BY urutan";
  const rows = toCamelAll<Lomba>(await all<DbRow>(sql));
  const [pjBulk, tutupBulk, jadwalBulk] = await Promise.all([loadPjBulk(), loadKategoriTutupBulk(), loadJadwalBulk()]);
  return rows.map((r) => attachJadwal(attachKategoriTutup(attachPj(r, pjBulk), tutupBulk), jadwalBulk));
}

export async function getLombaById(id: number): Promise<Lomba | null> {
  await Promise.all([ensureKualifikasiColumns(), ensurePendaftaranDibukaColumn(), ensureTigaFaseColumns()]);
  const row = toCamel<Lomba>(await get<DbRow>("SELECT * FROM lomba WHERE id = $1", id));
  if (!row) return null;
  const [pjBulk, tutupBulk, jadwalBulk] = await Promise.all([loadPjBulk(), loadKategoriTutupBulk(), loadJadwalBulk()]);
  return attachJadwal(attachKategoriTutup(attachPj(row, pjBulk), tutupBulk), jadwalBulk);
}

// =================== Write ===================
export async function createLomba(data: Omit<Lomba, "id" | "createdAt" | "pjByKategori" | "kategoriTutupAt" | "jadwalByKategori">): Promise<number> {
  await Promise.all([ensureKualifikasiColumns(), ensurePendaftaranDibukaColumn(), ensureTigaFaseColumns()]);
  return await returningId<{ id: number }>(
    `INSERT INTO lomba (nama, emoji, deskripsi, syarat, kategori_eligible, status, urutan, finalis_count, phase, pendaftaran_dibuka, fase_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    data.nama,
    data.emoji,
    data.deskripsi,
    JSON.stringify(data.syarat || []),
    JSON.stringify(data.kategoriEligible || []),
    data.status,
    data.urutan,
    data.finalisCount,
    data.phase,
    data.pendaftaranDibuka ? 1 : 0,
    data.faseEnabled ? 1 : 0
  );
}

export async function setLombaKategori(lombaId: number, list: LombaKategoriInput[]): Promise<void> {
  await ensurePjMultiSupport();
  await run("DELETE FROM lomba_kategori WHERE lomba_id = $1", lombaId);
  const urutanByKat = new Map<string, number>();
  for (const pj of list) {
    const urutan = urutanByKat.get(pj.kategoriId) ?? 0;
    urutanByKat.set(pj.kategoriId, urutan + 1);
    await run(
      "INSERT INTO lomba_kategori (lomba_id, kategori_id, pj_nama, pj_kontak, urutan) VALUES ($1, $2, $3, $4, $5)",
      lombaId,
      pj.kategoriId,
      pj.pjNama,
      pj.pjKontak,
      urutan
    );
  }
}

export async function updateLomba(id: number, updates: Partial<Omit<Lomba, "id" | "createdAt" | "pjByKategori" | "kategoriTutupAt" | "phase" | "jadwalByKategori">>): Promise<void> {
  await ensurePendaftaranDibukaColumn();
  const map: Record<string, string> = {
    nama: "nama",
    emoji: "emoji",
    deskripsi: "deskripsi",
    status: "status",
    urutan: "urutan",
    finalisCount: "finalis_count",
    pendaftaranDibuka: "pendaftaran_dibuka",
    faseEnabled: "fase_enabled",
  };
  // Build SET clause with explicit placeholder numbering (Postgres needs
  // $1, $2, $3, ... in order — can't skip).
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(updates)) {
    if (k === "syarat") {
      sets.push(`syarat = $${vals.length + 1}`);
      vals.push(JSON.stringify(v));
    } else if (k === "kategoriEligible") {
      sets.push(`kategori_eligible = $${vals.length + 1}`);
      vals.push(JSON.stringify(v));
    } else if (k === "pendaftaranDibuka") {
      sets.push(`pendaftaran_dibuka = $${vals.length + 1}`);
      vals.push(v ? 1 : 0);
    } else if (k === "faseEnabled") {
      sets.push(`fase_enabled = $${vals.length + 1}`);
      vals.push(v ? 1 : 0);
    } else if (map[k]) {
      sets.push(`${map[k]} = $${vals.length + 1}`);
      vals.push(v as string | number | null);
    }
  }
  if (sets.length > 0) {
    vals.push(id);
    await run(
      `UPDATE lomba SET ${sets.join(", ")} WHERE id = $${vals.length}`,
      ...(vals as any[])
    );
  }
}

export async function deleteLomba(id: number): Promise<void> {
  await run("DELETE FROM pendaftar WHERE lomba_id = $1", id);
  await run("DELETE FROM lomba WHERE id = $1", id);
}

// =================== Juara readiness (stage system) ===================
import { countJuaraByKategori } from "./pendaftar";

type JuaraReadiness = {
  allReady: boolean;
  missingKategori: string[];
  perKategori: Record<string, { ju1: number; ju2: number; ju3: number }>;
};

export async function getJuaraReadiness(lombaId: number): Promise<JuaraReadiness> {
  const lomba = await getLombaById(lombaId);
  if (!lomba) {
    return { allReady: false, missingKategori: [], perKategori: {} };
  }
  const perKategori: Record<string, { ju1: number; ju2: number; ju3: number }> = {};
  const missingKategori: string[] = [];
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

export async function markLombaSelesai(lombaId: number): Promise<void> {
  await run(
    "UPDATE lomba SET status = 'selesai' WHERE id = $1 AND status = 'aktif'",
    lombaId
  );
}

// =================== Per-kategori Tutup Kualifikasi (stage system v4) ===================
export async function tutupKualifikasiKategori(
  lombaId: number,
  kategoriId: string
): Promise<boolean> {
  await ensureKualifikasiV4Columns();
  const pendingRow = await get<{ c: number }>(
    `SELECT COUNT(*) as c FROM pendaftar
     WHERE lomba_id = $1 AND kategori_id = $2 AND status = 'disetujui'
       AND is_finalist IS NULL`,
    lombaId,
    kategoriId
  );
  if ((pendingRow?.c ?? 0) > 0) return false;
  const row = await get<{ phase: string | null }>(
    "SELECT phase FROM lomba WHERE id = $1",
    lombaId
  );
  const map = parseLombaKategoriTutup(row?.phase);
  map[kategoriId] = Date.now();
  await run(
    "UPDATE lomba SET phase = $1 WHERE id = $2",
    JSON.stringify(map),
    lombaId
  );
  return true;
}

export async function bukaKualifikasiKategori(
  lombaId: number,
  kategoriId: string
): Promise<boolean> {
  await ensureKualifikasiV4Columns();
  const juaraRow = await get<{ c: number }>(
    `SELECT COUNT(*) as c FROM pendaftar
     WHERE lomba_id = $1 AND kategori_id = $2 AND juara_rank IS NOT NULL`,
    lombaId,
    kategoriId
  );
  if ((juaraRow?.c ?? 0) > 0) return false;
  const row = await get<{ phase: string | null }>(
    "SELECT phase FROM lomba WHERE id = $1",
    lombaId
  );
  const state = parseFaseState(row?.phase);
  delete state.kual[kategoriId];
  await run(
    "UPDATE lomba SET phase = $1 WHERE id = $2",
    JSON.stringify(state),
    lombaId
  );
  return true;
}

async function writeFaseState(lombaId: number, next: FaseState): Promise<void> {
  await run(
    "UPDATE lomba SET phase = $1 WHERE id = $2",
    JSON.stringify(next),
    lombaId
  );
}

export async function tutupSemiFinal(
  lombaId: number,
  kategoriId: string
): Promise<boolean> {
  await ensureKualifikasiV4Columns();
  const lombaRow = await get<{ fase_enabled: number | null }>(
    "SELECT fase_enabled FROM lomba WHERE id = $1",
    lombaId
  );
  if (!lombaRow || lombaRow.fase_enabled !== 1) return false;
  const phaseRow = await get<{ phase: string | null }>(
    "SELECT phase FROM lomba WHERE id = $1",
    lombaId
  );
  const state = parseFaseState(phaseRow?.phase);
  if (state.kual[kategoriId] == null) return false;
  const pendingRow = await get<{ c: number }>(
    `SELECT COUNT(*) as c FROM pendaftar
     WHERE lomba_id = $1 AND kategori_id = $2 AND status = 'disetujui'
       AND is_finalist = 1
       AND is_semi_finalist IS NULL`,
    lombaId,
    kategoriId
  );
  if ((pendingRow?.c ?? 0) > 0) return false;
  state.semi[kategoriId] = Date.now();
  await writeFaseState(lombaId, state);
  return true;
}

export async function bukaSemiFinal(
  lombaId: number,
  kategoriId: string
): Promise<boolean> {
  await ensureKualifikasiV4Columns();
  const juaraRow = await get<{ c: number }>(
    `SELECT COUNT(*) as c FROM pendaftar
     WHERE lomba_id = $1 AND kategori_id = $2 AND juara_rank IS NOT NULL`,
    lombaId,
    kategoriId
  );
  if ((juaraRow?.c ?? 0) > 0) return false;
  const phaseRow = await get<{ phase: string | null }>(
    "SELECT phase FROM lomba WHERE id = $1",
    lombaId
  );
  const state = parseFaseState(phaseRow?.phase);
  delete state.semi[kategoriId];
  await writeFaseState(lombaId, state);
  return true;
}

// =================== Jadwal Pelaksanaan (per-kategori) ===================
type JadwalEntry = {
  kategoriId: string;
  tanggal: number | null;
  jam: string | null;
};

async function loadJadwalBulk(): Promise<Map<number, Record<string, JadwalEntry>>> {
  await ensureLombaJadwalTable();
  try {
    const rows = await all<{ lomba_id: number; kategori_id: string; tanggal: number | null; jam: string | null }>(
      "SELECT lomba_id, kategori_id, tanggal, jam FROM lomba_jadwal WHERE tanggal IS NOT NULL OR jam IS NOT NULL"
    );
    const map = new Map<number, Record<string, JadwalEntry>>();
    for (const r of rows) {
      let inner = map.get(r.lomba_id);
      if (!inner) { inner = {}; map.set(r.lomba_id, inner); }
      inner[r.kategori_id] = {
        kategoriId: r.kategori_id,
        tanggal: r.tanggal,
        jam: r.jam,
      };
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function setLombaJadwal(lombaId: number, list: JadwalEntry[]): Promise<void> {
  await ensureLombaJadwalTable();
  await run("DELETE FROM lomba_jadwal WHERE lomba_id = $1", lombaId);
  for (const j of list) {
    if (j.tanggal === null && j.jam === null) continue;
    await run(
      "INSERT INTO lomba_jadwal (lomba_id, kategori_id, tanggal, jam) VALUES ($1, $2, $3, $4)",
      lombaId,
      j.kategoriId,
      j.tanggal,
      j.jam
    );
  }
}
