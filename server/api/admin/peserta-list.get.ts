// GET /api/admin/peserta-list — list of ALL lomba with disetujui + pending
// counts so admin can see (a) which lomba already have peserta and
// (b) which lomba still have pendaftar waiting for approval.
import { defineEventHandler } from "h3";
import { requireAuth } from "~~/server/utils/auth";
import { getLomba } from "~~/server/utils/db/lomba";
import { getPendaftar } from "~~/server/utils/db/pendaftar";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const [lombaAll, allPendaftar] = await Promise.all([getLomba(true), getPendaftar()]);
  // Pre-group pendaftar by lombaId so the per-lomba stats are O(M) total
  // instead of O(N*M) when iterating lomba × filter.
  const grouped = new Map<number, typeof allPendaftar>();
  for (const p of allPendaftar) {
    const arr = grouped.get(p.lombaId);
    if (arr) arr.push(p);
    else grouped.set(p.lombaId, [p]);
  }
  const items = lombaAll.map((l) => {
    const ps = grouped.get(l.id) ?? [];
    return {
      id: l.id, nama: l.nama, emoji: l.emoji, status: l.status,
      kategoriEligible: l.kategoriEligible,
      count: ps.filter((p) => p.status === "disetujui").length,
      pending: ps.filter((p) => p.status === "pending").length,
      total: ps.filter((p) => p.status !== "ditolak").length,
    };
  });
  return { items };
});
