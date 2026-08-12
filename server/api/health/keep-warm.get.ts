// GET /api/health/keep-warm — called by Vercel Cron (1x/day) to keep the
// serverless function AND Neon DB warm between user visits.
//
// Vercel Hobby plan suspends functions after ~5 min of inactivity and Neon
// free tier suspends the DB after 5 min of inactivity. Both wake on next
// request, but waking takes 1-3s each on top of the function cold start.
// A 1x/day cron won't fully prevent cold starts, but it cuts the worst case
// (Neon cold = 5+ seconds of "ECONNREFUSED / connection terminated" retries)
// down to a single function cold start (~1s).
//
// Why this is its own endpoint instead of just pinging "/":
// - Avoids triggering full SSR (home page does 4+ DB queries per render)
// - Does a single SELECT 1 to keep Neon warm, no other work
//
// Why no auth check: Vercel auto-generates CRON_SECRET in some configs but
// not reliably on Hobby plans. The endpoint is harmless (SELECT 1 + ts) and
// the only abuse risk is wasted Neon compute, which is fine on the free tier.
// If you ever need to lock it down, add `if (process.env.CRON_SECRET)` here
// and set CRON_SECRET via `vercel env add CRON_SECRET production`.
import { defineEventHandler } from "h3";
import { getPool } from "~~/server/utils/db/client";

export default defineEventHandler(async () => {
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
