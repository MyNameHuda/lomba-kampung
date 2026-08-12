import { defineEventHandler } from "h3";
// GET /api/admin/pendaftar — list pendaftar (with optional filter)
import { requireAuth } from "~~/server/utils/auth";
import { getPendaftar } from "~~/server/utils/db/pendaftar";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  return await getPendaftar();
});
