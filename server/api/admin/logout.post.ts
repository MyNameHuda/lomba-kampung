import { defineEventHandler } from "h3";
// Admin logout — POST /api/admin/logout
// Clears session.
import { getAdminSession } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await getAdminSession(event);
  await session.clear();
  return { ok: true };
});
