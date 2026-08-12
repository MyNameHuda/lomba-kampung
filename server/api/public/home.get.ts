// GET /api/public/home — data needed by the public home page (lomba list + kategori + settings + admin status).
import { defineEventHandler } from "h3";
import { isAuthenticated } from "~~/server/utils/auth";
import { getLomba } from "~~/server/utils/db/lomba";
import { getKategori } from "~~/server/utils/db/kategori";
import { getSettings } from "~~/server/utils/db/settings";
import { countPendaftarByLombaBatch } from "~~/server/utils/db/pendaftar";

export default defineEventHandler(async (event) => {
  // Parallel: 3 lightweight reads + auth check.
  const [rows, kats, cfg, isAdmin] = await Promise.all([
    getLomba(true),
    getKategori(),
    getSettings(),
    isAuthenticated(event),
  ]);

  // Single batched COUNT(*) for ALL lomba — replaces the previous N+1 pattern
  // that issued 21 separate queries (one per lomba). At pg.Pool max=1, those
  // serialized to ~10s of pure DB roundtrip on Vercel. Now: 1 query, ~50-200ms.
  const countByLomba = await countPendaftarByLombaBatch(
    rows.map((l) => l.id),
    "disetujui"
  );

  const lomba = rows.map((l) => ({
    id: l.id,
    nama: l.nama,
    emoji: l.emoji,
    deskripsi: l.deskripsi,
    kategoriEligible: Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [],
    count: countByLomba.get(l.id) ?? 0,
    pendaftaranDibuka: l.pendaftaranDibuka,
    jadwalByKategori: l.jadwalByKategori || {},
  }));

  return {
    lomba,
    kategori: kats.map((k) => ({
      id: k.id,
      nama: k.nama,
      icon: k.icon,
      min: k.min,
      max: k.max,
      urutan: k.urutan,
      autoAge: k.autoAge,
      colorBg: k.colorBg,
      colorText: k.colorText,
      colorBorder: k.colorBorder,
    })),
    cfg: {
      appName: cfg?.appName || "Lomba Kampung",
      kampungName: cfg?.kampungName || "Kampung Kadu Jaya",
      tahunAktif: cfg?.tahunAktif || "HUT RI ke-81 (2026)",
    },
    isAdmin,
  };
});
