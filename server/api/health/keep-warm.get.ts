// GET /api/health/keep-warm — called by Vercel Cron (hourly) to keep the
// serverless function AND Neon DB warm between user visits.
//
// Vercel Hobby plan suspends functions after ~5 min of inactivity and Neon
// free tier suspends the DB after 5 min of inactivity. Both wake on next
// request, but waking takes 1-3s each on top of the function cold start.
//
// Why this is its own endpoint instead of just pinging "/":
// - Avoids triggering full SSR (home page does 4+ DB queries per render)
// - Does a single SELECT 1 to keep Neon warm, no other work
// - Verifies Vercel auth via CRON_SECRET (so external callers can't abuse)
//
// CRON_SECRET is auto-injected by Vercel into the request as
// `Authorization: Bearer <CRON_SECRET>` when a cron job hits the path.
import { defineEventHandler, getRequestHeader, createError } from "h3";
import { getPool } from "~~/server/utils/db/client";

export default defineEventHandler(async (event) => {
  // Auth: Vercel cron sends Authorization: Bearer ${CRON_SECRET}
  if (process.env.CRON_SECRET) {
    const auth = getRequestHeader(event, "authorization") || "";
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }
  }

  // Single DB ping to keep Neon warm. SELECT 1 is the cheapest round-trip.
  try {
    await getPool().query("SELECT 1");
  } catch (e) {
    // If Neon is unreachable, still return 200 so Vercel doesn't mark the
    // cron as failed (we want it to keep retrying). The function itself
    // is "warm" even if the DB is offline.
    console.warn("[keep-warm] DB ping failed:", (e as Error).message);
  }

  return { ok: true, ts: Date.now() };
});
