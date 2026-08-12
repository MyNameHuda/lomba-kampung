import { defineEventHandler, readBody, createError } from "h3";
// POST /api/admin/pendaftar — manual input (admin-side create)
import { z } from "zod";
import { requireAuth } from "~~/server/utils/auth";
import { createPendaftar } from "~~/server/utils/db/pendaftar";
import { getLombaById } from "~~/server/utils/db/lomba";
import { getKategori } from "~~/server/utils/db/kategori";

const schema = z.object({
  nama: z.string().trim().min(1).max(100),
  jenisKelamin: z.enum(["L", "P"]),
  kategoriId: z.string().min(1).max(50),
  umur: z.number().int().min(0).max(120),
  lombaId: z.number().int().positive(),
  hadir: z.boolean().default(true),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || "Input tidak valid" });
  }
  const d = parsed.data;

  const lomba = await getLombaById(d.lombaId);
  if (!lomba) {
    throw createError({ statusCode: 404, statusMessage: "Lomba tidak ditemukan" });
  }
  if (!lomba.kategoriEligible.includes(d.kategoriId)) {
    throw createError({ statusCode: 400, statusMessage: "Kategori tidak eligible untuk lomba ini" });
  }
  const kats = await getKategori();
  const kat = kats.find((k) => k.id === d.kategoriId);
  if (!kat) {
    throw createError({ statusCode: 400, statusMessage: "Kategori tidak valid" });
  }
  if (d.umur < kat.min || d.umur > kat.max) {
    throw createError({
      statusCode: 400,
      statusMessage: `Umur ${d.umur} tidak sesuai kategori ${kat.nama} (${kat.min}–${kat.max} tahun)`,
    });
  }

  const result = await createPendaftar({
    nama: d.nama,
    jenisKelamin: d.jenisKelamin,
    kategoriId: d.kategoriId,
    umur: d.umur,
    lombaId: d.lombaId,
    sumber: "manual",
    status: "disetujui", // manual input = auto-approved
    hadir: d.hadir,
  });
  return { ok: true, id: result.id, nomor: result.nomor };
});
