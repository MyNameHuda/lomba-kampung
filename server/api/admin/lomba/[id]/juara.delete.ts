import { defineEventHandler, readBody, createError } from "h3";
// DELETE /api/admin/lomba/[id]/juara — clear Juara rank for a pendaftar
import { z } from "zod";
import { requireAuth } from "~~/server/utils/auth";
import { clearJuaraRank } from "~~/server/utils/db/pendaftar";

const schema = z.object({
  pendaftarId: z.number().int().positive(),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "pendaftarId wajib diisi" });
  }
  await clearJuaraRank(parsed.data.pendaftarId);
  return { ok: true };
});
