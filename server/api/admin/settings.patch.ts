import { defineEventHandler, readBody, createError } from "h3";
// PATCH /api/admin/settings
import { z } from "zod";
import { requireAuth } from "~~/server/utils/auth";
import { updateSettings } from "~~/server/utils/db/settings";

const schema = z.object({
  appName: z.string().trim().min(1).max(100),
  kampungName: z.string().trim().min(1).max(100),
  tahunAktif: z.string().trim().min(1).max(100),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Field wajib diisi" });
  }
  await updateSettings(parsed.data);
  return { ok: true };
});
