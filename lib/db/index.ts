// @libsql/client — works with both local SQLite file (file:./lomba.db) and
// Turso remote (libsql://... + auth token). Same query API as node:sqlite
// but the client is async (HTTP-based for remote, native binding for local).
import { createClient, type Client, type InValue } from "@libsql/client";
import path from "node:path";

// =================== Client ===================
type GlobalWithDb = typeof globalThis & { __libsqlClient?: Client };
const globalForDb = globalThis as GlobalWithDb;

/**
 * Resolve a libSQL URL.
 *  - `libsql://...` and `https://...`  → returned as-is (Turso / remote)
 *  - `file:./relative`                  → resolved to absolute path against cwd
 *  - `file:./relative` (Windows)        → normalized with backslashes
 *  - bare path                          → wrapped as `file:`
 *  - default                            → `file:<cwd>/lomba.db`
 */
function resolveDbUrl(rawUrl: string | undefined): string {
  if (!rawUrl) {
    return `file:${path.join(process.cwd(), "lomba.db")}`;
  }
  // Strip BOM + any other invisible whitespace that Vercel/PowerShell might inject
  const url = rawUrl.replace(/^[\uFEFF\u200B-\u200D\u2060\u00A0\s]+/, "").trim();
  if (url.startsWith("libsql://") || url.startsWith("https://") || rawUrl === ":memory:") {
    return url;
  }
  if (url.startsWith("file:")) {
    const rest = url.slice("file:".length);
    // Already absolute (file:/abs or file:///abs)
    if (rest.startsWith("/") || rest.startsWith("\\")) {
      return `file:${rest}`;
    }
    // Relative — resolve against cwd
    const abs = path.resolve(process.cwd(), rest);
    return `file:${abs}`;
  }
  // Bare path
  return `file:${path.resolve(process.cwd(), url)}`;
}

function getClient(): Client {
  if (globalForDb.__libsqlClient) return globalForDb.__libsqlClient;
  const url = resolveDbUrl(process.env.DATABASE_URL);
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  // Cache the client in dev to survive hot reloads; in production it's a single instance per Lambda.
  if (process.env.NODE_ENV !== "production") globalForDb.__libsqlClient = client;
  return client;
}

// =================== Query helpers ===================
// Thin async wrappers around client.execute so call sites read naturally.
// `args` accepts undefined, null, string, number, bigint, boolean, Uint8Array.
async function all<T = Record<string, unknown>>(sql: string, ...args: InValue[]): Promise<T[]> {
  const result = await getClient().execute({ sql, args });
  return (result.rows ?? []) as T[];
}

