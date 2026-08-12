// GET /api/admin/lomba
// ?withCounts=1 → also returns per-lomba pendaftar count + juara summary (for the CRUD list page)
import { defineEventHandler, getQuery } from "h3";
import { requireAuth } from "~~/server/utils/auth";
import { getLomba, getJuaraReadiness } from "~~/server/utils/db/lomba";
import { getPendaftar, countPendaftarByLomba } from "~~/server/utils/db/pendaftar";
import { getKategori } from "~~/server/utils/db/kategori";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const q = getQuery(event);
  const withCounts = q.withCounts === "1" || q.withCounts === "true";
  const lomba = await getLomba(true);
  if (!withCounts) return { lomba };
  const [allPendaftar, kats] = await Promise.all([getPendaftar(), getKategori()]);
  const counts: Record<number, number> = {};
  const juaraSummary: Record<number, { totalJuara: number; allReady: boolean }> = {};
  for (const l of lomba) {
    // Count only approved peserta — pending/ditolak are managed via /admin/approval.
    // Matches public home pattern (`disetujui`) for consistency.
    counts[l.id] = await countPendaftarByLomba(l.id, "disetujui");
    const r = await getJuaraReadiness(l.id);
    juaraSummary[l.id] = {
      totalJuara: Object.values(r.perKategori).reduce((sum, c) => sum + c.ju1 + c.ju2 + c.ju3, 0),
      allReady: r.allReady,
    };
  }
  return {
    lomba,
    counts,
    juaraSummary,
    kats: kats.map((k) => ({ id: k.id, nama: k.nama, colorBg: k.colorBg, colorText: k.colorText, colorBorder: k.colorBorder, icon: k.icon, min: k.min, max: k.max, autoAge: k.autoAge })),
  };
});
