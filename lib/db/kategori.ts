// Kategori CRUD — age-group definitions (Balita, Anak, Dewasa, etc).
// Each kategori has its own min/max age range, color, and icon.
import { all, get, run } from "./client";
import { toCamelAll } from "./internal";
import { ensureKategoriColorColumns } from "./migrations";
import type { Kategori } from "./types";

export async function getKategori(): Promise<Kategori[]> {
  // Self-healing: ensure color columns exist before reading them.
  await ensureKategoriColorColumns();
  const rows = await all("SELECT * FROM kategori ORDER BY urutan, min");
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
