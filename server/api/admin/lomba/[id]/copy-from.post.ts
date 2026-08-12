import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
// POST /api/admin/lomba/[id]/copy-from — bulk copy from another lomba
import { z } from "zod";
import { requireAuth } from "~~/server/utils/auth";
import { bulkCopyPendaftar } from "~~/server/utils/db/pendaftar";
import { getLombaById } from "~~/server/utils/db/lomba";

const schema = z.object({
  sourceLombaId: z.number().int().positive(),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const idStr = getRouterParam(event, "id");
  const targetLombaId = Number(idStr);
  if (!Number.isFinite(targetLombaId) || targetLombaId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "id tidak valid" });
  }
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "sourceLombaId wajib diisi" });
  }

  const target = await getLombaById(targetLombaId);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "Lomba target tidak ditemukan" });
  }

  const result = await bulkCopyPendaftar(
    parsed.data.sourceLombaId,
    targetLombaId,
    target.kategoriEligible
  );
  return { ok: true, ...result };
});
