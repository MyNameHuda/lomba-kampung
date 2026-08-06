"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import KatTag from "@/components/kat-tag";
import { KAT_ICON, DEFAULT_KAT_ICON } from "@/lib/constants";
import { formatTanggalLomba, lombaTimeStatus } from "@/lib/format";
import type { LombaSlim as Lomba, KategoriSlim as Kat } from "@/lib/types";

export default function HomeClient({ lomba, kategori }: { lomba: Lomba[]; kategori: Kat[] }) {
  const [activeKat, setActiveKat] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  // Only show kategori chips that have at least 1 lomba
  const availableKats = useMemo(
    () => kategori.filter((k) => (countByKat.get(k.id) ?? 0) > 0),
    [kategori, countByKat]
  );

  // Filter lomba by active kategori + search query
  // (search matches nama, case-insensitive; kategori filter is AND-ed)
  const visibleLomba = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lomba.filter((l) => {
      if (activeKat && !(Array.isArray(l.kategoriEligible) && l.kategoriEligible.includes(activeKat))) {
        return false;
      }
      if (q && !l.nama.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lomba, activeKat, search]);

  const activeKatName = activeKat ? katMap.get(activeKat)?.nama : null;
  const isFiltered = search.trim() !== "" || activeKat !== null;

  return (
    <main className="app-content max-w-[1100px] mx-auto">
      {/* ====== Search bar (full-width on mobile, capped on desktop) ====== */}
      <div className="relative mb-3">
        <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-sm"></i>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama lomba..."
          className="w-full pl-10 pr-10 py-2.5 border border-[#E5E7EB] rounded-lg text-sm bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-colors"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#6B7280] flex items-center justify-center"
            aria-label="Bersihkan pencarian"
          >
            <i className="fas fa-xmark text-[12px]"></i>
          </button>
        )}
      </div>

      {/* ====== Filter chips — client-side, no URL change ====== */}
      <div className="-mx-4 px-4 mb-3 overflow-x-auto">
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

      {/* ====== Result count + reset (only when filter is active) ====== */}
      {isFiltered && (
        <div className="flex items-center justify-between text-[12px] text-[#6B7280] mb-3">
          <span>
            Menampilkan <strong className="text-[#1F2937]">{visibleLomba.length}</strong> dari {lomba.length} lomba
            {activeKatName && <span className="text-[#9CA3AF]"> · Kategori <strong>{activeKatName}</strong></span>}
          </span>
          <button
            type="button"
            onClick={() => { setSearch(""); setActiveKat(null); }}
            className="text-primary font-semibold hover:underline"
          >
            <i className="fas fa-xmark text-[10px]"></i> Reset
          </button>
        </div>
      )}

      {/* ====== Card grid (1 col mobile/tablet, 2 col desktop) ====== */}
      {visibleLomba.length === 0 ? (
        <div className="card p-10 text-center text-[#6B7280]">
          <i className="fas fa-search text-5xl text-[#D1D5DB] mb-3 block"></i>
          <strong className="block text-[#1F2937] text-base mb-1">Tidak ada lomba yang cocok</strong>
          <p className="text-[13px]">Coba kata kunci lain atau ubah filter kategori.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {visibleLomba.map((l) => {
            const eligibleKats = (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [])
              .map((kid) => katMap.get(kid))
              .filter((k): k is NonNullable<typeof k> => !!k);
            // "peserta" = officially approved (status='disetujui') only. Server
            // already filters, so l.count is the approved count.
            const pesertaCount = l.count ?? 0;
            return (
              <Link
                key={l.id}
                href={`/lomba/${l.id}`}
                className="lomba-card group"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="lomba-icon">{l.emoji}</div>
                <div className="lomba-info flex flex-col gap-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="flex-1 min-w-0 break-words">{l.nama}</h3>
                    {(() => {
                      const ts = lombaTimeStatus(l.jadwalByKategori, l.kategoriEligible);
                      const noPeserta = pesertaCount === 0;
                      const cfg: Record<string, { label: string; bg: string; fg: string }> = {
                        "akan-datang": { label: "Akan Datang", bg: "#8B5CF6", fg: "#FFFFFF" },
                        "sedang-berlangsung": { label: "Berlangsung", bg: "#FBBF24", fg: "#92400E" },
                        "lewat-jadwal": { label: "Lewat", bg: "#6B7280", fg: "#FFFFFF" },
                        "belum-dijadwalkan": noPeserta
                          ? { label: "Belum Mulai", bg: "#E5E7EB", fg: "#374151" }
                          : { label: "Sedang Berlangsung", bg: "#FBBF24", fg: "#92400E" },
                      };
                      const c = cfg[ts];
                      if (!c || !c.label) return null;
                      return (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: c.bg, color: c.fg }}
                        >
                          {c.label}
                        </span>
                      );
                    })()}
                    {l.pendaftaranDibuka === false && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B] whitespace-nowrap">
                        <i className="fas fa-lock"></i> Ditutup
                      </span>
                    )}
                  </div>
                  {l.deskripsi && (
                    <p className="text-[11px] text-[#6B7280] line-clamp-2 leading-relaxed">{l.deskripsi}</p>
                  )}
                  {/* Tags + tanggal — compact horizontal layout for grid cards */}
                  {eligibleKats.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {eligibleKats.map((k) => {
                        const j = l.jadwalByKategori?.[k.id];
                        const hasJadwal = j && j.tanggal != null;
                        return (
                          <div key={k.id} className="flex items-center gap-2 flex-wrap text-[10px]">
                            <KatTag
                              nama={k.nama}
                              colorBg={k.colorBg}
                              colorText={k.colorText}
                              colorBorder={k.colorBorder}
                            />
                            {hasJadwal ? (
                              <span className="text-[10px] text-[#6B7280] flex items-center gap-1">
                                <i className="far fa-calendar text-[10px] text-primary"></i>
                                <span className="font-semibold text-[#374151]">
                                  {formatTanggalLomba(j!.tanggal as number, "short")}
                                </span>
                                {j!.jam && <span className="text-[#9CA3AF]">· {j!.jam}</span>}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#9CA3AF] italic">Belum dijadwalkan</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Peserta count — only counts admin-approved (status='disetujui'). */}
                  {pesertaCount > 0 ? (
                    <div className="self-start inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1F2937] bg-primary-light border border-[#FCE0E0] px-2.5 py-1 rounded-md">
                      <i className="fas fa-users text-primary text-[11px]"></i>
                      <span>{pesertaCount} peserta</span>
                    </div>
                  ) : (
                    <div className="self-start inline-flex items-center gap-1.5 text-[11px] text-[#9CA3AF] italic">
                      <i className="fas fa-user-slash text-[10px]"></i>
                      <span>Belum ada peserta</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Footer note when no filter is active */}
      {!isFiltered && (
        <p className="text-center text-[11px] text-[#9CA3AF] mt-4">
          Kapasitas tanpa batas — daftar kapan saja
        </p>
      )}
    </main>
  );
}
