// GET /api/admin/input-manual-data — initial data for input-manual page
// Per user directive 2026-08-10: only "disetujui" peserta show on this page.
// Pending/ditolak are managed via /admin/approval, not this page.
import { defineEventHandler } from "h3";
import { requireAuth } from "~~/server/utils/auth";
import { getLomba } from "~~/server/utils/db/lomba";
import { getKategori } from "~~/server/utils/db/kategori";
import { getPendaftar } from "~~/server/utils/db/pendaftar";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const [lombaAll, kats, allPendaftar] = await Promise.all([getLomba(true), getKategori(), getPendaftar()]);
  // Peserta grouped by lomba — only "disetujui" (admin peserta page is for
  // managing approved entries; approval queue lives in /admin/approval).
  const pesertaByLomba: Record<number, any[]> = {};
  for (const p of allPendaftar) {
    if (p.status !== "disetujui") continue;
    if (!pesertaByLomba[p.lombaId]) pesertaByLomba[p.lombaId] = [];
    const k = kats.find((kk) => kk.id === p.kategoriId);
    pesertaByLomba[p.lombaId].push({
      id: p.id, nomor: p.nomor, nama: p.nama,
      umur: p.umur, jenisKelamin: p.jenisKelamin,
      kategoriId: p.kategoriId, kategori: k?.nama || p.kategoriId,
      hadir: p.hadir, sumber: p.sumber, createdAt: p.createdAt,
    });
  }
  // Source-by-lomba: list of OTHER lomba that share at least one eligible kategori
  const sourceByLomba: Record<number, any[]> = {};
  for (const l of lombaAll) {
    const set = new Set(l.kategoriEligible);
    sourceByLomba[l.id] = lombaAll
      .filter((other) => other.id !== l.id && other.kategoriEligible.some((kid) => set.has(kid)))
      .map((other) => ({
        id: other.id, nama: other.nama, emoji: other.emoji,
        count: allPendaftar.filter((p) => p.lombaId === other.id && p.status === "disetujui").length,
        sharedKategori: other.kategoriEligible.filter((kid) => set.has(kid)),
      }));
  }
  return {
    lombaList: lombaAll.map((l) => ({
      id: l.id, nama: l.nama, emoji: l.emoji, status: l.status,
      kategoriEligible: l.kategoriEligible,
    })),
    kats: kats.map((k) => ({
      id: k.id, nama: k.nama, min: k.min, max: k.max, autoAge: k.autoAge,
      inputMode: k.inputMode,
      urutan: k.urutan, icon: k.icon,
      colorBg: k.colorBg, colorText: k.colorText, colorBorder: k.colorBorder,
    })),
    pesertaByLomba,
    sourceByLomba,
  };
});
