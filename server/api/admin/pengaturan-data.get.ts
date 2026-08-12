// GET /api/admin/pengaturan-data — settings + kategori for the pengaturan page
import { defineEventHandler } from "h3";
import { requireAuth } from "~~/server/utils/auth";
import { getSettings } from "~~/server/utils/db/settings";
import { getKategori } from "~~/server/utils/db/kategori";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const [cfg, kats] = await Promise.all([getSettings(), getKategori()]);
  return {
    cfg: cfg ? { appName: cfg.appName, kampungName: cfg.kampungName, tahunAktif: cfg.tahunAktif } : null,
    kats: kats.map((k) => ({ id: k.id, nama: k.nama, icon: k.icon, min: k.min, max: k.max, urutan: k.urutan, autoAge: k.autoAge, inputMode: k.inputMode, colorBg: k.colorBg, colorText: k.colorText, colorBorder: k.colorBorder })),
  };
});
