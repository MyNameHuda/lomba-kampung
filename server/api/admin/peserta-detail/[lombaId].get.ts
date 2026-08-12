// GET /api/admin/peserta-detail/[lombaId] — peserta for a single lomba grouped by kategori
// Filtered to status === "disetujui" only. Pending/ditolak peserta are managed
// via /admin/approval, not this page (per user directive 2026-08-10).
import { defineEventHandler, getRouterParam, createError } from "h3";
import { requireAuth } from "~~/server/utils/auth";
import { getLombaById } from "~~/server/utils/db/lomba";
import { getKategori } from "~~/server/utils/db/kategori";
import { getPendaftarByLomba } from "~~/server/utils/db/pendaftar";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "lombaId"));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "id tidak valid" });
  }
  const l = await getLombaById(id);
  if (!l) {
    throw createError({ statusCode: 404, statusMessage: "Lomba tidak ditemukan" });
  }
  const [kats, allPendaftar] = await Promise.all([getKategori(), getPendaftarByLomba(id)]);
  const katMap = new Map(kats.map((k) => [k.id, k]));
  // Group by kategori — only "disetujui" (approval queue lives in /admin/approval)
  const byKategori: Record<string, any[]> = {};
  for (const p of allPendaftar) {
    if (p.status !== "disetujui") continue;
    if (!byKategori[p.kategoriId]) byKategori[p.kategoriId] = [];
    byKategori[p.kategoriId].push({
      id: p.id, nomor: p.nomor, nama: p.nama,
      umur: p.umur, jenisKelamin: p.jenisKelamin,
      kategori: katMap.get(p.kategoriId)?.nama || p.kategoriId,
      kategoriColor: katMap.get(p.kategoriId)?.colorBorder || "#E5E7EB",
      hadir: p.hadir,
      status: p.status,
    });
  }
  return { lomba: l, kats, byKategori };
});
