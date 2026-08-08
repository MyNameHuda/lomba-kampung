"use client";

// Juara picker page (stage system v4) — per-kategori flow with tabs.
// Admin flow per kategori (independen):
//  1. Kualifikasi phase (tutupAt = null):
//     - Loloskan / Gugur / Clear button per pendaftar
//     - "Tutup Kualifikasi" button (enabled when all pendaftar decided)
//  2. Final phase (tutupAt != null):
//     - Juara 1/2/3 picker for finalists (isFinalist=1)
//     - "Buka Kualifikasi" button (only if no Juara picked yet)
//  3. Selesai (lomba-level, button at bottom of page)
//     - Enabled when all eligible kategori have Juara 1+2
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNotify } from "@/components/notify-provider";
import { getInitials } from "@/lib/format";
import { juaraLabel } from "@/lib/format";
import { KAT_ICON, DEFAULT_KAT_ICON } from "@/lib/constants";

// Slim pendaftar shape used in the Juara picker.
export type PendaftarWithJuara = {
  id: number;
  nomor: string;
  nama: string;
  umur: number;
  jenisKelamin: "L" | "P";
  // v4: isFinalist tri-state (null=pending, 1=lolos, 0=gugur)
  isFinalist: 0 | 1 | null;
  // Juara 1/2/3 — only set in final phase, only for finalists
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
  kualStatus: { lolos: number; gugur: number; pending: number; total: number; readyToTutup: boolean };
  tutupAt: number | null;
};

type JuaraReadiness = {
  allReady: boolean;
  missingKategori: string[];
  perKategori: Record<string, { ju1: number; ju2: number; ju3: number }>;
};

type Lomba = {
  id: number;
  nama: string;
  emoji: string;
  status: "draft" | "aktif" | "selesai";
};

type Props = {
  lomba: Lomba;
  sections: Section[];
  readiness: JuaraReadiness;
};

