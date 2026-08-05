"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNotify } from "@/components/notify-provider";
import { getInitials } from "@/lib/format";
import { KAT_ICON, DEFAULT_KAT_ICON } from "@/lib/constants";

// Slim pendaftar shape used in the Juara picker.
// - In kualifikasi phase, juaraRank = kualifikasi slot (1..finalisCount) or null
// - In final phase, juaraRank = Juara rank (1, 2, 3) — but only for finalists
// - For non-finalists in final phase, juaraRank is still set (1..finalisCount)
//   but UI treats them as finalists, not Juara
export type PendaftarWithJuara = {
  id: number;
  nomor: string;
  nama: string;
  umur: number;
  jenisKelamin: "L" | "P";
  juaraRank: number | null;
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

type JuaraReadiness = {
  allReady: boolean;
  missingKategori: string[];
  perKategori: Record<string, { ju1: number; ju2: number; ju3: number }>;
};

type KualifikasiReadiness = {
  ok: boolean;
  missingKategori: string[];
  perKategori: Record<string, { finalists: number; pendaftar: number }>;
};

type Lomba = {
  id: number;
  nama: string;
  emoji: string;
  status: "draft" | "aktif" | "selesai";
  finalisCount: number;
  phase: "kualifikasi" | "final" | null;
};

type Props = {
  lomba: Lomba;
  sections: Section[];
  readiness: JuaraReadiness;
  kualifikasiReadiness: KualifikasiReadiness;
};

export default function JuaraClient({ lomba, sections, readiness, kualifikasiReadiness }: Props) {
  const router = useRouter();
  const notify = useNotify();
  const [state, setState] = useState<Props>({ lomba, sections, readiness, kualifikasiReadiness });
  const [busy, setBusy] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Sync local state with server after router.refresh()
  useEffect(() => {
    setState({ lomba, sections, readiness, kualifikasiReadiness });
  }, [lomba, sections, readiness, kualifikasiReadiness]);

  const isLocked = state.lomba.status === "selesai";
  const isDraft = state.lomba.status === "draft";
  const isKualifikasi = state.lomba.phase === "kualifikasi";
  const isFinal = state.lomba.phase === "final";
  const isLegacy = state.lomba.phase === null && !isLocked && !isDraft; // old v2 mode

  // ===========================================================
  // Set Juara (works in kualifikasi for finalis slot, or final for Juara rank)
  // ===========================================================
  async function setRank(pendaftarId: number, rank: number) {
    setBusy(pendaftarId);
    // Optimistic update
    setState((prev) => {
      const newSections = prev.sections.map((sec) => {
        const newPendaftar = sec.pendaftar.map((p) => {
          if (p.id === pendaftarId) return { ...p, juaraRank: rank };
          // Un-pick any other pendaftar with same rank in same section
          if (p.juaraRank === rank) return { ...p, juaraRank: null };
          return p;
        });
        return { ...sec, pendaftar: newPendaftar };
      });
      // Recompute readiness (Juara readiness)
      const perKategori: Record<string, { ju1: number; ju2: number; ju3: number }> = {};
      const missingKategori: string[] = [];
      for (const sec of newSections) {
        const counts = { ju1: 0, ju2: 0, ju3: 0 };
        for (const p of sec.pendaftar) {
          if (p.juaraRank === 1) counts.ju1++;
          if (p.juaraRank === 2) counts.ju2++;
          if (p.juaraRank === 3) counts.ju3++;
        }
        perKategori[sec.kategoriId] = counts;
        if (counts.ju1 < 1 || counts.ju2 < 1) missingKategori.push(sec.kategoriId);
      }
      // Recompute kualifikasi readiness
      const kualPerKategori: Record<string, { finalists: number; pendaftar: number }> = {};
      const kualMissing: string[] = [];
      for (const sec of newSections) {
        const finalists = sec.pendaftar.filter(
          (p) => p.juaraRank !== null && p.juaraRank <= prev.lomba.finalisCount
        ).length;
        kualPerKategori[sec.kategoriId] = { finalists, pendaftar: sec.pendaftar.length };
        if (sec.pendaftar.length > 0 && finalists < 1) kualMissing.push(sec.kategoriId);
      }
      return {
        ...prev,
        sections: newSections,
        readiness: { allReady: missingKategori.length === 0, missingKategori, perKategori },
        kualifikasiReadiness: {
          ok: kualMissing.length === 0,
          missingKategori: kualMissing,
          perKategori: kualPerKategori,
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
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  // Clear juara_rank (un-loloskan or un-pick Juara)
  async function clearRank(pendaftarId: number) {
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

  // ===========================================================
  // Phase transitions
  // ===========================================================
  async function mulaiKualifikasi() {
    setBusyAction("mulai");
    try {
      const res = await fetch(`/api/admin/lomba/${lomba.id}/mulai-kualifikasi`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        notify.error(data.error || "Gagal mulai kualifikasi");
        return;
      }
      notify.success("Kualifikasi dimulai. Pilih finalis per kategori.");
      router.refresh();
    } catch {
      notify.error("Gagal mulai kualifikasi");
    } finally {
      setBusyAction(null);
    }
  }

  async function tutupKualifikasi() {
    const ok = await notify.confirm({
      title: "Tutup Kualifikasi",
      message: "Tutup kualifikasi dan lanjut ke final? Pastikan setiap kategori sudah punya finalis.",
      confirmText: "Tutup & Lanjut ke Final",
      variant: "danger",
    });
    if (!ok) return;
    setBusyAction("tutup");
    try {
      const res = await fetch(`/api/admin/lomba/${lomba.id}/tutup-kualifikasi`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        notify.error(data.error || "Gagal tutup kualifikasi");
        return;
      }
      notify.success("Kualifikasi ditutup! Lanjut pilih Juara 1/2/3 dari finalis.");
      router.refresh();
    } catch {
      notify.error("Gagal tutup kualifikasi");
    } finally {
      setBusyAction(null);
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
    setBusyAction("selesai");
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
      setBusyAction(null);
    }
  }

  // Find next available finalist slot in a (lomba, kategori). Used in kualifikasi phase.
  function nextAvailableSlot(pendaftarId: number): number | null {
    const p = state.sections.flatMap((s) => s.pendaftar).find((x) => x.id === pendaftarId);
    if (!p) return null;
    const usedSlots = new Set<number>();
    for (const sec of state.sections) {
      for (const x of sec.pendaftar) {
        if (x.id !== pendaftarId && x.juaraRank !== null && x.juaraRank <= state.lomba.finalisCount) {
          usedSlots.add(x.juaraRank);
        }
      }
    }
    for (let i = 1; i <= state.lomba.finalisCount; i++) {
      if (!usedSlots.has(i)) return i;
    }
    return null; // all slots used
  }

  // ===========================================================
  // Render
  // ===========================================================
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

  // Determine what state UI to show
  const phaseLabel = isLocked
    ? "Selesai"
    : isDraft
    ? "Draft"
    : isKualifikasi
    ? "Tahap Kualifikasi"
    : isFinal
    ? "Tahap Final"
    : "Tahap Pendaftaran";

  return (
    <>
      {/* Header */}
      <div className="card p-4 mb-4">
        <div className="flex items-start gap-3 mb-2">
          <div className="text-3xl">{state.lomba.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-[#1F2937] leading-tight">{state.lomba.nama}</h1>
              <span className="phase-badge">
                <i className="fas fa-circle" style={{ fontSize: 6 }}></i> {phaseLabel}
              </span>
            </div>
            <div className="text-xs text-[#6B7280] mt-1">
              {state.sections.length} kategori · Finalis per kategori: {state.lomba.finalisCount}
            </div>
          </div>
        </div>

        {/* Phase-specific info banner */}
        {isKualifikasi && (
          <div className={`text-[12px] mt-2 px-3 py-2 rounded-md leading-snug ${
            state.kualifikasiReadiness.ok
              ? "bg-[#DCFCE7] text-[#15803D]"
              : "bg-[#FEF3C7] text-[#92400E]"
          }`}>
            {state.kualifikasiReadiness.ok ? (
              <><i className="fas fa-check-circle"></i> Semua kategori punya finalis. Tutup kualifikasi untuk lanjut ke final.</>
            ) : (
              <><i className="fas fa-info-circle"></i> Pilih minimal 1 finalis per kategori. Sisa pendaftar otomatis gugur.</>
            )}
          </div>
        )}
        {isFinal && !state.readiness.allReady && !isLocked && (
          <div className={`text-[12px] mt-2 px-3 py-2 rounded-md leading-snug ${
            state.readiness.allReady
              ? "bg-[#DCFCE7] text-[#15803D]"
              : "bg-[#FEF3C7] text-[#92400E]"
          }`}>
            {state.readiness.allReady ? (
              <><i className="fas fa-check-circle"></i> Semua Juara 1&2 dipilih. Siap selesaikan!</>
            ) : (
              <><i className="fas fa-info-circle"></i> Pilih Juara 1 & 2 untuk semua finalis. Selesaikan setelah siap.</>
            )}
          </div>
        )}
        {isLocked && (
          <div className="text-[12px] mt-2 px-3 py-2 rounded-md bg-[#DBEAFE] text-[#1E40AF]">
            <i className="fas fa-lock"></i> Lomba sudah selesai. Juara di bawah ini sudah final dan tampil di halaman publik.
          </div>
        )}
        {isDraft && (
          <div className="text-[12px] mt-2 px-3 py-2 rounded-md bg-[#FEE2E2] text-[#991B1B]">
            <i className="fas fa-ban"></i> Lomba masih draft. Aktifkan dulu sebelum pilih Juara.
          </div>
        )}
        {isLegacy && (
          <div className="text-[12px] mt-2 px-3 py-2 rounded-md bg-[#DBEAFE] text-[#1E40AF]">
            <i className="fas fa-info-circle"></i> Mode legacy (v2). Mulai kualifikasi untuk pakai flow kualifikasi + final.
          </div>
        )}
      </div>

      {/* Sections per kategori */}
      {state.sections.map((sec) => {
        const kualCount = sec.pendaftar.filter(
          (p) => p.juaraRank !== null && p.juaraRank <= state.lomba.finalisCount
        ).length;
        const juCounts = state.readiness.perKategori[sec.kategoriId] || { ju1: 0, ju2: 0, ju3: 0 };
        const sectionReady = juCounts.ju1 >= 1 && juCounts.ju2 >= 1;
        const sectionFull = kualCount >= state.lomba.finalisCount;

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

              {/* Phase-specific header badges */}
              {isKualifikasi ? (
                <>
                  <div className="flex gap-1">
                    <span className="juara-badge rank-1 filled">👥 {kualCount}/{state.lomba.finalisCount}</span>
                  </div>
                  {sectionFull ? (
                    <span className="juara-status-pill ready">✓ Penuh</span>
                  ) : kualCount > 0 ? (
                    <span className="juara-status-pill pending">{kualCount}/{state.lomba.finalisCount}</span>
                  ) : (
                    <span className="juara-status-pill pending">⚠ Kosong</span>
                  )}
                </>
              ) : isFinal ? (
                <>
                  <div className="flex gap-1">
                    <JuaraBadge rank={1} count={juCounts.ju1} />
                    <JuaraBadge rank={2} count={juCounts.ju2} />
                    <JuaraBadge rank={3} count={juCounts.ju3} />
                  </div>
                  {sectionReady ? (
                    <span className="juara-status-pill ready">✓ Ready</span>
                  ) : (
                    <span className="juara-status-pill pending">⚠ Belum</span>
                  )}
                </>
              ) : null}
            </header>

            {sec.pendaftar.length === 0 ? (
              <div className="juara-empty">
                <i className="fas fa-user-slash text-2xl text-[#D1D5DB]"></i>
                <span>Belum ada peserta disetujui di kategori ini</span>
              </div>
            ) : (
              <div className="space-y-2">
                {sec.pendaftar.map((p) => {
                  // Determine what action to show
                  const isFinalist = p.juaraRank !== null && p.juaraRank <= state.lomba.finalisCount;
                  const isJuara = p.juaraRank === 1 || p.juaraRank === 2 || p.juaraRank === 3;

                  // kualifikasi phase: show Loloskan / Un-loloskan
                  if (isKualifikasi) {
                    return (
                      <article
                        key={p.id}
                        className={`juara-card ${isFinalist ? "is-juara-1" : ""}`}
                        style={isFinalist ? { borderLeftColor: ["#FFD700", "#C0C0C0", "#CD7F32"][(p.juaraRank || 1) - 1] } : undefined}
                      >
                        <div className="pc-avatar">{getInitials(p.nama)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="juara-nama">{p.nama}</div>
                          <div className="juara-meta">
                            {p.jenisKelamin === "L" ? "♂" : "♀"} {p.jenisKelamin === "L" ? "Laki-laki" : "Perempuan"} · {p.umur} tahun
                            {p.juaraRank !== null && p.juaraRank <= state.lomba.finalisCount && (
                              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "#FFD700", color: "white" }}>
                                Finalis #{p.juaraRank}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="juara-actions">
                          {!isFinalist ? (
                            (() => {
                              const nextSlot = nextAvailableSlot(p.id);
                              return (
                                <button
                                  onClick={() => nextSlot && setRank(p.id, nextSlot)}
                                  disabled={busy === p.id || nextSlot === null}
                                  className="btn btn-primary btn-sm disabled:opacity-50"
                                  style={{ width: "auto" }}
                                  title={nextSlot === null ? "Slot finalis penuh" : `Loloskan sebagai finalis #${nextSlot}`}
                                >
                                  <i className="fas fa-check"></i> Loloskan
                                </button>
                              );
                            })()
                          ) : (
                            <>
                              <span className="juara-medal-icon">{p.juaraRank === 1 ? "🥇" : p.juaraRank === 2 ? "🥈" : "🥉"}</span>
                              <button
                                onClick={() => clearRank(p.id)}
                                disabled={busy === p.id}
                                className="juara-clear-btn"
                                title="Batal loloskan"
                                aria-label="Batal"
                              >
                                <i className="fas fa-xmark"></i>
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    );
                  }

                  // final phase: only finalists are pickable
                  if (isFinal) {
                    if (!isFinalist) {
                      // Non-finalist: shown but no actions (they're out)
                      return (
                        <article key={p.id} className="juara-card" style={{ opacity: 0.5 }}>
                          <div className="pc-avatar">{getInitials(p.nama)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="juara-nama">{p.nama}</div>
                            <div className="juara-meta">
                              {p.jenisKelamin === "L" ? "♂ Laki-laki" : "♀ Perempuan"} · {p.umur} tahun
                              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B]">
                                Gugur
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    }
                    // Finalist: pick Juara 1/2/3
                    return (
                      <article
                        key={p.id}
                        className={`juara-card ${isJuara ? `is-juara-${p.juaraRank}` : ""}`}
                        style={isJuara ? { borderLeftColor: ["#FFD700", "#C0C0C0", "#CD7F32"][(p.juaraRank || 1) - 1] } : undefined}
                      >
                        <div className="pc-avatar">{getInitials(p.nama)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="juara-nama">{p.nama}</div>
                          <div className="juara-meta">
                            {p.jenisKelamin === "L" ? "♂" : "♀"} {p.jenisKelamin === "L" ? "Laki-laki" : "Perempuan"} · {p.umur} tahun
                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "#DBEAFE", color: "#1E40AF" }}>
                              Finalis
                            </span>
                          </div>
                        </div>
                        <div className="juara-actions">
                          <button
                            onClick={() => setRank(p.id, 1)}
                            disabled={busy === p.id}
                            className={`juara-rank-btn rank-1 ${p.juaraRank === 1 ? "active" : ""}`}
                            title="Juara 1"
                            aria-label="Juara 1"
                          >
                            🥇
                          </button>
                          <button
                            onClick={() => setRank(p.id, 2)}
                            disabled={busy === p.id}
                            className={`juara-rank-btn rank-2 ${p.juaraRank === 2 ? "active" : ""}`}
                            title="Juara 2"
                            aria-label="Juara 2"
                          >
                            🥈
                          </button>
                          <button
                            onClick={() => setRank(p.id, 3)}
                            disabled={busy === p.id}
                            className={`juara-rank-btn rank-3 ${p.juaraRank === 3 ? "active" : ""}`}
                            title="Juara 3"
                            aria-label="Juara 3"
                          >
                            🥉
                          </button>
                          {isJuara && (
                            <button
                              onClick={() => clearRank(p.id)}
                              disabled={busy === p.id}
                              className="juara-clear-btn"
                              title="Clear"
                              aria-label="Clear"
                            >
                              <i className="fas fa-xmark"></i>
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  }

                  // legacy / fase NULL or draft: same as final but allow all
                  if (isDraft) {
                    return (
                      <article key={p.id} className="juara-card" style={{ opacity: 0.5 }}>
                        <div className="pc-avatar">{getInitials(p.nama)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="juara-nama">{p.nama}</div>
                          <div className="juara-meta">Lomba masih draft</div>
                        </div>
                      </article>
                    );
                  }

                  // legacy: pick Juara 1/2/3 from any pendaftar (old v2)
                  return (
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
                      <div className="juara-actions">
                        <button
                          onClick={() => setRank(p.id, 1)}
                          disabled={busy === p.id}
                          className={`juara-rank-btn rank-1 ${p.juaraRank === 1 ? "active" : ""}`}
                          title="Juara 1"
                          aria-label="Juara 1"
                        >
                          🥇
                        </button>
                        <button
                          onClick={() => setRank(p.id, 2)}
                          disabled={busy === p.id}
                          className={`juara-rank-btn rank-2 ${p.juaraRank === 2 ? "active" : ""}`}
                          title="Juara 2"
                          aria-label="Juara 2"
                        >
                          🥈
                        </button>
                        <button
                          onClick={() => setRank(p.id, 3)}
                          disabled={busy === p.id}
                          className={`juara-rank-btn rank-3 ${p.juaraRank === 3 ? "active" : ""}`}
                          title="Juara 3"
                          aria-label="Juara 3"
                        >
                          🥉
                        </button>
                        {p.juaraRank !== null && (
                          <button
                            onClick={() => clearRank(p.id)}
                            disabled={busy === p.id}
                            className="juara-clear-btn"
                            title="Clear"
                            aria-label="Clear"
                          >
                            <i className="fas fa-xmark"></i>
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {/* Bottom action buttons */}
      {!isLocked && !isDraft && (
        <div className="mt-5 flex flex-col items-center gap-2">
          {isLegacy && (
            <button
              onClick={mulaiKualifikasi}
              disabled={busyAction !== null}
              className="btn btn-primary btn-md disabled:opacity-50"
              style={{ width: "auto" }}
            >
              {busyAction === "mulai" ? (
                <><i className="fas fa-spinner fa-spin"></i> Memulai...</>
              ) : (
                <><i className="fas fa-play"></i> Mulai Kualifikasi</>
              )}
            </button>
          )}

          {isKualifikasi && (
            <>
              <button
                onClick={tutupKualifikasi}
                disabled={!state.kualifikasiReadiness.ok || busyAction !== null}
                className="btn btn-primary btn-md disabled:opacity-50"
                style={{ width: "auto" }}
              >
                {busyAction === "tutup" ? (
                  <><i className="fas fa-spinner fa-spin"></i> Menutup...</>
                ) : (
                  <><i className="fas fa-arrow-right"></i> Tutup Kualifikasi & Lanjut ke Final</>
                )}
              </button>
              {!state.kualifikasiReadiness.ok && (
                <span className="text-[11px] text-[#6B7280]">
                  Pilih minimal 1 finalis per kategori dulu
                </span>
              )}
            </>
          )}

          {isFinal && (
            <>
              <button
                onClick={selesaikanLomba}
                disabled={!state.readiness.allReady || busyAction !== null}
                className="btn btn-primary btn-md disabled:opacity-50"
                style={{ width: "auto" }}
              >
                {busyAction === "selesai" ? (
                  <><i className="fas fa-spinner fa-spin"></i> Menyelesaikan...</>
                ) : (
                  <><i className="fas fa-flag-checkered"></i> Selesaikan Lomba</>
                )}
              </button>
              {!state.readiness.allReady && (
                <span className="text-[11px] text-[#6B7280]">
                  Pilih Juara 1 & 2 untuk semua finalis dulu
                </span>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

// Small badge showing "🥇 × 1" etc, for the section header (final phase)
function JuaraBadge({ rank, count }: { rank: 1 | 2 | 3; count: number }) {
  const icon = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  const present = count >= 1;
  return (
    <span
      className={`juara-badge rank-${rank} ${present ? "filled" : "empty"}`}
      title={present ? `${count} Juara ${rank} dipilih` : `Juara ${rank} belum dipilih`}
    >
      {icon} {count}
    </span>
  );
}
