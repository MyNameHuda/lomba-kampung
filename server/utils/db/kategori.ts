// Kategori CRUD — age-group definitions. Postgres port.
import { all, get, run } from "./client";
import { toCamelAll } from "./internal";
import { ensureKategoriColorColumns, ensureKategoriInputModeColumn, ensureGenderSplitKategori } from "./migrations";
import type { Kategori } from "./types";

export async function getKategori(): Promise<Kategori[]> {
  await ensureKategoriColorColumns();
  await ensureKategoriInputModeColumn();
  await ensureGenderSplitKategori();
  const rows = await all("SELECT * FROM kategori ORDER BY urutan, min");
  return toCamelAll<Kategori>(rows);
}

export async function upsertKategori(k: Omit<Kategori, "createdAt">): Promise<void> {
  const existing = await get<{ id: string }>("SELECT id FROM kategori WHERE id = $1", k.id);
  if (existing) {
    await run(
      `UPDATE kategori SET nama = $1, icon = $2, min = $3, max = $4, urutan = $5,
       auto_age = $6, input_mode = $7, color_bg = $8, color_text = $9, color_border = $10
       WHERE id = $11`,
      k.nama,
      k.icon,
      k.min,
      k.max,
      k.urutan,
      k.autoAge ? 1 : 0,
      k.inputMode,
      k.colorBg,
      k.colorText,
      k.colorBorder,
      k.id
    );
  } else {
    await run(
      `INSERT INTO kategori (id, nama, icon, min, max, urutan, auto_age, input_mode, color_bg, color_text, color_border)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      k.id,
      k.nama,
      k.icon,
      k.min,
      k.max,
      k.urutan,
      k.autoAge ? 1 : 0,
      k.inputMode,
      k.colorBg,
      k.colorText,
      k.colorBorder
    );
  }
}

export async function deleteKategori(id: string): Promise<void> {
  await run("DELETE FROM kategori WHERE id = $1", id);
}
