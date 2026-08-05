"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNotify } from "@/components/notify-provider";
import { getInitials } from "@/lib/format";
import { KAT_ICON, DEFAULT_KAT_ICON } from "@/lib/constants";

// Slim pendaftar shape used in the Juara picker.
// juaraRank is the current Juara rank (1/2/3) for this pendaftar, or null.
export type PendaftarWithJuara = {
  id: number;
  nomor: string;
  nama: string;
  umur: number;
  jenisKelamin: "L" | "P";
  juaraRank: 1 | 2 | 3 | null;
};

type Section = {
  kategoriId: string;
  kategoriNama: string;
  kategoriIcon: string;
  kategoriColorBg: string;
  kategoriColorText: string;
  kategoriColorBorder: string;
  ageRange: string;
  pendaftar: PendaftarWithJuara[];
};

type Readiness = {
  allReady: boolean;
  missingKategori: string[];
  perKategori: Record<string, { ju1: number; ju2: number; ju3: number }>;
};

type Props = {
  lomba: { id: number; nama: string; emoji: string; status: "draft" | "aktif" | "selesai" };
  sections: Section[];
  readiness: Readiness;
};

export default function JuaraClient({ lomba, sections, readiness }: Props) {
  const router = useRouter();
  const notify = useNotify();
  const [state, setState] = useState<Props>({ lomba, sections, readiness });
  const [busy, setBusy] = useState<number | null>(null);
  const [busySelesai, setBusySelesai] = useState(false);

  // Sync local state with server after router.refresh()
  useEffect(() => {
    setState({ lomba, sections, readiness });
  }, [lomba, sections, readiness]);

  const isLocked = state.lomba.status === "selesai";
  const isDraft = state.lomba.status === "draft";

  async function setJuara(pendaftarId: number, rank: 1 | 2 | 3) {
    setBusy(pendaftarId);
    // Optimistic update
    setState((prev) => {
      const newSections = prev.sections.map((sec) => ({
        ...sec,
        pendaftar: sec.pendaftar.map((p) => {
          if (p.id === pendaftarId) return { ...p, juaraRank: rank };
          // Un-pick any other pendaftar with same rank in same kategori
          // (server already enforces this, but we mirror for instant UI feedback)
          return p;
        }).map((p) => {
          if (p.id !== pendaftarId && p.juaraRank === rank) {
            // Same (lomba, kategori) so they share sections — clear if in same section
            const inSameSection = prev.sections
              .find((s) => s.pendaftar.some((pp) => pp.id === p.id))?.kategoriId ===
              prev.sections.find((s) => s.pendaftar.some((pp) => pp.id === pendaftarId))?.kategoriId;
            if (inSameSection) return { ...p, juaraRank: null };
          }
          return p;
        }),
      }));
      // Recompute perKategori readiness
      const perKategori: Record<string, { ju1: number; ju2: number; ju3: number }> = {};
      const missingKategori: string[] = [];
      for (const sec of newSections) {
        const counts = { ju1: 0, ju2: 0, ju3: 0 };
        for (const p of sec.pendaftar) {
          if (p.juaraRank) counts[`ju${p.juaraRank}` as "ju1" | "ju2" | "ju3"]++;
        }
        perKategori[sec.kategoriId] = counts;
        if (counts.ju1 < 1 || counts.ju2 < 1) missingKategori.push(sec.kategoriId);
      }
      return {
        ...prev,
        sections: newSections,
        readiness: {
          allReady: missingKategori.length === 0,
          missingKategori,
          perKategori,
        },
      };
    });

    try {
      const res = await fetch(`/api/admin/lomba/${lomba.id}/juara`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendaftarId, rank }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal");
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Gagal set Juara");
      router.refresh(); // rollback optimistic
    } finally {
      setBusy(null);
    }
  }

  async function clearJuara(pendaftarId: number) {
    setBusy(pendaftarId);
    setState((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) => ({
        ...sec,
        pendaftar: sec.pendaftar.map((p) => (p.id === pendaftarId ? { ...p, juaraRank: null } : p)),
      })),
    }));
    try {
      const res = await fetch(`/api/admin/lomba/${lomba.id}/juara`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendaftarId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      notify.error("Gagal clear Juara");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function selesaikanLomba() {
    const ok = await notify.confirm({
      title: "Selesaikan Lomba",
      message: "Yakin selesaikan lomba ini? Juara 1/2/3 akan diumumkan ke publik. Tidak bisa di-undo.",
      confirmText: "Selesaikan",
      variant: "danger",
    });
    if (!ok) return;
    setBusySelesai(true);
    try {
      const res = await fetch(`/api/admin/lomba/${lomba.id}/selesai`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        notify.error(data.error || "Gagal selesaikan lomba");
        return;
      }
      notify.success("Lomba selesai! Juara 1/2/3 tampil di publik.");
      router.refresh();
    } catch {
      notify.error("Gagal selesaikan lomba");
    } finally {
      setBusySelesai(false);
    }
  }

  // Empty state: no eligible kategori
  if (state.sections.length === 0) {
    return (
      <div className="card p-8 text-center">
        <i className="fas fa-list text-4xl text-[#D1D5DB] mb-2"></i>
        <strong className="block text-[#1F2937] text-base">Lomba belum punya kategori</strong>
        <p className="text-sm text-[#6B7280] mt-1">Tambah kategori di lomba ini dulu untuk mulai pilih Juara.</p>
        <Link href="/admin/lomba" className="btn btn-secondary btn-sm mt-4 inline-flex" style={{ width: "auto" }}>
          <i className="fas fa-arrow-left"></i> Kembali
        </Link>
      </div>
    );
  }

  // Compute global stats for the header
  const totalPeserta = state.sections.reduce((sum, s) => sum + s.pendaftar.length, 0);
  const totalJuara = state.sections.reduce(
    (sum, s) => sum + s.pendaftar.filter((p) => p.juaraRank !== null).length,
    0
  );
  const readyKategoriCount = state.sections.length - state.readiness.missingKategori.length;

  return (
    <>
      {/* Header */}
      <div className="card p-4 mb-4">
        <div className="flex items-start gap-3 mb-2">
          <div className="text-3xl">{state.lomba.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-[#1F2937] leading-tight">{state.lomba.nama}</h1>
              <span className={`status-badge ${
                state.lomba.status === "aktif" ? "status-approved" :
                state.lomba.status === "selesai" ? "status-hadir" : "status-pending"
              }`}>
                <i className="fas fa-circle" style={{ fontSize: 6 }}></i> {state.lomba.status}
              </span>
            </div>
            <div className="text-xs text-[#6B7280] mt-1">
              {state.sections.length} kategori · {totalPeserta} peserta · {totalJuara} Juara dipilih
            </div>
          </div>
        </div>
        {!isLocked && !isDraft && (
          <div className={`text-[12px] mt-2 px-3 py-2 rounded-md leading-snug ${
            state.readiness.allReady
              ? "bg-[#DCFCE7] text-[#15803D]"
              : "bg-[#FEF3C7] text-[#92400E]"
          }`}>
            {state.readiness.allReady ? (
              <><i className="fas fa-check-circle"></i> Semua kategori sudah punya Juara 1&2. Siap selesaikan!</>
            ) : (
              <><i className="fas fa-info-circle"></i> {readyKategoriCount}/{state.sections.length} kategori sudah lengkap Juara 1&2. Selesaikan lomba setelah semua kategori siap.</>
            )}
          </div>
        )}
        {isDraft && (
          <div className="text-[12px] mt-2 px-3 py-2 rounded-md bg-[#FEE2E2] text-[#991B1B]">
            <i className="fas fa-ban"></i> Lomba masih draft. Aktifkan dulu sebelum pilih Juara.
          </div>
        )}
        {isLocked && (
          <div className="text-[12px] mt-2 px-3 py-2 rounded-md bg-[#DBEAFE] text-[#1E40AF]">
            <i className="fas fa-lock"></i> Lomba sudah selesai. Juara di bawah ini sudah final dan tampil di halaman publik.
          </div>
        )}
      </div>

      {/* Sections per kategori */}
      {state.sections.map((sec) => {
        const counts = state.readiness.perKategori[sec.kategoriId] || { ju1: 0, ju2: 0, ju3: 0 };
        const sectionReady = counts.ju1 >= 1 && counts.ju2 >= 1;
        return (
          <section key={sec.kategoriId} className="juara-section">
            <header className="juara-section-header" style={{ borderColor: sec.kategoriColorBorder || "#E5E7EB" }}>
              <span className="juara-section-icon" style={{ background: sec.kategoriColorBg, color: sec.kategoriColorText }}>
                {KAT_ICON[sec.kategoriIcon] || DEFAULT_KAT_ICON}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[14px] text-[#1F2937]">{sec.kategoriNama}</div>
                <div className="text-[11px] text-[#6B7280]">{sec.ageRange}</div>
              </div>
              <div className="flex gap-1">
                <JuaraBadge rank={1} count={counts.ju1} disabled={isLocked || isDraft} />
                <JuaraBadge rank={2} count={counts.ju2} disabled={isLocked || isDraft} />
                <JuaraBadge rank={3} count={counts.ju3} disabled={isLocked || isDraft} />
              </div>
              {sectionReady ? (
                <span className="juara-status-pill ready">✓ Ready</span>
              ) : (
                <span className="juara-status-pill pending">⚠ Belum</span>
              )}
            </header>

            {sec.pendaftar.length === 0 ? (
              <div className="juara-empty">
                <i className="fas fa-user-slash text-2xl text-[#D1D5DB]"></i>
                <span>Belum ada peserta disetujui di kategori ini</span>
              </div>
            ) : (
              <div className="space-y-2">
                {sec.pendaftar.map((p) => (
                  <article
                    key={p.id}
                    className={`juara-card ${p.juaraRank ? `is-juara-${p.juaraRank}` : ""}`}
                    style={p.juaraRank ? { borderLeftColor: ["#FFD700", "#C0C0C0", "#CD7F32"][p.juaraRank - 1] } : undefined}
                  >
                    <div className="pc-avatar">{getInitials(p.nama)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="juara-nama">{p.nama}</div>
                      <div className="juara-meta">
                        {p.jenisKelamin === "L" ? "♂" : "♀"} {p.jenisKelamin === "L" ? "Laki-laki" : "Perempuan"} · {p.umur} tahun
                      </div>
                    </div>
                    {!isLocked && !isDraft && (
                      <div className="juara-actions">
                        <button
                          onClick={() => setJuara(p.id, 1)}
                          disabled={busy === p.id}
                          className={`juara-rank-btn rank-1 ${p.juaraRank === 1 ? "active" : ""}`}
                          title="Juara 1"
                          aria-label="Juara 1"
                        >
                          🥇
                        </button>
                        <button
                          onClick={() => setJuara(p.id, 2)}
                          disabled={busy === p.id}
                          className={`juara-rank-btn rank-2 ${p.juaraRank === 2 ? "active" : ""}`}
                          title="Juara 2"
                          aria-label="Juara 2"
                        >
                          🥈
                        </button>
                        <button
                          onClick={() => setJuara(p.id, 3)}
                          disabled={busy === p.id}
                          className={`juara-rank-btn rank-3 ${p.juaraRank === 3 ? "active" : ""}`}
                          title="Juara 3"
                          aria-label="Juara 3"
                        >
                          🥉
                        </button>
                        {p.juaraRank !== null && (
                          <button
                            onClick={() => clearJuara(p.id)}
                            disabled={busy === p.id}
                            className="juara-clear-btn"
                            title="Clear"
                            aria-label="Clear"
                          >
                            <i className="fas fa-xmark"></i>
                          </button>
                        )}
                      </div>
                    )}
                    {isLocked && p.juaraRank !== null && (
                      <div className="juara-medal">
                        {p.juaraRank === 1 ? "🥇" : p.juaraRank === 2 ? "🥈" : "🥉"}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Bottom action: Selesaikan Lomba */}
      {!isLocked && !isDraft && (
        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            onClick={selesaikanLomba}
            disabled={!state.readiness.allReady || busySelesai}
            className="btn btn-primary btn-md disabled:opacity-50"
            style={{ width: "auto" }}
          >
            {busySelesai ? (
              <><i className="fas fa-spinner fa-spin"></i> Menyelesaikan...</>
            ) : (
              <><i className="fas fa-flag-checkered"></i> Selesaikan Lomba</>
            )}
          </button>
          {!state.readiness.allReady && (
            <span className="text-[11px] text-[#6B7280]">
              Pilih Juara 1 & 2 untuk semua kategori dulu
            </span>
          )}
        </div>
      )}
    </>
  );
}

// Small badge showing "🥇 × 1" etc, for the section header
function JuaraBadge({ rank, count, disabled }: { rank: 1 | 2 | 3; count: number; disabled: boolean }) {
  const icon = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  const present = count >= 1;
  return (
    <span
      className={`juara-badge rank-${rank} ${present ? "filled" : "empty"} ${disabled ? "locked" : ""}`}
      title={present ? `${count} Juara ${rank} dipilih` : `Juara ${rank} belum dipilih`}
    >
      {icon} {count}
    </span>
  );
}
