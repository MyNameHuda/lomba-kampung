import { defineEventHandler, readBody, createError } from "h3";
// Admin login — POST /api/admin/login
// Sets isAdmin in sealed session cookie on success.
import { z } from "zod";
import { getSettings } from "~~/server/utils/db/settings";
import { getAdminSession, verifyPassword } from "~~/server/utils/auth";

const schema = z.object({
  password: z.string().min(1).max(200),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Password wajib diisi" });
  }

  const cfg = await getSettings();
  const hash = cfg?.adminPasswordHash;
  if (!hash) {
    throw createError({ statusCode: 500, statusMessage: "Admin password belum di-seed. Jalankan db:seed." });
  }

  if (!verifyPassword(parsed.data.password, hash)) {
    throw createError({ statusCode: 401, statusMessage: "Password salah" });
  }

  const session = await getAdminSession(event);
  await session.update({ isAdmin: true, loginAt: Date.now() });

  return { ok: true };
});
