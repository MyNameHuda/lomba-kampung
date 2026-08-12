// GET /api/admin/lomba
// ?withCounts=1 → also returns per-lomba pendaftar count + juara summary (for the CRUD list page)
import { defineEventHandler, getQuery } from "h3";
import { requireAuth } from "~~/server/utils/auth";
import { getLomba } from "~~/server/utils/db/lomba";
import {
  countPendaftarByLombaBatch,
  getJuaraSummaryBatch,
} from "~~/server/utils/db/pendaftar";
import { getKategori } from "~~/server/utils/db/kategori";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const q = getQuery(event);
  const withCounts = q.withCounts === "1" || q.withCounts === "true";
  const lomba = await getLomba(true);
  if (!withCounts) return { lomba };

  // Two batched queries in parallel:
  // - 1 COUNT(*) per lomba for "disetujui" peserta (was: N queries via Promise.all)
  // - 1 GROUP BY (lomba, kategori, juara_rank) for juara summary (was: 1+N*3
  //   queries, each going through getJuaraReadiness which itself re-fetched
  //   the lomba by id)
  // The old version also called getPendaftar() (full table fetch) without
  // ever using the result — that was pure waste and is now removed.
  const [counts, juaraSummary, kats] = await Promise.all([
    countPendaftarByLombaBatch(
      lomba.map((l) => l.id),
      "disetujui"
    ),
    getJuaraSummaryBatch(lomba),
    getKategori(),
  ]);

  // Convert Map<id, number> → Record<id, number> for JSON serialization
  const countsRecord: Record<number, number> = {};
  for (const [id, c] of counts) countsRecord[id] = c;

  return {
    lomba,
    counts: countsRecord,
    juaraSummary,
    kats: kats.map((k) => ({
      id: k.id,
      nama: k.nama,
      colorBg: k.colorBg,
      colorText: k.colorText,
      colorBorder: k.colorBorder,
      icon: k.icon,
      min: k.min,
      max: k.max,
      autoAge: k.autoAge,
      inputMode: k.inputMode,
    })),
  };
});
