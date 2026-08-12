// GET /api/admin/dashboard — stats for admin dashboard
import { defineEventHandler } from "h3";
import { requireAuth } from "~~/server/utils/auth";
import { countLombaAktif, countAllPendaftar, countPendaftarByStatus, countPendaftarHadir, getPendaftar } from "~~/server/utils/db/pendaftar";
import { getLomba } from "~~/server/utils/db/lomba";
import { getSettings } from "~~/server/utils/db/settings";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const [lombaAktif, totalPendaftar, pending, disetujui, ditolak, hadir, lombaAll, allPendaftar, cfg] = await Promise.all([
    countLombaAktif(),
    countAllPendaftar(),
    countPendaftarByStatus("pending"),
    countPendaftarByStatus("disetujui"),
    countPendaftarByStatus("ditolak"),
    countPendaftarHadir(),
    getLomba(true),
    getPendaftar(),
    getSettings(),
  ]);

  // Recent pendaftar (last 5) + per-lomba counts
  const recent = [...allPendaftar]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, 5);

  const lombaWithCount = lombaAll.map((l) => ({
    id: l.id, nama: l.nama, emoji: l.emoji, status: l.status,
    // Count only approved peserta — pending/ditolak are managed via /admin/approval.
    count: allPendaftar.filter((p) => p.lombaId === l.id && p.status === "disetujui").length,
  }));

  return {
    cfg,
    stats: { lombaAktif, totalPendaftar, pending, disetujui, ditolak, hadir },
    recent,
    lombaWithCount,
  };
});
