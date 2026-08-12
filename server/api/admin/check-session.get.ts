import { defineEventHandler } from "h3";
// Session check — GET /api/admin/check-session
// Used by the global route middleware to verify admin auth.
import { isAuthenticated } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const ok = await isAuthenticated(event);
  return { isAdmin: ok };
});
