import { defineEventHandler, createError, getRouterParam } from "h3";
// POST /api/admin/lomba/[id]/kategori/[kid]/tutup-semi-final
import { requireAuth } from "~~/server/utils/auth";
import { tutupSemiFinal } from "~~/server/utils/db/lomba";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  const kid = getRouterParam(event, "kid");
  if (!Number.isFinite(id) || !kid) {
    throw createError({ statusCode: 400, statusMessage: "id atau kid tidak valid" });
  }
  const ok = await tutupSemiFinal(id, kid);
  if (!ok) {
    throw createError({
      statusCode: 400,
      statusMessage: "Tidak bisa Tutup Semi Final — pastikan lomba 3-fase aktif, Kualifikasi sudah Tutup, dan semua semi-finalis sudah di-Loloskan/Gugur",
    });
  }
  return { ok: true };
});
