import { defineEventHandler, createError, getRouterParam } from "h3";
// POST /api/admin/lomba/[id]/kategori/[kid]/buka-kualifikasi
import { requireAuth } from "~~/server/utils/auth";
import { bukaKualifikasiKategori } from "~~/server/utils/db/lomba";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  const kid = getRouterParam(event, "kid");
  if (!Number.isFinite(id) || !kid) {
    throw createError({ statusCode: 400, statusMessage: "id atau kid tidak valid" });
  }
  const ok = await bukaKualifikasiKategori(id, kid);
  if (!ok) {
    throw createError({
      statusCode: 400,
      statusMessage: "Tidak bisa Buka — sudah ada Juara 1/2/3 yang dipilih (hapus dulu)",
    });
  }
  return { ok: true };
});
