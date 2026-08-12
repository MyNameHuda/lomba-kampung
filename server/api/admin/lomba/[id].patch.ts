import { defineEventHandler, readBody, createError, getRouterParam } from "h3";
// PATCH /api/admin/lomba/[id]
import { z } from "zod";
import { requireAuth } from "~~/server/utils/auth";
import { updateLomba, setLombaKategori, setLombaJadwal, getLombaById } from "~~/server/utils/db/lomba";

const pjInput = z.object({
  kategoriId: z.string().min(1).max(50),
  pjNama: z.string().trim().min(1).max(100),
  pjKontak: z.string().trim().max(30).nullable().optional(),
});

const jadwalInput = z.object({
  kategoriId: z.string().min(1).max(50),
  tanggal: z.number().int().nullable(),
  jam: z.string().max(10).nullable().optional(),
});

const schema = z.object({
  nama: z.string().trim().min(1).max(200).optional(),
  emoji: z.string().min(1).max(10).optional(),
  deskripsi: z.string().max(1000).nullable().optional(),
  syarat: z.array(z.string().max(200)).max(20).optional(),
  kategoriEligible: z.array(z.string().min(1)).min(1).max(20).optional(),
  status: z.enum(["draft", "aktif", "selesai"]).optional(),
  urutan: z.number().int().min(0).optional(),
  finalisCount: z.number().int().min(1).max(50).optional(),
  pendaftaranDibuka: z.boolean().optional(),
  faseEnabled: z.boolean().optional(),
  pjList: z.array(pjInput).max(100).optional(),
  jadwalList: z.array(jadwalInput).max(50).optional(),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const idStr = getRouterParam(event, "id");
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "id tidak valid" });
  }
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || "Input tidak valid" });
  }
  const d = parsed.data;
  // Strip pjList/jadwalList (handled separately) from the update payload
  const { pjList, jadwalList, ...updates } = d;
  if (Object.keys(updates).length > 0) {
    await updateLomba(id, updates);
  }
  if (pjList) {
    await setLombaKategori(id, pjList.map((p) => ({
      kategoriId: p.kategoriId,
      pjNama: p.pjNama,
      pjKontak: p.pjKontak || null,
    })));
  }
  if (jadwalList) {
    await setLombaJadwal(id, jadwalList.map((j) => ({
      kategoriId: j.kategoriId,
      tanggal: j.tanggal,
      jam: j.jam || null,
    })));
  }
  const lomba = await getLombaById(id);
  return { ok: true, lomba };
});
