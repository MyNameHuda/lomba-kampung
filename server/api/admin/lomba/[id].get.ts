import { defineEventHandler, createError, getRouterParam } from "h3";
// GET /api/admin/lomba/[id]
import { requireAuth } from "~~/server/utils/auth";
import { getLombaById } from "~~/server/utils/db/lomba";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const idStr = getRouterParam(event, "id");
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "id tidak valid" });
  }
  const lomba = await getLombaById(id);
  if (!lomba) {
    throw createError({ statusCode: 404, statusMessage: "Lomba tidak ditemukan" });
  }
  return lomba;
});
