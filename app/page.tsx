import { getSettings, getLomba, getKategori, countPendaftarByLomba } from "@/lib/db";
import { getSession } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicHome() {
  const [cfg, rows, kats, session] = await Promise.all([
    getSettings(),
    getLomba(true),
    getKategori(),
    getSession(),
  ]);
  const katMap = new Map(kats.map((k) => [k.id, k]));
  const isAdmin = !!session.isAdmin;

  // Pre-compute pendaftar counts per lomba in parallel
  const countByLomba = new Map(
    (await Promise.all(rows.map(async (l) => [l.id, await countPendaftarByLomba(l.id)]))).map(
      ([id, n]) => [id, n as number]
    )
  );

  return (
    <div className="mobile-page">
      <header className="app-header">
        <div className="logo">
          <i className="fas fa-flag"></i>
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

      <main className="app-content">
        <div className="bg-white border border-[#E5E7EB] rounded p-4 mb-5 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center flex-shrink-0">
            <i className="fas fa-circle-info"></i>
          </div>
          <div className="text-xs flex-1 leading-relaxed">
            <strong className="block text-[#1F2937] mb-1">Pendaftaran selalu dibuka</strong>
            <span className="text-[#6B7280]">Kapasitas tanpa batas — daftar kapan saja</span>
          </div>
        </div>

        <h2 className="text-base font-bold my-3.5">{rows.length} Lomba Tersedia</h2>

        {rows.map((l) => {
          const tags = (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [])
            .map((kid) => katMap.get(kid))
            .filter(Boolean)
            .map((k) => (
              <span key={k!.id} className={`tag tag-${k!.id.replace("k_", "")}`}>{k!.nama}</span>
            ));
          const peserta = countByLomba.get(l.id) ?? 0;
          return (
            <Link key={l.id} href={`/lomba/${l.id}`} className="block no-underline text-inherit">
              <div className="lomba-card">
                <div className="lomba-icon">{l.emoji}</div>
                <div className="lomba-info flex flex-col gap-2">
                  <h3>{l.nama}</h3>
                  <div className="flex flex-wrap gap-1.5">{tags}</div>
                  <div className="text-[11px] text-[#6B7280]">
                    <i className="fas fa-users"></i> {peserta} pendaftar
                  </div>
                </div>
                <i className="fas fa-chevron-right text-[#9CA3AF] self-center"></i>
              </div>
            </Link>
          );
        })}

        {rows.length === 0 && (
          <div className="text-center py-10 text-[#6B7280]">
            <i className="fas fa-trophy text-5xl text-[#9CA3AF] mb-3"></i>
            <p>Belum ada lomba yang dibuka.</p>
          </div>
        )}
      </main>
    </div>
  );
}