// Idempotent migration helper for adding new columns to existing tables.
// SQLite has no "ADD COLUMN IF NOT EXISTS", so we check PRAGMA table_info first.
async function ensureColumn(table: string, column: string, definition: string): Promise<void> {
  const cols = await all<{ name: string }>(`PRAGMA table_info(${table})`);
  if (cols.some((c) => c.name === column)) return;
  await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

// Self-healing: ensure the kategori table has the color columns.
// Safe to call repeatedly — no-op once columns exist.
export async function ensureKategoriColorColumns(): Promise<void> {
  await ensureColumn("kategori", "color_bg", "TEXT NOT NULL DEFAULT '#FEF3C7'");
  await ensureColumn("kategori", "color_text", "TEXT NOT NULL DEFAULT '#92400E'");
  await ensureColumn("kategori", "color_border", "TEXT NOT NULL DEFAULT '#FDE68A'");
}

async function get<T = Record<string, unknown>>(sql: string, ...args: InValue[]): Promise<T | undefined> {
  const result = await getClient().execute({ sql, args });
  const row = result.rows?.[0];
  return row as T | undefined;
}

async function run(sql: string, ...args: InValue[]): Promise<{ lastInsertRowid: number | bigint; changes: number }> {
  const result = await getClient().execute({ sql, args });
  return {
    lastInsertRowid: result.lastInsertRowid ?? 0n,
    changes: result.rowsAffected ?? 0,
  };
}

// Multi-statement script (for schema push, migrations). Uses `execute` which accepts
// multi-statement SQL separated by `;` — libSQL executes them in order.
async function exec(sql: string): Promise<void> {
  await getClient().execute(sql);
}

// =================== Types ===================
export type Settings = {
  id: number;
  appName: string;
  kampungName: string;
  tahunAktif: string;
  adminPasswordHash: string;
  updatedAt: number;
};

export type Kategori = {
  id: string;
  nama: string;
  icon: string;
  min: number;
  max: number;
  urutan: number;
  autoAge: boolean;
  colorBg: string;
  colorText: string;
  colorBorder: string;
  createdAt: number;
};

export type Lomba = {
  id: number;
  nama: string;
  emoji: string;
  deskripsi: string | null;
  syarat: string[];
  kategoriEligible: string[];
  status: "draft" | "aktif" | "selesai";
  urutan: number;
  createdAt: number;
  // PJ per eligible kategori (keyed by kategoriId). May be empty if lomba has no eligible kategori yet.
  pjByKategori: Record<string, { nama: string; kontak: string | null }>;
};

export type LombaKategoriInput = {
  kategoriId: string;
  pjNama: string;
  pjKontak: string | null;
};

export type Pendaftar = {
  id: number;
  nomor: string;
  nama: string;
  noWa: string | null;
  jenisKelamin: "L" | "P";
  kategoriId: string;
  umur: number;
  lombaId: number;
  status: "pending" | "disetujui" | "ditolak";
  alasanTolak: string | null;
  sumber: "publik" | "manual";
  hadir: boolean;
  createdAt: number;
  updatedAt: number;
};

// =================== Helpers ===================
// Convert snake_case DB row to camelCase object
type Row = Record<string, unknown>;
const toCamel = <T>(row: Row | undefined): T | null => {
  if (!row) return null;
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    const camelKey = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    let val = v;
    if (typeof val === "bigint") val = Number(val);
    if (camelKey === "kategoriEligible") {
      if (typeof val === "string") {
        try { val = JSON.parse(val); } catch { val = []; }
      }
      if (!Array.isArray(val)) val = [];
    }
    if (camelKey === "syarat") {
      if (typeof val === "string") {
        try { val = JSON.parse(val); } catch { val = []; }
      }
      if (!Array.isArray(val)) val = [];
    }
    if (typeof camelKey === "string" && camelKey === "hadir") {
      val = !!val;
    }
    if (typeof camelKey === "string" && camelKey === "autoAge") {
      val = !!val;
    }
    out[camelKey] = val;
  }
  return out as T;
};

const toCamelAll = <T>(rows: Row[]): T[] => rows.map((r) => toCamel<T>(r)!).filter(Boolean) as T[];

// =================== Settings ===================
export async function getSettings(): Promise<Settings | null> {
  const row = await get<Row>("SELECT * FROM settings ORDER BY id LIMIT 1");
  return toCamel<Settings>(row);
}

export async function updateSettings(s: { appName: string; kampungName: string; tahunAktif: string }): Promise<void> {
  const existing = await getSettings();
  if (existing) {
    await run(
      "UPDATE settings SET app_name = ?, kampung_name = ?, tahun_aktif = ?, updated_at = unixepoch() WHERE id = ?",
      s.appName,
      s.kampungName,
      s.tahunAktif,
      existing.id
    );
  } else {
    await run(
      "INSERT INTO settings (app_name, kampung_name, tahun_aktif, admin_password_hash) VALUES (?, ?, ?, ?)",
      s.appName,
      s.kampungName,
      s.tahunAktif,
      ""
    );
  }
}

export async function updateAdminPassword(newHash: string): Promise<void> {
  const existing = await getSettings();
  if (existing) {
    await run(
      "UPDATE settings SET admin_password_hash = ?, updated_at = unixepoch() WHERE id = ?",
      newHash,
      existing.id
    );
  } else {
    await run(
      "INSERT INTO settings (app_name, kampung_name, tahun_aktif, admin_password_hash) VALUES (?, ?, ?, ?)",
      "Lomba Kampung",
      "Kampung Merdeka",
      "HUT RI ke-81 (2026)",
      newHash
    );
  }
}

// =================== Backup / Reset ===================
export async function exportAllData(): Promise<{ settings: Settings | null; kategori: Kategori[]; lomba: Lomba[]; pendaftar: Pendaftar[]; exportedAt: string }> {
  const [settings, kategori, lomba, pendaftar] = await Promise.all([
    getSettings(),
    getKategori(),
    getLomba(true),
    getPendaftar(),
  ]);
  return {
    settings,
    kategori,
    lomba,
    pendaftar,
    exportedAt: new Date().toISOString(),
  };
}

