import { defineEventHandler } from "h3";
// Health check — public.
// GET /api/health
// Returns { ok: true, db: "up" | "down", ts }
import { getPool } from "~~/server/utils/db/client";

export default defineEventHandler(async () => {
  try {
    await getPool().query("SELECT 1");
    return { ok: true, db: "up", ts: Date.now() };
  } catch {
    return { ok: false, db: "down", ts: Date.now() };
  }
});
