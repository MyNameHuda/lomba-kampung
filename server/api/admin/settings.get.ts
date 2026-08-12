import { defineEventHandler } from "h3";
// GET /api/admin/settings
import { requireAuth } from "~~/server/utils/auth";
import { getSettings } from "~~/server/utils/db/settings";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  return await getSettings();
});
