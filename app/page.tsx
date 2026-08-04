import { getSettings, getLomba, getKategori, countPendaftarByLomba } from "@/lib/db";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import KatTag from "@/components/kat-tag";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const KAT_ICON: Record<string, string> = {
  "fa-child": "👶",
  "fa-user": "🧑",
  "fa-user-tie": "👨‍💼",
  "fa-baby": "👶",
  "fa-user-graduate": "🎓",
  "fa-person-cane": "🧓",
};

export default async function PublicHome({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string }>;
}) {
  const [sp, cfg, rows, kats, session] = await Promise.all([
    searchParams,
    getSettings(),
    getLomba(true),
    getKategori(),
    getSession(),
  ]);
  const activeKat = sp.kategori && kats.some((k) => k.id === sp.kategori) ? sp.kategori : null;
  const katMap = new Map(kats.map((k) => [k.id, k]));
  const isAdmin = !!session.isAdmin;

  // Pre-compute pendaftar counts per lomba in parallel
  const countByLomba = new Map(
    (await Promise.all(rows.map(async (l) => [l.id, await countPendaftarByLomba(l.id)]))).map(
      ([id, n]) => [id, n as number]
    )
  );

  // Count lomba per kategori for the filter chips
  const countByKat = new Map<string, number>();
  for (const l of rows) {
    for (const kid of Array.isArray(l.kategoriEligible) ? l.kategoriEligible : []) {
      countByKat.set(kid, (countByKat.get(kid) ?? 0) + 1);
    }
  }

  // Filter lomba by active kategori (if any)
  const visibleRows = activeKat
    ? rows.filter((l) => Array.isArray(l.kategoriEligible) && l.kategoriEligible.includes(activeKat))
    : rows;

  const activeKatName = activeKat ? katMap.get(activeKat)?.nama : null;

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

        {/* Filter chips — horizontal scroll on mobile, links via URL params */}
        <div className="-mx-4 px-4 mb-4 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-1">
            <Link
              href="/"
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold border-2 transition-all ${
                activeKat === null
                  ? "bg-primary border-primary text-white"
                  : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-primary hover:text-primary"
              }`}
            >
              <i className="fas fa-trophy text-[10px]"></i> Semua ({rows.length})
            </Link>
            {kats.map((k) => {
              const isActive = activeKat === k.id;
              const count = countByKat.get(k.id) ?? 0;
              if (count === 0) return null; // Hide kategori with no lomba
              return (
                <Link
                  key={k.id}
                  href={`/?kategori=${k.id}`}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold border-2 transition-all ${
                    isActive
                      ? "bg-primary border-primary text-white"
                      : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-primary hover:text-primary"
                  }`}
                >
                  <span>{KAT_ICON[k.icon] || "👤"}</span> {k.nama} ({count})
                </Link>
              );
            })}
          </div>
        </div>

        <h2 className="text-base font-bold my-3.5">
          {visibleRows.length} Lomba Tersedia
          {activeKatName && <span className="text-[#6B7280] font-normal"> · Kategori {activeKatName}</span>}
        </h2>

        {visibleRows.map((l) => {
          const tags = (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [])
            .map((kid) => katMap.get(kid))
            .filter(Boolean)
            .map((k) => (
              <KatTag key={k!.id} nama={k!.nama} colorBg={k!.colorBg} colorText={k!.colorText} colorBorder={k!.colorBorder} />
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

        {visibleRows.length === 0 && (
          <div className="text-center py-10 text-[#6B7280]">
            <i className="fas fa-trophy text-5xl text-[#9CA3AF] mb-3"></i>
            {activeKat ? (
              <>
                <p>Belum ada lomba untuk kategori <strong>{activeKatName}</strong>.</p>
                <Link href="/" className="inline-block mt-3 text-primary text-sm font-semibold no-underline">
                  ← Lihat semua lomba
                </Link>
              </>
            ) : (
              <p>Belum ada lomba yang dibuka.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
