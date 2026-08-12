import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
// PATCH /api/admin/pendaftar/[id] — update pendaftar (approval, edit, hadir, dll)
import { z } from "zod";
import { requireAuth } from "~~/server/utils/auth";
import { updatePendaftar } from "~~/server/utils/db/pendaftar";

const schema = z.object({
  nama: z.string().trim().min(1).max(100).optional(),
  status: z.enum(["pending", "disetujui", "ditolak"]).optional(),
  alasanTolak: z.string().max(500).nullable().optional(),
  hadir: z.boolean().optional(),
  jenisKelamin: z.enum(["L", "P"]).optional(),
  kategoriId: z.string().min(1).max(50).optional(),
  umur: z.number().int().min(0).max(120).optional(),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "id tidak valid" });
  }
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Input tidak valid" });
  }
  await updatePendaftar(id, parsed.data);
  return { ok: true };
});
