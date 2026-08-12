import { defineEventHandler, readBody, createError } from "h3";
// POST /api/admin/lomba — create new lomba + PJ list
import { z } from "zod";
import { requireAuth } from "~~/server/utils/auth";
import { createLomba, setLombaKategori, setLombaJadwal, getLomba } from "~~/server/utils/db/lomba";

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
  nama: z.string().trim().min(1).max(200),
  emoji: z.string().min(1).max(10),
  deskripsi: z.string().max(1000).nullable().optional(),
  syarat: z.array(z.string().max(200)).max(20).default([]),
  kategoriEligible: z.array(z.string().min(1)).min(1).max(20),
  status: z.enum(["draft", "aktif", "selesai"]),
  urutan: z.number().int().min(0),
  finalisCount: z.number().int().min(1).max(50),
  pendaftaranDibuka: z.boolean(),
  faseEnabled: z.boolean(),
  pjList: z.array(pjInput).max(100).default([]),
  jadwalList: z.array(jadwalInput).max(50).default([]),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || "Input tidak valid" });
  }
  const d = parsed.data;
  const id = await createLomba({
    nama: d.nama,
    emoji: d.emoji,
    deskripsi: d.deskripsi ?? null,
    syarat: d.syarat,
    kategoriEligible: d.kategoriEligible,
    status: d.status,
    urutan: d.urutan,
    finalisCount: d.finalisCount,
    phase: null,
    pendaftaranDibuka: d.pendaftaranDibuka,
    faseEnabled: d.faseEnabled,
  });
  if (d.pjList.length > 0) {
    await setLombaKategori(id, d.pjList.map((p) => ({
      kategoriId: p.kategoriId,
      pjNama: p.pjNama,
      pjKontak: p.pjKontak || null,
    })));
  }
  if (d.jadwalList.length > 0) {
    await setLombaJadwal(id, d.jadwalList.map((j) => ({
      kategoriId: j.kategoriId,
      tanggal: j.tanggal,
      jam: j.jam || null,
    })));
  }
  const created = await getLomba(true);
  const row = created.find((l) => l.id === id);
  return { ok: true, id, lomba: row };
});
