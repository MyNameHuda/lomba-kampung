import { defineEventHandler, readBody, createError } from "h3";
// POST /api/admin/lomba/[id]/juara — set Juara rank for a pendaftar
import { z } from "zod";
import { requireAuth } from "~~/server/utils/auth";
import { setJuaraRank } from "~~/server/utils/db/pendaftar";

const schema = z.object({
  pendaftarId: z.number().int().positive(),
  rank: z.number().int().min(1).max(3),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "pendaftarId + rank wajib diisi" });
  }
  const result = await setJuaraRank(parsed.data.pendaftarId, parsed.data.rank);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Pendaftar tidak ditemukan" });
  }
  return { ok: true, ...result };
});
