import { defineEventHandler, createError, getRouterParam } from "h3";
// POST /api/admin/lomba/[id]/kategori/[kid]/tutup-kualifikasi
import { requireAuth } from "~~/server/utils/auth";
import { tutupKualifikasiKategori } from "~~/server/utils/db/lomba";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  const kid = getRouterParam(event, "kid");
  if (!Number.isFinite(id) || !kid) {
    throw createError({ statusCode: 400, statusMessage: "id atau kid tidak valid" });
  }
  const ok = await tutupKualifikasiKategori(id, kid);
  if (!ok) {
    throw createError({
      statusCode: 400,
      statusMessage: "Belum bisa Tutup — masih ada pendaftar yang belum di-Loloskan/Gugur",
    });
  }
  return { ok: true };
});
