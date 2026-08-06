"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import KatTag from "@/components/kat-tag";
import { KAT_ICON, DEFAULT_KAT_ICON } from "@/lib/constants";
import { formatTanggalLomba, lombaTimeStatus, publicKategoriName, groupKategoriByPublicName } from "@/lib/format";
import type { LombaSlim as Lomba, KategoriSlim as Kat } from "@/lib/types";

export default function HomeClient({ lomba, kategori }: { lomba: Lomba[]; kategori: Kat[] }) {
  // activeKat is a PUBLIC NAME (e.g. "Anak", "Balita", "Ibu-Ibu") — not a
  // raw kategoriId. This collapses k_anak_l + k_anak_p into a single "Anak"
  // filter chip on public pages. Admin still sees them separately.
  const [activeKat, setActiveKat] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Build map for fast lookup
  const katMap = useMemo(() => new Map(kategori.map((k) => [k.id, k])), [kategori]);

  // Count lomba per PUBLIC NAME (for chip badges) — k_anak_l + k_anak_p
  // both map to "Anak" so they share one count. Only count lomba once per
  // public name even if it has multiple sub-kategori in that group.
  const countByPublicName = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lomba) {
      const publicNames = new Set<string>();
      for (const kid of Array.isArray(l.kategoriEligible) ? l.kategoriEligible : []) {
        publicNames.add(publicKategoriName(kid));
      }
      for (const name of publicNames) {
        m.set(name, (m.get(name) ?? 0) + 1);
      }
    }
    return m;
  }, [lomba]);

  // Only show public-name chips that have at least 1 lomba
  // Preserve insertion order from the master kategori list (so the chip
  // order is stable: Balita → Anak → Ibu-Ibu).
  const availablePublicKats = useMemo(() => {
    const seen = new Set<string>();
    const out: { publicName: string; sample: Kat }[] = [];
    for (const k of kategori) {
      const publicName = publicKategoriName(k.id);
      if (seen.has(publicName)) continue;
      seen.add(publicName);
      if ((countByPublicName.get(publicName) ?? 0) > 0) {
        // Use the first matching kat as the color/icon source for the chip.
        out.push({ publicName, sample: k });
      }
    }
    return out;
  }, [kategori, countByPublicName]);

  // Filter lomba by active public-name kategori + search query
  // (search matches nama, case-insensitive; kategori filter is AND-ed)
  const visibleLomba = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lomba.filter((l) => {
      if (activeKat) {
        // activeKat is a public name; match if any eligible kategori
        // maps to this public name (e.g. "Anak" matches both k_anak_l
        // and k_anak_p).
        const hasMatch = (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : []).some(
          (kid) => publicKategoriName(kid) === activeKat
        );
        if (!hasMatch) return false;
      }
      if (q && !l.nama.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lomba, activeKat, search]);

  const isFiltered = search.trim() !== "" || activeKat !== null;

  return (
    <main className="app-content w-full lg:max-w-[1100px] mx-auto">
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
          {/* Chips are keyed by PUBLIC NAME (e.g. "Anak" for both k_anak_l
              and k_anak_p) so warga sees one combined filter. The chip's
              color/icon comes from the first matching kategori in the
              master list (e.g. k_anak_l's color for "Anak"). */}
          {availablePublicKats.map(({ publicName, sample: k }) => {
            const isActive = activeKat === publicName;
            const count = countByPublicName.get(publicName) ?? 0;
            return (
              <button
                key={publicName}
                type="button"
                onClick={() => setActiveKat(isActive ? null : publicName)}
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
                <span>{KAT_ICON[k.icon || "fa-user"] || DEFAULT_KAT_ICON}</span> {publicName} ({count})
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
            {activeKat && <span className="text-[#9CA3AF]"> · Kategori <strong>{activeKat}</strong></span>}
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
                    <p className="text-[11px] text-[#6B7280] line-clamp-2 leading-relaxed break-words">{l.deskripsi}</p>
                  )}
                  {/* Tags + tanggal — stack vertical on mobile (avoid overflow),
                      horizontal on sm+ when there's enough room. Grouped by
                      PUBLIC NAME so k_anak_l + k_anak_p show as a single
                      "Anak" row on public cards. Jadwal shown is the
                      earliest across the collapsed group. */}
                  {eligibleKats.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {groupKategoriByPublicName(
                        (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : []).filter((kid) => !!katMap.get(kid))
                      ).map(({ publicName, kategoriIds }) => {
                        // Use the first eligible kat as the color/icon source
                        // for the KatTag (any sub-kategori in the group shares
                        // the public name; colors might differ slightly but
                        // picking the first keeps it deterministic).
                        const repKat = katMap.get(kategoriIds[0])!;
                        // Pick the earliest tanggal across the group so we
                        // show a single jadwal per public name. If any
                        // sub-kategori in the group has a tanggal, use the
                        // earliest one (most relevant for warga).
                        const allJadwals = kategoriIds
                          .map((kid) => l.jadwalByKategori?.[kid])
                          .filter((j): j is { kategoriId: string; tanggal: number; jam: string | null } => !!j && j.tanggal != null);
                        const earliestJadwal = allJadwals.length
                          ? allJadwals.reduce((min, j) => (j.tanggal < min.tanggal ? j : min))
                          : null;
                        const hasJadwal = !!earliestJadwal;
                        return (
                          <div key={publicName} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 sm:flex-wrap text-[10px]">
                            <KatTag
                              nama={publicName}
                              colorBg={repKat.colorBg}
                              colorText={repKat.colorText}
                              colorBorder={repKat.colorBorder}
                            />
                            {hasJadwal ? (
                              <span className="text-[10px] text-[#6B7280] flex items-center gap-1">
                                <i className="far fa-calendar text-[10px] text-primary"></i>
                                <span className="font-semibold text-[#374151]">
                                  {formatTanggalLomba(earliestJadwal!.tanggal as number, "short")}
                                </span>
                                {earliestJadwal!.jam && <span className="text-[#9CA3AF]">· {earliestJadwal!.jam}</span>}
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
