import AdminShell from "@/components/admin-shell";
import {
  getSettings,
  countLombaAktif,
  countAllPendaftar,
  countPendaftarByStatus,
  getLombaWithCount,
} from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  // Parallelize all DB calls — each is an HTTP roundtrip to Turso (~100-200ms).
  // Sequential was 6 × 150ms = ~900ms; parallel = max(150ms) = ~150ms.
  const [cfg, lombaAktif, totalPendaftar, pending, disetujui, lombaWithCount] = await Promise.all([
    getSettings(),
    countLombaAktif(),
    countAllPendaftar(),
    countPendaftarByStatus("pending"),
    countPendaftarByStatus("disetujui"),
    getLombaWithCount(),
  ]);
  const topLomba = lombaWithCount.sort((a, b) => b.count - a.count).slice(0, 4);

  return (
    <AdminShell title="Dashboard" breadcrumb="Beranda / Dashboard" activeNav="/admin">
      <div className="bg-gradient-to-br from-primary to-accent text-white rounded-2xl p-6 mb-5 relative overflow-hidden">
        <div className="text-[13px] opacity-90 mb-1.5">🇮🇩 Selamat datang,</div>
        <div className="text-xl font-extrabold mb-3.5">Admin Panitia 👋</div>
        <div className="text-xs opacity-85 mb-5">
          <i className="far fa-calendar"></i> Sabtu, 1 Agustus 2026
          &nbsp;·&nbsp;
          <i className="fas fa-location-dot"></i> {cfg?.kampungName || "Kampung Merdeka"}
        </div>
        <div className="flex gap-5 pt-4 border-t border-white/20">
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="text-[22px] font-extrabold leading-none">{lombaAktif}</div>
            <div className="text-[11px] opacity-85">Lomba aktif</div>
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="text-[22px] font-extrabold leading-none">{totalPendaftar}</div>
            <div className="text-[11px] opacity-85">Total pendaftar</div>
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="text-[22px] font-extrabold leading-none">{pending}</div>
            <div className="text-[11px] opacity-85">Pending</div>
          </div>
        </div>
      </div>

      <h3 className="text-sm font-bold my-3.5">Aksi Cepat</h3>
      <div className="quick-grid">
        <Link href="/admin/input-manual" className="quick-tile accent">
          <div className="qicon"><i className="fas fa-user-plus"></i></div>
          <div className="qlbl">Input Manual</div>
        </Link>
        <Link href="/admin/approval" className="quick-tile warning">
          <div className="qicon"><i className="fas fa-user-check"></i></div>
          <div className="qlbl">Approval <span className="ml-1 px-1.5 bg-[#FEF3C7] text-[#B45309] rounded-full text-[10px] font-bold">{pending}</span></div>
        </Link>
        <Link href="/admin/lomba" className="quick-tile primary">
          <div className="qicon"><i className="fas fa-trophy"></i></div>
          <div className="qlbl">Kelola Lomba</div>
        </Link>
        <Link href="/admin/peserta" className="quick-tile success">
          <div className="qicon"><i className="fas fa-clipboard-check"></i></div>
          <div className="qlbl">Tandai Hadir</div>
        </Link>
        <Link href="#" className="quick-tile info">
          <div className="qicon"><i className="fas fa-file-excel"></i></div>
          <div className="qlbl">Export Excel</div>
        </Link>
        <Link href="/admin/pengaturan" className="quick-tile">
          <div className="qicon" style={{ background: "#F9FAFB", color: "#6B7280" }}><i className="fas fa-gear"></i></div>
          <div className="qlbl">Pengaturan</div>
        </Link>
      </div>

      <h3 className="text-sm font-bold my-3.5">Ringkasan</h3>
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="icon"><i className="fas fa-trophy"></i></div>
          <div><div className="label">Lomba</div><div className="value">{lombaAktif}</div></div>
        </div>
        <div className="stat-card warning">
          <div className="icon"><i className="fas fa-hourglass-half"></i></div>
          <div><div className="label">Pending</div><div className="value">{pending}</div><div className="text-[10px] font-semibold text-[#B45309] mt-1">⚠ Perlu review</div></div>
        </div>
        <div className="stat-card success">
          <div className="icon"><i className="fas fa-user-check"></i></div>
          <div><div className="label">Disetujui</div><div className="value">{disetujui}</div></div>
        </div>
        <div className="stat-card info">
          <div className="icon"><i className="fas fa-users"></i></div>
          <div><div className="label">Total</div><div className="value">{totalPendaftar}</div></div>
        </div>
      </div>

      <h3 className="text-sm font-bold my-3.5">Lomba Terpopuler</h3>
      <div className="card overflow-hidden">
        {topLomba.length === 0 && (
          <div className="text-center py-8 text-[#6B7280] text-sm">Belum ada data</div>
        )}
        {topLomba.map((l, i) => (
          <div key={l.id} className="flex items-center gap-3 p-3.5 border-b border-[#E5E7EB] last:border-0">
            <div className="text-[22px] w-9 text-center leading-none">{l.emoji}</div>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5 leading-snug">
              <div className="font-semibold text-[13px]">{l.nama}</div>
              <div className="text-[11px] text-[#6B7280]">{l.count} pendaftar</div>
            </div>
            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              i === 0 ? "bg-[#DCFCE7] text-[#15803D]" :
              i === 1 || i === 2 ? "bg-[#DBEAFE] text-[#1E40AF]" :
              "bg-[#F9FAFB] text-[#6B7280]"
            }`}>#{i + 1}</div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
