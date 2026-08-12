// Backup / reset — used by admin settings page. No placeholder changes needed
// (all statements are parameter-free DELETEs).
import { run } from "./client";
import { getSettings } from "./settings";
import { getKategori } from "./kategori";
import { getLomba } from "./lomba";
import { getPendaftar } from "./pendaftar";
import type { Kategori, Lomba, Pendaftar, Settings } from "./types";

export async function exportAllData(): Promise<{
  settings: Settings | null;
  kategori: Kategori[];
  lomba: Lomba[];
  pendaftar: Pendaftar[];
  exportedAt: string;
}> {
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
  await run("DELETE FROM pendaftar");
  if (!keepKategori) await run("DELETE FROM kategori");
  await run("DELETE FROM lomba");
}
