"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type Kat = {
  id: string;
  nama: string;
  icon?: string;
  colorBg?: string;
  colorText?: string;
  colorBorder?: string;
};

type Lomba = {
  id: number;
  nama: string;
  emoji: string;
  kategoriEligible: string[];
  total: number;
  disetujui: number;
  hadir: number;
};

const KAT_ICON: Record<string, string> = {
  "fa-child": "👶",
  "fa-user": "🧑",
  "fa-user-tie": "👨‍💼",
  "fa-baby": "👶",
  "fa-user-graduate": "🎓",
  "fa-person-cane": "🧓",
};

export default function PesertaListClient({ lomba, kategori }: { lomba: Lomba[]; kategori: Kat[] }) {
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
  const availableKats = useMemo(() => kategori.filter((k) => (countByKat.get(k.id) ?? 0) > 0), [kategori, countByKat]);

  const activeKatName = activeKat ? katMap.get(activeKat)?.nama : null;

  return (
    <>
      {/* Info text */}
      <p className="text-[13px] text-[#6B7280] mb-3 leading-relaxed">
        Pilih lomba untuk mengelola peserta (tandai hadir, export Excel)
      </p>

      {/* Filter chips — client-side, no URL change */}
      <div className="-mx-5 px-5 mb-4 overflow-x-auto">
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
                <span>{KAT_ICON[k.icon || "fa-user"] || "👤"}</span> {k.nama} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Result count */}
      <div className="text-[12px] text-[#6B7280] mb-3 font-semibold">
        {visibleLomba.length} lomba
        {activeKatName && <span className="font-normal"> · Kategori {activeKatName}</span>}
      </div>

      {/* Lomba grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleLomba.map((l) => (
          <Link
            key={l.id}
            href={`/admin/peserta/${l.id}`}
            className="card p-5 no-underline text-inherit hover:border-primary transition-all"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl leading-none">{l.emoji}</div>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5 leading-snug">
                <div className="font-bold text-[15px]">{l.nama}</div>
                <div className="text-[11px] text-[#6B7280]">Klik untuk kelola peserta</div>
              </div>
              <i className="fas fa-chevron-right text-[#9CA3AF]"></i>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="flex flex-col gap-0.5">
                <div className="text-[20px] font-extrabold leading-tight">{l.total}</div>
                <div className="text-[10px] text-[#6B7280]">Total</div>
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="text-[20px] font-extrabold leading-tight text-[#15803D]">{l.disetujui}</div>
                <div className="text-[10px] text-[#6B7280]">Disetujui</div>
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="text-[20px] font-extrabold leading-tight text-[#1E40AF]">{l.hadir}</div>
                <div className="text-[10px] text-[#6B7280]">Hadir</div>
              </div>
            </div>
          </Link>
        ))}
        {visibleLomba.length === 0 && (
          <div className="col-span-2 text-center py-8 text-[#6B7280]">
            {activeKat ? (
              <>
                Belum ada lomba untuk kategori <strong>{activeKatName}</strong>.
                <button
                  type="button"
                  onClick={() => setActiveKat(null)}
                  className="block mx-auto mt-3 text-primary text-sm font-semibold"
                >
                  ← Lihat semua lomba
                </button>
              </>
            ) : (
              "Belum ada lomba."
            )}
          </div>
        )}
      </div>
    </>
  );
}
