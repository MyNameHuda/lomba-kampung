// GET /api/public/lomba/[id] — full data for public lomba detail page
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from "h3";
import { getLombaById, getJuaraReadinessFromLomba } from "~~/server/utils/db/lomba";
import { getKategori } from "~~/server/utils/db/kategori";
import { groupPendaftarForLomba, getJuaraByLomba, getPendaftarByLomba } from "~~/server/utils/db/pendaftar";

// Vercel edge cache — 30s fresh, serve stale up to 1 day. Per-lomba data
// (pj, peserta groups, juara) is read-mostly; safe to cache.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "public, s-maxage=30, stale-while-revalidate=86400");
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "id tidak valid" });
  }
  const l = await getLombaById(id);
  if (!l || l.status === "draft") {
    throw createError({ statusCode: 404, statusMessage: "Lomba tidak ditemukan" });
  }

  // Pass `l` to readiness to skip the redundant getLombaById() round-trip
  // (we already have the full lomba here, including kategoriEligible).
  const [kats, groups, juaraMap, readiness, allDisetujui] = await Promise.all([
    getKategori(),
    groupPendaftarForLomba(id),
    getJuaraByLomba(id),
    getJuaraReadinessFromLomba(l),
    getPendaftarByLomba(id, "disetujui"),
  ]);

  // Build finalis map
  const juaraRankById = new Map<number, number>();
  for (const arr of Object.values(juaraMap)) {
    for (const j of arr) juaraRankById.set(j.pendaftarId, j.juaraRank);
  }
  const finalisByKategori: Record<string, Array<{
    pendaftarId: number; nama: string; umur: number;
    jenisKelamin: "L" | "P"; juaraRank: number | null; kategoriId: string;
  }>> = {};
  const eligibleKategori = Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [];
  for (const katId of eligibleKategori) {
    const finalists = allDisetujui
      .filter((p) => p.kategoriId === katId && p.isFinalist === 1)
      .map((p) => ({
        pendaftarId: p.id,
        nama: p.nama,
        umur: p.umur,
        jenisKelamin: p.jenisKelamin,
        juaraRank: juaraRankById.get(p.id) ?? null,
        kategoriId: katId,
      }))
      .sort((a, b) => {
        const aIsJuara = a.juaraRank !== null ? 0 : 1;
        const bIsJuara = b.juaraRank !== null ? 0 : 1;
        if (aIsJuara !== bIsJuara) return aIsJuara - bIsJuara;
        if (aIsJuara === 0 && bIsJuara === 0) return a.juaraRank! - b.juaraRank!;
        return a.umur - b.umur;
      });
    finalisByKategori[katId] = finalists;
  }
  const totalFinalis = Object.values(finalisByKategori).reduce((sum, arr) => sum + arr.length, 0);
  const totalPeserta = groups.sections.reduce((sum, s) => sum + s.peserta.length, 0);
  const totalJuara = Object.values(juaraMap).reduce((sum, arr) => sum + arr.length, 0);

  // Build a slim pj list (flatten for client convenience)
  const pjEntries: Array<{ katId: string; pj: { nama: string; kontak: string | null } }> = [];
  for (const katId of eligibleKategori) {
    const list = l.pjByKategori?.[katId] || [];
    for (const pj of list) {
      if (pj?.nama) pjEntries.push({ katId, pj });
    }
  }

  return {
    lomba: {
      id: l.id, nama: l.nama, emoji: l.emoji, deskripsi: l.deskripsi,
      syarat: l.syarat, kategoriEligible: l.kategoriEligible,
      status: l.status, faseEnabled: l.faseEnabled,
      pjByKategori: l.pjByKategori, jadwalByKategori: l.jadwalByKategori,
      kategoriTutupAt: l.kategoriTutupAt,
    },
    kategori: kats.map((k) => ({ id: k.id, nama: k.nama, icon: k.icon, colorBg: k.colorBg, colorText: k.colorText, colorBorder: k.colorBorder })),
    sections: groups.sections,
    finalisByKategori,
    pjEntries,
    totalPeserta,
    totalJuara,
    totalFinalis,
    readinessAllReady: readiness.allReady,
  };
});