export async function resetAllData(keepKategori = true): Promise<void> {
  // Delete all pendaftar and lomba; optionally keep kategori
  await run("DELETE FROM pendaftar");
  if (!keepKategori) await run("DELETE FROM kategori");
  await run("DELETE FROM lomba");
}

// =================== Kategori ===================
export async function getKategori(): Promise<Kategori[]> {
  // Self-healing: ensure color columns exist before reading them.
  await ensureKategoriColorColumns();
  const rows = await all<Row>("SELECT * FROM kategori ORDER BY urutan, min");
  return toCamelAll<Kategori>(rows);
}

export async function upsertKategori(k: Omit<Kategori, "createdAt">): Promise<void> {
  const existing = await get<{ id: string }>("SELECT id FROM kategori WHERE id = ?", k.id);
  if (existing) {
    await run(
      "UPDATE kategori SET nama = ?, icon = ?, min = ?, max = ?, urutan = ?, auto_age = ?, color_bg = ?, color_text = ?, color_border = ? WHERE id = ?",
      k.nama,
      k.icon,
      k.min,
      k.max,
      k.urutan,
      k.autoAge ? 1 : 0,
      k.colorBg,
      k.colorText,
      k.colorBorder,
      k.id
    );
  } else {
    await run(
      "INSERT INTO kategori (id, nama, icon, min, max, urutan, auto_age, color_bg, color_text, color_border) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      k.id,
      k.nama,
      k.icon,
      k.min,
      k.max,
      k.urutan,
      k.autoAge ? 1 : 0,
      k.colorBg,
      k.colorText,
      k.colorBorder
    );
  }
}

export async function deleteKategori(id: string): Promise<void> {
  await run("DELETE FROM kategori WHERE id = ?", id);
}

// =================== Lomba ===================
// Load pjByKategori for many lomba at once (avoid N+1)
async function loadPjBulk(): Promise<Map<number, Record<string, { nama: string; kontak: string | null }>>> {
  const rows = await all<{ lomba_id: number; kategori_id: string; pj_nama: string; pj_kontak: string | null }>(
    "SELECT lomba_id, kategori_id, pj_nama, pj_kontak FROM lomba_kategori ORDER BY lomba_id, urutan"
  );
  const map = new Map<number, Record<string, { nama: string; kontak: string | null }>>();
  for (const r of rows) {
    let m = map.get(r.lomba_id);
    if (!m) { m = {}; map.set(r.lomba_id, m); }
    m[r.kategori_id] = { nama: r.pj_nama, kontak: r.pj_kontak };
  }
  return map;
}

function attachPj<T extends { id: number }>(row: T, pjBulk: Map<number, Record<string, { nama: string; kontak: string | null }>>): T & { pjByKategori: Record<string, { nama: string; kontak: string | null }> } {
  return { ...row, pjByKategori: pjBulk.get(row.id) || {} };
}

export async function getLomba(includeInactive = false): Promise<Lomba[]> {
  const sql = includeInactive
    ? "SELECT * FROM lomba ORDER BY urutan"
    : "SELECT * FROM lomba WHERE status = 'aktif' ORDER BY urutan";
  const rows = toCamelAll<Lomba>(await all<Row>(sql));
  const pjBulk = await loadPjBulk();
  return rows.map((r) => attachPj(r, pjBulk));
}

export async function getLombaById(id: number): Promise<Lomba | null> {
  const row = toCamel<Lomba>(await get<Row>("SELECT * FROM lomba WHERE id = ?", id));
  if (!row) return null;
  const pjBulk = await loadPjBulk();
  return attachPj(row, pjBulk);
}

export async function getLombaWithCount(): Promise<{ id: number; nama: string; emoji: string; count: number; pjByKategori: Record<string, { nama: string; kontak: string | null }> }[]> {
  const rows = await all<Row>(`
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

export async function createLomba(data: Omit<Lomba, "id" | "createdAt" | "pjByKategori">): Promise<number> {
  const result = await run(
    `INSERT INTO lomba (nama, emoji, deskripsi, syarat, kategori_eligible, status, urutan)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    data.nama,
    data.emoji,
    data.deskripsi,
    JSON.stringify(data.syarat || []),
    JSON.stringify(data.kategoriEligible || []),
    data.status,
    data.urutan
  );
  return Number(result.lastInsertRowid);
}

