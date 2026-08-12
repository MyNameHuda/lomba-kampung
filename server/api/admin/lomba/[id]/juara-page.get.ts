// GET /api/admin/lomba/[id]/juara-page — juara picker page data
import { defineEventHandler, getRouterParam, createError } from "h3";
import { requireAuth } from "~~/server/utils/auth";
import { getLombaById, getJuaraReadiness } from "~~/server/utils/db/lomba";
import { getKategori } from "~~/server/utils/db/kategori";
import { getPendaftarByLomba, getKualifikasiStatusByKategori, getSemiFinalStatusByKategori, getJuaraByLomba } from "~~/server/utils/db/pendaftar";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "id tidak valid" });
  }
  const lomba = await getLombaById(id);
  if (!lomba) throw createError({ statusCode: 404, statusMessage: "Lomba tidak ditemukan" });

  const [kats, allPendaftar, juaraMap, readiness] = await Promise.all([
    getKategori(),
    getPendaftarByLomba(id, "disetujui"),
    getJuaraByLomba(id),
    getJuaraReadiness(id),
  ]);
  const katMap = new Map(kats.map((k) => [k.id, k]));
  const eligibleKategori = lomba.kategoriEligible;

  // Build sections with kual + semi status + per-pendaftar
  const sections = await Promise.all(eligibleKategori.map(async (kid) => {
    const k = katMap.get(kid);
    const pendaftar = allPendaftar
      .filter((p) => p.kategoriId === kid)
      .map((p) => {
        const juaraEntry = juaraMap[kid]?.find((j) => j.pendaftarId === p.id);
        return {
          id: p.id, nomor: p.nomor, nama: p.nama, umur: p.umur,
          jenisKelamin: p.jenisKelamin as "L" | "P",
          isFinalist: p.isFinalist,
          isSemiFinalist: p.isSemiFinalist,
          juaraRank: (juaraEntry?.juaraRank ?? null) as 1 | 2 | 3 | null,
        };
      })
      .sort((a, b) => a.umur - b.umur || a.nomor.localeCompare(b.nomor));
    const kualStatus = await getKualifikasiStatusByKategori(id, kid);
    const semiStatus = await getSemiFinalStatusByKategori(id, kid);
    return {
      kategoriId: kid,
      kategoriNama: k?.nama || kid,
      kategoriIcon: k?.icon || "fa-user",
      kategoriColorBg: k?.colorBg || "#F9FAFB",
      kategoriColorText: k?.colorText || "#1F2937",
      kategoriColorBorder: k?.colorBorder || "#E5E7EB",
      ageRange: k ? `${k.min}–${k.max === 999 ? k.min + "+" : k.max} tahun` : "",
      pendaftar,
      kualStatus: { lolos: kualStatus.lolos, gugur: kualStatus.gugur, pending: kualStatus.pending, total: kualStatus.total, readyToTutup: kualStatus.readyToTutup },
      tutupAt: lomba.kategoriTutupAt?.kual?.[kid] ?? null,
      semiStatus: { lolos: semiStatus.lolos, gugur: semiStatus.gugur, pending: semiStatus.pending, total: semiStatus.total, readyToTutup: semiStatus.readyToTutup },
      semiTutupAt: lomba.kategoriTutupAt?.semi?.[kid] ?? null,
    };
  }));

  return {
    lomba: { id: lomba.id, nama: lomba.nama, emoji: lomba.emoji, status: lomba.status, faseEnabled: lomba.faseEnabled },
    sections,
    readiness: { allReady: readiness.allReady, missingKategori: readiness.missingKategori, perKategori: readiness.perKategori },
  };
});
