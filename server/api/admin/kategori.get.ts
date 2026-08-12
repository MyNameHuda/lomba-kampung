import { defineEventHandler } from "h3";
// GET /api/admin/kategori
import { requireAuth } from "~~/server/utils/auth";
import { getKategori } from "~~/server/utils/db/kategori";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  return await getKategori();
});