export async function setLombaKategori(lombaId: number, list: LombaKategoriInput[]): Promise<void> {
  // Replace all pj rows for this lomba with the new list
  await run("DELETE FROM lomba_kategori WHERE lomba_id = ?", lombaId);
  let idx = 0;
  for (const pj of list) {
    await run(
      "INSERT INTO lomba_kategori (lomba_id, kategori_id, pj_nama, pj_kontak, urutan) VALUES (?, ?, ?, ?, ?)",
      lombaId,
      pj.kategoriId,
      pj.pjNama,
      pj.pjKontak,
      idx
    );
    idx++;
  }
}

export async function updateLomba(id: number, updates: Partial<Omit<Lomba, "id" | "createdAt" | "pjByKategori">>): Promise<void> {
  const map: Record<string, string> = {
    nama: "nama",
    emoji: "emoji",
    deskripsi: "deskripsi",
    status: "status",
    urutan: "urutan",
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
    await run(`UPDATE lomba SET ${sets.join(", ")} WHERE id = ?`, ...(vals as InValue[]));
  }
}

export async function deleteLomba(id: number): Promise<void> {
  // lomba_kategori cascades via FK ON DELETE CASCADE; pendaftar cascade manually
  await run("DELETE FROM pendaftar WHERE lomba_id = ?", id);
  await run("DELETE FROM lomba WHERE id = ?", id);
}

// =================== Pendaftar ===================
export async function getPendaftar(): Promise<Pendaftar[]> {
  const rows = await all<Row>("SELECT * FROM pendaftar ORDER BY created_at DESC");
  return toCamelAll<Pendaftar>(rows);
}

export async function getPendaftarByLomba(lombaId: number, status?: Pendaftar["status"]): Promise<Pendaftar[]> {
  const sql = status
    ? "SELECT * FROM pendaftar WHERE lomba_id = ? AND status = ? ORDER BY nomor"
    : "SELECT * FROM pendaftar WHERE lomba_id = ? ORDER BY nomor";
  const params: InValue[] = status ? [lombaId, status] : [lombaId];
  const rows = await all<Row>(sql, ...params);
  return toCamelAll<Pendaftar>(rows);
}

export async function getPendaftarByNomor(nomor: string): Promise<Pendaftar | null> {
  return toCamel<Pendaftar>(await get<Row>("SELECT * FROM pendaftar WHERE nomor = ?", nomor));
}

export async function createPendaftar(
  data: Omit<Pendaftar, "id" | "nomor" | "createdAt" | "updatedAt" | "status" | "alasanTolak" | "hadir"> & {
    status?: Pendaftar["status"];
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
  await run(`UPDATE pendaftar SET ${sets.join(", ")} WHERE id = ?`, ...(vals as InValue[]));
}

export async function deletePendaftar(id: number): Promise<void> {
  await run("DELETE FROM pendaftar WHERE id = ?", id);
}

// =================== Counts ===================
export async function countLombaAktif(): Promise<number> {
  const row = await get<{ c: number }>("SELECT COUNT(*) as c FROM lomba WHERE status = 'aktif'");
  return Number(row?.c ?? 0);
}
export async function countPendaftarByStatus(status: Pendaftar["status"]): Promise<number> {
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
export async function countPendaftarByLomba(lombaId: number, status?: Pendaftar["status"]): Promise<number> {
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

// Section classification: given a kategoriId, return which display section it belongs to
type SectionKind = "balita" | "anak" | "dewasa";
function sectionForKategori(k: { min: number; max: number }): SectionKind {
  if (k.min < 5) return "balita";
  if (k.min < 18) return "anak";
  return "dewasa";
}

// DisplaySection.key is the final rendered key (with L/P split for anak)
export type DisplaySectionKey = "balita" | "anakL" | "anakP" | "dewasa";
export type DisplaySection = {
  key: DisplaySectionKey;
  title: string;
  rangeLabel: string; // e.g. "0–4 tahun", "5–17 tahun", "18+ tahun"
  peserta: { nama: string; umur: number; jenisKelamin: "L" | "P" }[];
};

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
    all<{ nama: string; umur: number; jenis_kelamin: "L" | "P"; kategori_id: string; created_at: number }>(
      "SELECT nama, umur, jenis_kelamin, kategori_id, created_at FROM pendaftar WHERE lomba_id = ? AND status = 'disetujui'",
      lombaId
    ),
    await getKategori(),
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
  const buildPeserta = (arr: typeof rows) => arr.map((r) => ({ nama: r.nama, umur: r.umur, jenisKelamin: r.jenis_kelamin as "L" | "P" }));

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
