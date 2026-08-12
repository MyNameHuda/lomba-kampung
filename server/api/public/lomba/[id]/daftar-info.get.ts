// GET /api/public/lomba/[id]/daftar-info — minimal info needed by the daftar form
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from "h3";
import { getLombaById } from "~~/server/utils/db/lomba";
import { getKategori } from "~~/server/utils/db/kategori";

// 30s edge cache. Form data is read-mostly; safe to cache.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "public, s-maxage=30, stale-while-revalidate=86400");
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
