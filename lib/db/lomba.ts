// Lomba CRUD + PJ (penanggung jawab) management.
// A lomba has many kategori, each kategori can have multiple PJs (multi-PJ
// enabled via the (lomba_id, kategori_id, urutan) composite PK — see migrations.ts).
import { all, get, run, type DbRow } from "./client";
import { toCamel, toCamelAll } from "./internal";
import { ensurePjMultiSupport } from "./migrations";
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

function attachPj<T extends { id: number }>(row: T, pjBulk: Map<number, Record<string, Pj[]>>): T & { pjByKategori: Record<string, Pj[]> } {
  return { ...row, pjByKategori: pjBulk.get(row.id) || {} };
}

// =================== Read ===================
export async function getLomba(includeInactive = false): Promise<Lomba[]> {
  const sql = includeInactive
    ? "SELECT * FROM lomba ORDER BY urutan"
    : "SELECT * FROM lomba WHERE status = 'aktif' ORDER BY urutan";
  const rows = toCamelAll<Lomba>(await all<DbRow>(sql));
  const pjBulk = await loadPjBulk();
  return rows.map((r) => attachPj(r, pjBulk));
}

export async function getLombaById(id: number): Promise<Lomba | null> {
  const row = toCamel<Lomba>(await get<DbRow>("SELECT * FROM lomba WHERE id = ?", id));
  if (!row) return null;
  const pjBulk = await loadPjBulk();
  return attachPj(row, pjBulk);
}

export async function getLombaWithCount(): Promise<{ id: number; nama: string; emoji: string; count: number; pjByKategori: Record<string, Pj[]> }[]> {
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
    await run(`UPDATE lomba SET ${sets.join(", ")} WHERE id = ?`, ...(vals as any[]));
  }
}

export async function deleteLomba(id: number): Promise<void> {
  // lomba_kategori cascades via FK ON DELETE CASCADE; pendaftar cascade manually
  await run("DELETE FROM pendaftar WHERE lomba_id = ?", id);
  await run("DELETE FROM lomba WHERE id = ?", id);
}
