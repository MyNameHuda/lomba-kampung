// GET /api/public/lomba/[id]/daftar-info — minimal info needed by the daftar form
import { defineEventHandler, getRouterParam, createError } from "h3";
import { getLombaById } from "~~/server/utils/db/lomba";
import { getKategori } from "~~/server/utils/db/kategori";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "id tidak valid" });
  }
  const l = await getLombaById(id);
  if (!l || l.status !== "aktif" || !l.pendaftaranDibuka) {
    throw createError({ statusCode: 404, statusMessage: "Lomba tidak menerima pendaftaran" });
  }
  const allKats = await getKategori();
  const eligibleSet = new Set(l.kategoriEligible);
  const kats = allKats.filter((k) => eligibleSet.has(k.id));
  return {
    lomba: { id: l.id, nama: l.nama, emoji: l.emoji },
    kategori: kats.map((k) => ({ id: k.id, nama: k.nama, icon: k.icon, min: k.min, max: k.max, autoAge: k.autoAge, inputMode: k.inputMode })),
  };
});
