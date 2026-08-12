// GET /api/public/pendaftar-sukses/[nomor] — data for the success page
import { defineEventHandler, getRouterParam, createError } from "h3";
import { getPendaftarByNomor } from "~~/server/utils/db/pendaftar";
import { getLombaById } from "~~/server/utils/db/lomba";
import { getKategori } from "~~/server/utils/db/kategori";
import { getSettings } from "~~/server/utils/db/settings";

export default defineEventHandler(async (event) => {
  const nomor = getRouterParam(event, "nomor");
  if (!nomor) {
    throw createError({ statusCode: 400, statusMessage: "nomor wajib diisi" });
  }
  const [p, cfg, kats] = await Promise.all([
    getPendaftarByNomor(nomor),
    getSettings(),
    getKategori(),
  ]);
  const l = p ? await getLombaById(p.lombaId) : null;
  const k = p ? kats.find((kk) => kk.id === p.kategoriId) : null;
  return {
    pendaftar: p,
    lomba: l ? { id: l.id, nama: l.nama, emoji: l.emoji } : null,
    kategori: k ? { id: k.id, nama: k.nama } : null,
    cfg: cfg ? { appName: cfg.appName, kampungName: cfg.kampungName, tahunAktif: cfg.tahunAktif } : null,
  };
});
