import { defineEventHandler, createError, getRouterParam } from "h3";
// DELETE /api/admin/pendaftar/[id]
import { requireAuth } from "~~/server/utils/auth";
import { deletePendaftar } from "~~/server/utils/db/pendaftar";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "id tidak valid" });
  }
  await deletePendaftar(id);
  return { ok: true };
});
