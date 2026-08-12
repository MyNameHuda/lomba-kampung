import { defineEventHandler, createError, getRouterParam } from "h3";
// POST /api/admin/lomba/[id]/kategori/[kid]/buka-semi-final
import { requireAuth } from "~~/server/utils/auth";
import { bukaSemiFinal } from "~~/server/utils/db/lomba";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  const kid = getRouterParam(event, "kid");
  if (!Number.isFinite(id) || !kid) {
    throw createError({ statusCode: 400, statusMessage: "id atau kid tidak valid" });
  }
  const ok = await bukaSemiFinal(id, kid);
  if (!ok) {
    throw createError({
      statusCode: 400,
      statusMessage: "Tidak bisa Buka Semi Final — sudah ada Juara 1/2/3 yang dipilih (hapus dulu)",
    });
  }
  return { ok: true };
});
