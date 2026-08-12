import { defineEventHandler, readBody, createError } from "h3";
// Public pendaftar POST — warga submits 3-step form.
// POST /api/pendaftar
import { z } from "zod";
import { getLombaById } from "~~/server/utils/db/lomba";
import { createPendaftar, getPendaftarByNomor } from "~~/server/utils/db/pendaftar";
import { getKategori } from "~~/server/utils/db/kategori";
import { publicKategoriName } from "~/utils/format";

const schema = z.object({
  lombaId: z.number().int().positive(),
  nama: z.string().trim().min(1).max(100),
  jenisKelamin: z.enum(["L", "P"]),
  kategoriId: z.string().min(1).max(50),
  umur: z.number().int().min(0).max(120),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || "Input tidak valid" });
  }
  const data = parsed.data;

  // Validate lomba exists + is active + registration open
  const lomba = await getLombaById(data.lombaId);
  if (!lomba) {
    throw createError({ statusCode: 404, statusMessage: "Lomba tidak ditemukan" });
  }
  if (lomba.status !== "aktif") {
    throw createError({ statusCode: 400, statusMessage: "Lomba ini tidak menerima pendaftaran" });
  }
  if (!lomba.pendaftaranDibuka) {
    throw createError({ statusCode: 400, statusMessage: "Pendaftaran lomba ini sudah ditutup" });
  }
  if (!lomba.kategoriEligible.includes(data.kategoriId)) {
    throw createError({ statusCode: 400, statusMessage: "Kategori tidak eligible untuk lomba ini" });
  }

  // Validate kategori age range
  const kats = await getKategori();
  const kat = kats.find((k) => k.id === data.kategoriId);
  if (!kat) {
    throw createError({ statusCode: 400, statusMessage: "Kategori tidak valid" });
  }
  if (data.umur < kat.min || data.umur > kat.max) {
    throw createError({
      statusCode: 400,
      statusMessage: `Umur ${data.umur} tidak sesuai kategori ${publicKategoriName(kat.id)} (${kat.min}–${kat.max} tahun)`,
    });
  }

  // Create pendaftar — source is "publik", status starts "pending" awaiting approval
  const result = await createPendaftar({
    nama: data.nama.trim(),
    jenisKelamin: data.jenisKelamin,
    kategoriId: data.kategoriId,
    umur: data.umur,
    lombaId: data.lombaId,
    sumber: "publik",
  });

  // Fetch the created row to get the assigned nomor
  const created = await getPendaftarByNomor(result.nomor);
  if (!created) {
    throw createError({ statusCode: 500, statusMessage: "Gagal membuat pendaftar" });
  }

  return {
    ok: true,
    id: created.id,
    nomor: created.nomor,
  };
});
