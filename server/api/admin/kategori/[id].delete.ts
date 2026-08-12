import { defineEventHandler, createError, getRouterParam } from "h3";
// DELETE /api/admin/kategori/[id]
import { requireAuth } from "~~/server/utils/auth";
import { deleteKategori } from "~~/server/utils/db/kategori";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "id wajib diisi" });
  }
  await deleteKategori(id);
  return { ok: true };
});
