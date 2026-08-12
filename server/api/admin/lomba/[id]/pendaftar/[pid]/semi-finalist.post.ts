import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
// POST /api/admin/lomba/[id]/pendaftar/[pid]/semi-finalist
// Body: { status: 0 | 1 | null }
import { z } from "zod";
import { requireAuth } from "~~/server/utils/auth";
import { setSemiFinalist } from "~~/server/utils/db/pendaftar";

const schema = z.object({
  status: z.union([z.literal(0), z.literal(1), z.null()]),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const pid = Number(getRouterParam(event, "pid"));
  if (!Number.isFinite(pid) || pid <= 0) {
    throw createError({ statusCode: 400, statusMessage: "pid tidak valid" });
  }
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "status wajib 0/1/null" });
  }
  await setSemiFinalist(pid, parsed.data.status);
  return { ok: true };
});
