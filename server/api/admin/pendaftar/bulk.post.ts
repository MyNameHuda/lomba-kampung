import { defineEventHandler, readBody, createError } from "h3";
// POST /api/admin/pendaftar/bulk — bulk approve/reject/delete
import { z } from "zod";
import { requireAuth } from "~~/server/utils/auth";
import { updatePendaftar, deletePendaftar } from "~~/server/utils/db/pendaftar";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    ids: z.array(z.number().int().positive()).min(1).max(500),
  }),
  z.object({
    action: z.literal("reject"),
    ids: z.array(z.number().int().positive()).min(1).max(500),
    alasanTolak: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("delete"),
    ids: z.array(z.number().int().positive()).min(1).max(500),
  }),
]);

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || "Input tidak valid" });
  }
  const { action, ids } = parsed.data;
  for (const id of ids) {
    if (action === "approve") {
      await updatePendaftar(id, { status: "disetujui" });
    } else if (action === "reject") {
      await updatePendaftar(id, {
        status: "ditolak",
        alasanTolak: parsed.data.alasanTolak ?? null,
      });
    } else {
      await deletePendaftar(id);
    }
  }
  return { ok: true, count: ids.length };
});
