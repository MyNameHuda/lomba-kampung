import { defineEventHandler, createError, getRouterParam } from "h3";
// POST /api/admin/lomba/[id]/selesai — mark lomba as selesai
import { requireAuth } from "~~/server/utils/auth";
import { getJuaraReadiness, markLombaSelesai } from "~~/server/utils/db/lomba";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const idStr = getRouterParam(event, "id");
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "id tidak valid" });
  }
  const readiness = await getJuaraReadiness(id);
  if (!readiness.allReady) {
    throw createError({
      statusCode: 400,
      statusMessage: `Lomba belum siap selesai — Juara 1/2 belum lengkap di ${readiness.missingKategori.length} kategori`,
    });
  }
  await markLombaSelesai(id);
  return { ok: true };
});
