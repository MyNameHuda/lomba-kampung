// GET /api/admin/peserta-list — list of ALL lomba with disetujui + pending
// counts so admin can see (a) which lomba already have peserta and
// (b) which lomba still have pendaftar waiting for approval.
import { defineEventHandler } from "h3";
import { requireAuth } from "~~/server/utils/auth";
import { getLomba } from "~~/server/utils/db/lomba";
import { getPendaftarCountsByLombaBatch } from "~~/server/utils/db/pendaftar";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  // Was: getPendaftar() loads ALL rows + 3× filter per lomba in JS. Now: 1
  // batched GROUP BY (lomba_id, status) query, plus getLomba() in parallel.
  const lombaAll = await getLomba(true);
  const perLomba = await getPendaftarCountsByLombaBatch(lombaAll.map((l) => l.id));
  const items = lombaAll.map((l) => {
    const c = perLomba.get(l.id) ?? { disetujui: 0, pending: 0, total: 0 };
    return {
      id: l.id, nama: l.nama, emoji: l.emoji, status: l.status,
      kategoriEligible: l.kategoriEligible,
      count: c.disetujui,
      pending: c.pending,
      total: c.total,
    };
  });
  return { items };
});
