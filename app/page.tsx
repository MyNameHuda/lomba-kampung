import { getSettings, getLomba, getKategori, countPendaftarByLomba } from "@/lib/db";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import HomeClient from "./home-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicHome() {
  // Parallelize: settings + lomba + kategori + session independent
  // counts computed separately after lomba is known
  const [cfg, rows, kats, session] = await Promise.all([
    getSettings(),
    getLomba(true),
    getKategori(),
    getSession(),
  ]);
  const isAdmin = !!session.isAdmin;

  // Pre-compute pendaftar counts per lomba in parallel
  const counts = await Promise.all(rows.map(async (l) => [l.id, await countPendaftarByLomba(l.id)] as const));
  const countByLomba = new Map(counts);

  // Flatten lomba + count into the shape the client component needs.
  // Client component owns the kategori filter (useState + useMemo, no URL).
  const lomba = rows.map((l) => ({
    id: l.id,
    nama: l.nama,
    emoji: l.emoji,
    deskripsi: l.deskripsi,
    kategoriEligible: Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [],
    count: countByLomba.get(l.id) ?? 0,
  }));

  return (
    <div className="mobile-page">
      <header className="app-header">
        <div className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="Logo IPEKA" className="w-7 h-7 rounded-full object-cover bg-white/10" />
          <span>{cfg?.appName || "Lomba Kampung"}</span>
        </div>
        {isAdmin ? (
          <Link href="/admin" className="text-sm font-semibold bg-white/20 px-3 py-1.5 rounded-full flex items-center gap-1.5 no-underline text-white">
            <i className="fas fa-gauge-high"></i>
            <span className="hidden sm:inline">Admin</span>
          </Link>
        ) : (
          <Link href="/admin/login" className="text-sm opacity-80" title="Login Admin">
            <i className="fas fa-user-shield"></i>
          </Link>
        )}
      </header>

      <div className="mobile-hero">
        <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-[11px] font-semibold mb-2">
          🇮🇩 {cfg?.tahunAktif || "HUT RI ke-81 (2026)"}
        </div>
        <h1>Perlombaan 17 Agustus</h1>
        <p>{cfg?.kampungName || "Kampung Merdeka"}</p>
      </div>

      <HomeClient lomba={lomba} kategori={kats} />
    </div>
  );
}