export default function JuaraClient({ lomba, sections, readiness }: Props) {
  const router = useRouter();
  const notify = useNotify();
  const [state, setState] = useState<Props>({ lomba, sections, readiness });
  const [busy, setBusy] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  // Active tab = currently-shown kategori
  const [activeTab, setActiveTab] = useState<string | null>(sections[0]?.kategoriId ?? null);

  // Sync local state with server after router.refresh()
  useEffect(() => {
    setState({ lomba, sections, readiness });
    if (!activeTab && sections[0]) setActiveTab(sections[0].kategoriId);
  }, [lomba, sections, readiness, activeTab]);

  const isLocked = state.lomba.status === "selesai";
  const isDraft = state.lomba.status === "draft";

  // ===========================================================
  // Set finalist (Loloskan = 1, Gugur = 0, Clear = null)
  // ===========================================================
  async function setFinalistStatus(pendaftarId: number, status: 0 | 1 | null) {
    setBusy(pendaftarId);
    // Optimistic update
    setState((prev) => {
      const newSections = prev.sections.map((sec) => {
        const newPendaftar = sec.pendaftar.map((p) => {
          if (p.id === pendaftarId) {
            return {
              ...p,
              isFinalist: status,
              // If un-loloskan from finalist, also clear Juara
              juaraRank: status !== 1 ? null : p.juaraRank,
            };
          }
          return p;
        });
        // Recompute kual status counts
        const lolos = newPendaftar.filter((p) => p.isFinalist === 1).length;
        const gugur = newPendaftar.filter((p) => p.isFinalist === 0).length;
        const pending = newPendaftar.filter((p) => p.isFinalist === null).length;
        return {
          ...sec,
          pendaftar: newPendaftar,
          kualStatus: { lolos, gugur, pending, total: newPendaftar.length, readyToTutup: pending === 0 },
        };
      });
      return { ...prev, sections: newSections };
    });

    try {
      const res = await fetch(`/api/admin/lomba/${lomba.id}/pendaftar/${pendaftarId}/finalist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal");
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Gagal set finalist");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  // ===========================================================
  // Set Juara 1/2/3 (only valid in final phase, only for finalists)
  // ===========================================================
  async function setRank(pendaftarId: number, rank: 1 | 2 | 3) {
    setBusy(pendaftarId);
    // Optimistic update
    setState((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) => ({
        ...sec,
        pendaftar: sec.pendaftar.map((p) => {
          if (p.id === pendaftarId) return { ...p, juaraRank: rank };
          // Un-pick any other pendaftar with same Juara rank in same section
          if (p.juaraRank === rank) return { ...p, juaraRank: null };
          return p;
        }),
      })),
    }));
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
  // Per-kategori Tutup / Buka
  // ===========================================================
  async function tutupKualifikasi(kategoriId: string) {
    const ok = await notify.confirm({
      title: "Tutup Kualifikasi",
      message: "Tutup kualifikasi untuk kategori ini? Setelah tutup, admin tidak bisa Loloskan/Gugur lagi (kecuali dibuka kembali).",
      confirmText: "Tutup",
      variant: "danger",
    });
    if (!ok) return;
    setBusyAction(`tutup-${kategoriId}`);
    try {
      const res = await fetch(`/api/admin/lomba/${lomba.id}/kategori/${kategoriId}/tutup-kualifikasi`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal Tutup");
      notify.success("Kualifikasi ditutup! Sekarang bisa pilih Juara 1/2/3.");
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Gagal Tutup");
    } finally {
      setBusyAction(null);
    }
  }

  async function bukaKualifikasi(kategoriId: string) {
    const ok = await notify.confirm({
      title: "Buka Kualifikasi",
      message: "Buka kembali kualifikasi untuk kategori ini? Admin bisa edit Loloskan/Gugur lagi. Juara yang sudah dipilih akan di-block (harus hapus dulu).",
      confirmText: "Buka",
      variant: "danger",
    });
    if (!ok) return;
    setBusyAction(`buka-${kategoriId}`);
    try {
      const res = await fetch(`/api/admin/lomba/${lomba.id}/kategori/${kategoriId}/buka-kualifikasi`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal Buka");
      notify.success("Kualifikasi dibuka kembali!");
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Gagal Buka");
    } finally {
      setBusyAction(null);
    }
  }

  // ===========================================================
  // Selesaikan Lomba (lomba-level, all eligible kategori ready)
  // ===========================================================
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
      if (!res.ok) throw new Error(data.error || "Gagal selesaikan lomba");
      notify.success("Lomba selesai! Juara 1/2/3 tampil di publik.");
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Gagal selesaikan lomba");
    } finally {
      setBusyAction(null);
    }
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

  // Use activeTab (with fallback to first kategori)
  const currentSection = state.sections.find((s) => s.kategoriId === activeTab) || state.sections[0];

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
                <i className="fas fa-circle" style={{ fontSize: 6 }}></i>{" "}
                {isLocked ? "Selesai" : isDraft ? "Draft" : "Tahap Kualifikasi + Final"}
              </span>
            </div>
            <div className="text-xs text-[#6B7280] mt-1">
              {state.sections.length} kategori · Klik Loloskan/Gugur per pendaftar · Tutup kualifikasi per kategori
            </div>
          </div>
        </div>
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

      {/* Tabs per kategori */}
      {state.sections.length > 1 && (
        <div className="kual-tabs mb-3">
          {state.sections.map((sec) => {
            const isActive = sec.kategoriId === currentSection.kategoriId;
            const isTutup = sec.tutupAt !== null;
            return (
              <button
                key={sec.kategoriId}
                onClick={() => setActiveTab(sec.kategoriId)}
                className={`kual-tab ${isActive ? "active" : ""}`}
                style={
                  isActive
                    ? { borderColor: sec.kategoriColorBorder || "#E11D1D", color: sec.kategoriColorText }
                    : undefined
                }
              >
                <span className="kual-tab-icon" style={{ background: sec.kategoriColorBg, color: sec.kategoriColorText }}>
                  {KAT_ICON[sec.kategoriIcon] || DEFAULT_KAT_ICON}
                </span>
                <span className="kual-tab-label">{sec.kategoriNama}</span>
                {isTutup ? (
                  <span className="kual-tab-badge tutup">Final</span>
                ) : sec.kualStatus.pending > 0 ? (
                  <span className="kual-tab-badge pending">{sec.kualStatus.pending}</span>
                ) : (
                  <span className="kual-tab-badge ready">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Active section */}
      {currentSection && <SectionPanel
        section={currentSection}
        isLocked={isLocked}
        isDraft={isDraft}
        busy={busy}
        busyAction={busyAction}
        onLoloskan={(pid) => setFinalistStatus(pid, 1)}
        onGugur={(pid) => setFinalistStatus(pid, 0)}
        onClearFinalist={(pid) => setFinalistStatus(pid, null)}
        onSetRank={setRank}
        onClearRank={clearRank}
        onTutup={() => tutupKualifikasi(currentSection.kategoriId)}
        onBuka={() => bukaKualifikasi(currentSection.kategoriId)}
      />}

      {/* Bottom action: Selesaikan Lomba */}
      {!isLocked && !isDraft && (
        <div className="mt-5 flex flex-col items-center gap-2">
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
              Tutup kualifikasi + pilih Juara 1 & 2 untuk semua kategori dulu
            </span>
          )}
        </div>
      )}
    </>
  );
}

// =================== Section Panel (one per kategori) ===================
function SectionPanel({
  section,
  isLocked,
  isDraft,
  busy,
  busyAction,
  onLoloskan,
  onGugur,
  onClearFinalist,
  onSetRank,
  onClearRank,
  onTutup,
  onBuka,
}: {
  section: Section;
  isLocked: boolean;
  isDraft: boolean;
  busy: number | null;
  busyAction: string | null;
  onLoloskan: (pid: number) => void;
  onGugur: (pid: number) => void;
  onClearFinalist: (pid: number) => void;
  onSetRank: (pid: number, rank: 1 | 2 | 3) => void;
  onClearRank: (pid: number) => void;
  onTutup: () => void;
  onBuka: () => void;
}) {
  const isTutup = section.tutupAt !== null;
  const hasJuara = section.pendaftar.some((p) => p.juaraRank !== null);

  // v2: split pendaftar into 3 groups (Pending / Lolos / Gugur) for
  // clearer admin UX — each group rendered as its own visually distinct
  // box (green for Lolos, red for Gugur, amber for Pending during
  // kualifikasi phase). The previous flat list with just a left-border
  // color was hard to scan.
  const pending = section.pendaftar.filter((p) => p.isFinalist === null);
  const lolos = section.pendaftar
    .filter((p) => p.isFinalist === 1)
    // Juara 1/2/3 first (admin cares about ordering), then non-Juara
    // Finalis by nama. Stable sort preserves DB order on tie.
    .slice()
    .sort((a, b) => {
      if (a.juaraRank !== null && b.juaraRank !== null) return a.juaraRank - b.juaraRank;
      if (a.juaraRank !== null) return -1;
      if (b.juaraRank !== null) return 1;
      return a.nama.localeCompare(b.nama);
    });
  const gugur = section.pendaftar
    .filter((p) => p.isFinalist === 0)
    .slice()
    .sort((a, b) => a.nama.localeCompare(b.nama));

  return (
    <section className="juara-section">
      <header className="juara-section-header" style={{ borderColor: section.kategoriColorBorder || "#E5E7EB" }}>
        <span className="juara-section-icon" style={{ background: section.kategoriColorBg, color: section.kategoriColorText }}>
          {KAT_ICON[section.kategoriIcon] || DEFAULT_KAT_ICON}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[14px] text-[#1F2937]">{section.kategoriNama}</div>
          <div className="text-[11px] text-[#6B7280]">
            {section.ageRange} · {isTutup ? "✓ Final" : "Kualifikasi"}
          </div>
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          <span className="juara-badge rank-1 filled" title="Lolos">👥 {lolos.length}</span>
          <span className="juara-badge rank-2 filled" title="Gugur" style={{ background: "#FEE2E2", color: "#991B1B" }}>✗ {gugur.length}</span>
          {pending.length > 0 && (
            <span className="juara-badge rank-3 filled" title="Pending" style={{ background: "#FEF3C7", color: "#92400E" }}>? {pending.length}</span>
          )}
        </div>
      </header>

      {/* Per-kategori Tutup / Buka buttons */}
      {!isLocked && !isDraft && !isTutup && (
        <div className="kual-actions" style={{ margin: "12px 12px 0" }}>
          <button
            onClick={onTutup}
            disabled={!section.kualStatus.readyToTutup || section.kualStatus.total === 0 || busyAction === `tutup-${section.kategoriId}`}
            className="btn btn-primary btn-sm disabled:opacity-50"
            style={{ width: "auto" }}
          >
            {busyAction === `tutup-${section.kategoriId}` ? (
              <><i className="fas fa-spinner fa-spin"></i> Menutup...</>
            ) : (
              <><i className="fas fa-lock"></i> Tutup Kualifikasi</>
            )}
          </button>
          {!section.kualStatus.readyToTutup && section.kualStatus.total > 0 && (
            <span className="text-[11px] text-[#6B7280]">
              Loloskan/Gugur semua pendaftar dulu ({pending.length} pending)
            </span>
          )}
        </div>
      )}
      {!isLocked && !isDraft && isTutup && !hasJuara && (
        <div className="kual-actions" style={{ margin: "12px 12px 0" }}>
          <button
            onClick={onBuka}
            disabled={busyAction === `buka-${section.kategoriId}`}
            className="btn btn-secondary btn-sm"
            style={{ width: "auto" }}
          >
            {busyAction === `buka-${section.kategoriId}` ? (
              <><i className="fas fa-spinner fa-spin"></i> Membuka...</>
            ) : (
              <><i className="fas fa-unlock"></i> Buka Kualifikasi</>
            )}
          </button>
        </div>
      )}

      {section.pendaftar.length === 0 ? (
        <div className="juara-empty">
          <i className="fas fa-user-slash text-2xl text-[#D1D5DB]"></i>
          <span>Belum ada peserta disetujui di kategori ini</span>
        </div>
      ) : (
        <div style={{ padding: "12px" }}>
          {/* Pending group — only during kualifikasi phase */}
          {!isTutup && pending.length > 0 && (
            <div className="juara-group pending">
              <div className="juara-group-header">
                <span className="juara-group-icon"><i className="fas fa-clock"></i></span>
                <span>Belum Diputuskan</span>
                <span className="juara-group-count">{pending.length}</span>
              </div>
              <div className="juara-group-body">
                {pending.map((p) => (
                  <PendaftarCard
                    key={p.id}
                    p={p}
                    kategoriId={section.kategoriId}
                    isTutup={isTutup}
                    isLocked={isLocked}
                    isDraft={isDraft}
                    busy={busy === p.id}
                    onLoloskan={() => onLoloskan(p.id)}
                    onGugur={() => onGugur(p.id)}
                    onClearFinalist={() => onClearFinalist(p.id)}
                    onSetRank={(rank) => onSetRank(p.id, rank)}
                    onClearRank={() => onClearRank(p.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Lolos / Final group — Juara + non-Juara Finalis */}
          {lolos.length > 0 && (
            <div className="juara-group lolos">
              <div className="juara-group-header">
                <span className="juara-group-icon"><i className="fas fa-trophy"></i></span>
                <span>{isTutup ? "Juara & Finalis" : "Lolos ke Final"}</span>
                <span className="juara-group-count">{lolos.length}</span>
              </div>
              <div className="juara-group-body">
                {lolos.map((p) => (
                  <PendaftarCard
                    key={p.id}
                    p={p}
                    kategoriId={section.kategoriId}
                    isTutup={isTutup}
                    isLocked={isLocked}
                    isDraft={isDraft}
                    busy={busy === p.id}
                    onLoloskan={() => onLoloskan(p.id)}
                    onGugur={() => onGugur(p.id)}
                    onClearFinalist={() => onClearFinalist(p.id)}
                    onSetRank={(rank) => onSetRank(p.id, rank)}
                    onClearRank={() => onClearRank(p.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Gugur group */}
          {gugur.length > 0 && (
            <div className="juara-group gugur">
              <div className="juara-group-header">
                <span className="juara-group-icon"><i className="fas fa-xmark"></i></span>
                <span>Gugur</span>
                <span className="juara-group-count">{gugur.length}</span>
              </div>
              <div className="juara-group-body">
                {gugur.map((p) => (
                  <PendaftarCard
                    key={p.id}
                    p={p}
                    kategoriId={section.kategoriId}
                    isTutup={isTutup}
                    isLocked={isLocked}
                    isDraft={isDraft}
                    busy={busy === p.id}
                    onLoloskan={() => onLoloskan(p.id)}
                    onGugur={() => onGugur(p.id)}
                    onClearFinalist={() => onClearFinalist(p.id)}
                    onSetRank={(rank) => onSetRank(p.id, rank)}
                    onClearRank={() => onClearRank(p.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All pending (no decision yet) — no boxes shown beyond pending */}
        </div>
      )}
    </section>
  );
}

// =================== Pendaftar Card ===================
function PendaftarCard({
  p,
  kategoriId,
  isTutup,
  isLocked,
  isDraft,
  busy,
  onLoloskan,
  onGugur,
  onClearFinalist,
  onSetRank,
  onClearRank,
}: {
  p: PendaftarWithJuara;
  kategoriId: string;
  isTutup: boolean;
  isLocked: boolean;
  isDraft: boolean;
  busy: boolean;
  onLoloskan: () => void;
  onGugur: () => void;
  onClearFinalist: () => void;
  onSetRank: (rank: 1 | 2 | 3) => void;
  onClearRank: () => void;
}) {
  const isLolos = p.isFinalist === 1;
  const isGugur = p.isFinalist === 0;
  const isJuara = p.juaraRank !== null;

  // Compute badge: pending / finalis / juara / gugur
  let statusBadge: React.ReactElement | null = null;
  if (isJuara) {
    // p.juaraRank is narrowed to 1|2|3 here (TS sees isJuara = juaraRank !== null)
    const rank = p.juaraRank as 1 | 2 | 3;
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
    statusBadge = (
      <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: ["#FFD700", "#C0C0C0", "#CD7F32"][rank - 1], color: "white" }}>
        {medal} {juaraLabel(kategoriId, rank, false /* forPublic — keep gender suffix on admin */)}
      </span>
    );
  } else if (isLolos) {
    statusBadge = (
      <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "#DBEAFE", color: "#1E40AF" }}>
        Finalis
      </span>
    );
  } else if (isGugur) {
    statusBadge = (
      <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "#FEE2E2", color: "#991B1B" }}>
        Gugur
      </span>
    );
  }

  // Border color (per-card border-left removed in v2; the parent
  // juara-group box does the visual work now. Keep this calculation
  // commented out as a no-op so a future regression is easy to detect.)
  // const borderColor = isJuara
  //   ? ["#FFD700", "#C0C0C0", "#CD7F32"][(p.juaraRank || 1) - 1]
  //   : isLolos
  //   ? "#3B82F6"
  //   : isGugur
  //   ? "#EF4444"
  //   : undefined;

  return (
    <article className={`juara-card ${isJuara ? `is-juara-${p.juaraRank}` : ""}`}>
      <div className="pc-avatar">{getInitials(p.nama)}</div>
      <div className="flex-1 min-w-0">
        <div className="juara-nama">{p.nama}</div>
        <div className="juara-meta">
          {p.jenisKelamin === "L" ? "♂ Laki-laki" : "♀ Perempuan"} · {p.umur} tahun
          {statusBadge}
        </div>
      </div>
      <div className="juara-actions">
        {/* kualifikasi phase: Loloskan / Gugur / Clear buttons */}
        {!isTutup && !isLocked && !isDraft && (
          <>
            {!isLolos && (
              <button
                onClick={onLoloskan}
                disabled={busy}
                className="btn btn-primary btn-sm disabled:opacity-50"
                style={{ width: "auto" }}
                title="Loloskan (advance to final)"
              >
                <i className="fas fa-check"></i> Loloskan
              </button>
            )}
            {!isGugur && (
              <button
                onClick={onGugur}
                disabled={busy}
                className="btn btn-sm disabled:opacity-50"
                style={{ width: "auto", background: "#FEE2E2", color: "#991B1B" }}
                title="Gugur (eliminate)"
              >
                <i className="fas fa-xmark"></i> Gugur
              </button>
            )}
            {(isLolos || isGugur) && (
              <button
                onClick={onClearFinalist}
                disabled={busy}
                className="juara-clear-btn"
                title="Reset ke pending"
                aria-label="Reset"
              >
                <i className="fas fa-rotate-left"></i>
              </button>
            )}
          </>
        )}

        {/* final phase: Juara 1/2/3 buttons for finalists only */}
        {isTutup && !isLocked && isLolos && (
          <>
            <button
              onClick={() => onSetRank(1)}
              disabled={busy}
              className={`juara-rank-btn rank-1 ${p.juaraRank === 1 ? "active" : ""}`}
              title="Juara 1"
              aria-label="Juara 1"
            >
              🥇
            </button>
            <button
              onClick={() => onSetRank(2)}
              disabled={busy}
              className={`juara-rank-btn rank-2 ${p.juaraRank === 2 ? "active" : ""}`}
              title="Juara 2"
              aria-label="Juara 2"
            >
              🥈
            </button>
            <button
              onClick={() => onSetRank(3)}
              disabled={busy}
              className={`juara-rank-btn rank-3 ${p.juaraRank === 3 ? "active" : ""}`}
              title="Juara 3"
              aria-label="Juara 3"
            >
              🥉
            </button>
            {isJuara && (
              <button
                onClick={onClearRank}
                disabled={busy}
                className="juara-clear-btn"
                title="Clear Juara"
                aria-label="Clear"
              >
                <i className="fas fa-xmark"></i>
              </button>
            )}
          </>
        )}

        {/* final phase: non-finalists shown but no actions */}
        {isTutup && !isLocked && isGugur && (
          <span className="text-[11px] text-[#991B1B] font-semibold">— Gugur</span>
        )}

        {/* locked: show Juara status only */}
        {isLocked && !isJuara && (
          <span className="text-[11px] text-[#6B7280]">
            {isGugur ? "Gugur" : isLolos ? "Finalis" : "—"}
          </span>
        )}
      </div>
    </article>
  );
}
