import { defineEventHandler, setHeader } from "h3";
// GET /api/admin/export — alias for /api/admin/backup (kept for compat with original Next route)
import { requireAuth } from "~~/server/utils/auth";
import { exportAllData } from "~~/server/utils/db/backup";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const data = await exportAllData();
  setHeader(event, "Content-Type", "application/json; charset=utf-8");
  setHeader(
    event,
    "Content-Disposition",
    `attachment; filename="lomba-export-${new Date().toISOString().slice(0, 10)}.json"`
  );
  return data;
});
