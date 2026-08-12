import { defineEventHandler, readBody, createError } from "h3";
// PATCH /api/admin/password
import { z } from "zod";
import { requireAuth, hashPassword, verifyPassword } from "~~/server/utils/auth";
import { getSettings, updateAdminPassword } from "~~/server/utils/db/settings";

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(6).max(200),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Password baru minimal 6 karakter" });
  }
  const cfg = await getSettings();
  if (!cfg?.adminPasswordHash) {
    throw createError({ statusCode: 500, statusMessage: "Settings belum ada" });
  }
  if (!verifyPassword(parsed.data.currentPassword, cfg.adminPasswordHash)) {
    throw createError({ statusCode: 401, statusMessage: "Password lama salah" });
  }
  await updateAdminPassword(hashPassword(parsed.data.newPassword));
  return { ok: true };
});
