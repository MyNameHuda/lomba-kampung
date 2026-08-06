"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import KatTag from "@/components/kat-tag";
import { KAT_ICON, DEFAULT_KAT_ICON } from "@/lib/constants";
import type { LombaSlim as Lomba, KategoriSlim as Kat } from "@/lib/types";

export default function HomeClient({ lomba, kategori }: { lomba: Lomba[]; kategori: Kat[] }) {
  const [activeKat, setActiveKat] = useState<string | null>(null);

  // Build map for fast lookup
  const katMap = useMemo(() => new Map(kategori.map((k) => [k.id, k])), [kategori]);

  // Count lomba per kategori (for chip badges) — only kats with at least 1 lomba
  const countByKat = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lomba) {
      for (const kid of Array.isArray(l.kategoriEligible) ? l.kategoriEligible : []) {
        m.set(kid, (m.get(kid) ?? 0) + 1);
      }
    }
    return m;
  }, [lomba]);

  // Filter lomba by active kategori
  const visibleLomba = useMemo(() => {
    if (!activeKat) return lomba;
    return lomba.filter((l) => Array.isArray(l.kategoriEligible) && l.kategoriEligible.includes(activeKat));
  }, [lomba, activeKat]);

  // Only show kategori chips that have at least 1 lomba
  const availableKats = useMemo(
    () => kategori.filter((k) => (countByKat.get(k.id) ?? 0) > 0),
    [kategori, countByKat]
  );

  const activeKatName = activeKat ? katMap.get(activeKat)?.nama : null;

  return (
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

      {/* Filter chips — client-side, no URL change */}
      <div className="-mx-4 px-4 mb-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-1">
          <button
            type="button"
            onClick={() => setActiveKat(null)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold border-2 transition-all ${
              activeKat === null
                ? "bg-primary border-primary text-white"
                : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-primary hover:text-primary"
            }`}
          >
            <i className="fas fa-trophy text-[10px]"></i> Semua ({lomba.length})
          </button>
          {availableKats.map((k) => {
            const isActive = activeKat === k.id;
            const count = countByKat.get(k.id) ?? 0;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setActiveKat(isActive ? null : k.id)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold border-2 transition-all"
                style={
                  isActive
                    ? {
                        background: k.colorBg || "#E11D1D",
                        borderColor: k.colorBorder || k.colorBg || "#E11D1D",
                        color: k.colorText || "#FFFFFF",
                      }
                    : {
                        background: "#FFFFFF",
                        borderColor: k.colorBorder || "#E5E7EB",
                        color: "#6B7280",
                      }
                }
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = k.colorBg || "#E11D1D";
                    e.currentTarget.style.color = k.colorText || "#E11D1D";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = k.colorBorder || "#E5E7EB";
                    e.currentTarget.style.color = "#6B7280";
                  }
                }}
              >
                <span>{KAT_ICON[k.icon || "fa-user"] || DEFAULT_KAT_ICON}</span> {k.nama} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <h2 className="text-base font-bold my-3.5">
        {visibleLomba.length} Lomba Tersedia
        {activeKatName && <span className="text-[#6B7280] font-normal"> · Kategori {activeKatName}</span>}
      </h2>

      {visibleLomba.map((l) => {
        const tags = (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [])
          .map((kid) => katMap.get(kid))
          .filter(Boolean)
          .map((k) => (
            <KatTag
              key={k!.id}
              nama={k!.nama}
              colorBg={k!.colorBg}
              colorText={k!.colorText}
              colorBorder={k!.colorBorder}
            />
          ));
        // Show jadwal: pick the earliest tanggal across kategori, or render a
        // single "Berbagai tanggal" hint if multiple distinct dates.
        const jadwals = (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [])
          .map((kid) => l.jadwalByKategori?.[kid])
          .filter((j): j is NonNullable<typeof j> => !!j && j.tanggal != null);
        const uniqueDates = Array.from(new Set(jadwals.map((j) => j.tanggal))).sort((a, b) => (a as number) - (b as number));
        const dateFmt = (ts: number) =>
          new Date(ts * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
        const jadwalLabel =
          uniqueDates.length === 0
            ? null
            : uniqueDates.length === 1
            ? dateFmt(uniqueDates[0] as number)
            : `${dateFmt(uniqueDates[0] as number)} – ${dateFmt(uniqueDates[uniqueDates.length - 1] as number)}`;
        return (
          <Link key={l.id} href={`/lomba/${l.id}`} className="block no-underline text-inherit">
            <div className="lomba-card">
              <div className="lomba-icon">{l.emoji}</div>
              <div className="lomba-info flex flex-col gap-2">
                <h3>{l.nama}</h3>
                {jadwalLabel && (
                  <div className="text-[11px] text-[#6B7280] flex items-center gap-1.5">
                    <i className="far fa-calendar text-primary"></i>
                    <span className="font-semibold text-[#1F2937]">{jadwalLabel}</span>
                  </div>
                )}
                {l.deskripsi && <p className="text-[11px] text-[#6B7280] line-clamp-2 leading-relaxed">{l.deskripsi}</p>}
                <div className="flex flex-wrap gap-1.5">{tags}</div>
                <div className="text-[11px] text-[#6B7280]">
                  <i className="fas fa-users"></i> {l.count} pendaftar
                </div>
              </div>
              <i className="fas fa-chevron-right text-[#9CA3AF] self-center"></i>
            </div>
          </Link>
        );
      })}

      {visibleLomba.length === 0 && (
        <div className="text-center py-10 text-[#6B7280]">
          <i className="fas fa-trophy text-5xl text-[#9CA3AF] mb-3"></i>
          {activeKat ? (
            <>
              <p>Belum ada lomba untuk kategori <strong>{activeKatName}</strong>.</p>
              <button
                type="button"
                onClick={() => setActiveKat(null)}
                className="inline-block mt-3 text-primary text-sm font-semibold"
              >
                ← Lihat semua lomba
              </button>
            </>
          ) : (
            <p>Belum ada lomba yang dibuka.</p>
          )}
        </div>
      )}
    </main>
  );
}
