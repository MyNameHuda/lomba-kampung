import { defineEventHandler, readBody, createError } from "h3";
// POST /api/admin/reset — destructive: delete all lomba + pendaftar
import { z } from "zod";
import { requireAuth } from "~~/server/utils/auth";
import { resetAllData } from "~~/server/utils/db/backup";

const schema = z.object({
  confirm: z.literal(true),
  keepKategori: z.boolean().default(true),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Konfirmasi diperlukan (confirm: true)" });
  }
  await resetAllData(parsed.data.keepKategori);
  return { ok: true };
});
