// GET /api/admin/dashboard — stats for admin dashboard
import { defineEventHandler } from "h3";
import { requireAuth } from "~~/server/utils/auth";
import {
  countLombaAktif,
  countPendaftarHadir,
  getPendaftarCountsByStatus,
  getPendaftarCountsByLombaBatch,
  getRecentPendaftar,
} from "~~/server/utils/db/pendaftar";
import { getLomba } from "~~/server/utils/db/lomba";
import { getSettings } from "~~/server/utils/db/settings";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  // Reduced from 9 parallel queries to 5:
  // - counts: 1 GROUP BY status query (was: 4 separate COUNT(*) + 1 total + 1 hadir)
  // - recent: LIMIT 5 in SQL (was: SELECT * then sort+slice in JS)
  // - per-lomba counts: 1 batched query (was: N×M JS filter loop)
  const [lombaAktif, hadir, allCounts, lombaAll, recent, cfg] = await Promise.all([
    countLombaAktif(),
    countPendaftarHadir(),
    getPendaftarCountsByStatus(),
    getLomba(true),
    getRecentPendaftar(5),
    getSettings(),
  ]);
  const perLomba = await getPendaftarCountsByLombaBatch(lombaAll.map((l) => l.id));

  const lombaWithCount = lombaAll.map((l) => ({
    id: l.id, nama: l.nama, emoji: l.emoji, status: l.status,
    count: perLomba.get(l.id)?.disetujui ?? 0,
  }));

  return {
    cfg,
    stats: {
      lombaAktif,
      totalPendaftar: allCounts.total,
      pending: allCounts.pending,
      disetujui: allCounts.disetujui,
      ditolak: allCounts.ditolak,
      hadir,
    },
    recent,
    lombaWithCount,
  };
});
