// GET /api/public/home — data needed by the public home page (lomba list + kategori + settings + admin status).
import { defineEventHandler, setResponseHeader } from "h3";
import { all } from "~~/server/utils/db/client";
import { hasSessionCookie } from "~~/server/utils/auth";
import { getLomba } from "~~/server/utils/db/lomba";
import { getKategori } from "~~/server/utils/db/kategori";
import { getSettings } from "~~/server/utils/db/settings";
import { countPendaftarByLombaBatch } from "~~/server/utils/db/pendaftar";

// Vercel edge cache (s-maxage 30s, serve stale up to 1 day). The / page wraps
// this in SSR swr but the JSON API is hit directly by the client on hydration
// and re-fetched on every navigation, so caching it is the bigger win.
//
// Uses hasSessionCookie() instead of isAuthenticated() to AVOID calling
// h3's useSession — useSession always sets a Set-Cookie response header,
// which causes Vercel to skip edge cache (cookies are user-specific).
// hasSessionCookie is a passive boolean check on the request cookie header.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "public, s-maxage=5, stale-while-revalidate=86400");
  // Parallel: 3 lightweight reads + passive auth hint (no DB, no cookie refresh).
  const [rows, kats, cfg] = await Promise.all([
    getLomba(true),
    getKategori(),
    getSettings(),
  ]);
  const isAdmin = hasSessionCookie(event);

  // Single batched COUNT(*) for ALL lomba — replaces the previous N+1 pattern
  // that issued 21 separate queries (one per lomba). At pg.Pool max=1, those
  // serialized to ~10s of pure DB roundtrip on Vercel. Now: 1 query, ~50-200ms.
  const [countByLomba, countByKategori] = await Promise.all([
    countPendaftarByLombaBatch(
      rows.map((l) => l.id),
      "disetujui"
    ),
    // Per-kategori peserta count across ALL lomba. Used by the home page
    // filter chips so "Balita (5)" shows 5 Balita peserta (not 5 lomba with
    // Balita eligible, which was the old confusing behavior). One query,
    // one round-trip, single GROUP BY scan.
    all<{ kategori_id: string; c: number }>(
      "SELECT kategori_id, COUNT(*) as c FROM pendaftar WHERE status = $1 GROUP BY kategori_id",
      "disetujui"
    ),
  ]);

  const countByKat: Record<string, number> = {};
  for (const r of countByKategori) countByKat[r.kategori_id] = Number(r.c);

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
      count: countByKat[k.id] ?? 0,
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
