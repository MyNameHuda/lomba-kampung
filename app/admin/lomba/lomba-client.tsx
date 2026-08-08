"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useNotify } from "@/components/notify-provider";
import KatTag from "@/components/kat-tag";
import LombaModal, { type LombaFormData, type JadwalInput } from "./lomba-modal";
import { formatTanggalLomba, displayKategoriName } from "@/lib/format";
import type { Pj, PjInput, KategoriSlim as Kat } from "@/lib/types";

// Lomba row shape (server-rendered + PJ populated).
// The pjByKategori map is hydrated by the server; the form uses pjList
// for create/update instead, converted to pjByKategori in the modal.
type Lomba = LombaFormData & {
  id: number;
  pjByKategori: Record<string, Pj[]>;
  jadwalByKategori: Record<string, JadwalInput>;
};

type StatusFilter = "all" | "aktif" | "selesai" | "draft";
type SortBy = "urutan" | "nama" | "peserta";

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "Semua",
  aktif: "Aktif",
  selesai: "Selesai",
  draft: "Draft",
};

const STATUS_BADGE: Record<Lomba["status"], string> = {
  aktif: "status-approved",
  selesai: "status-hadir",
  draft: "status-pending",
};

export default function LombaClient({
  initial,
  kats,
  counts,
  juaraSummary,
}: {
  initial: Lomba[];
  kats: Kat[];
  counts: Record<number, number>;
  juaraSummary: Record<number, { totalJuara: number; allReady: boolean }>;
}) {
  const router = useRouter();
  const notify = useNotify();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Lomba | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Toolbar state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("urutan");

  // Sync local items with server-provided initial prop after router.refresh()
  useEffect(() => {
    setItems(initial);
  }, [initial]);

  // Status counts (for chip badges)
  const statusCounts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: items.length, aktif: 0, selesai: 0, draft: 0 };
    for (const l of items) c[l.status]++;
    return c;
  }, [items]);

  // Filter + sort
  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = items.filter((l) => {
      if (q && !l.nama.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      return true;
    });
    result = [...result].sort((a, b) => {
      if (sortBy === "nama") return a.nama.localeCompare(b.nama);
      if (sortBy === "peserta") return (counts[b.id] || 0) - (counts[a.id] || 0);
      return a.urutan - b.urutan;
    });
    return result;
  }, [items, search, statusFilter, sortBy, counts]);

  async function saveLomba(data: LombaFormData & { pjList: PjInput[]; jadwalList: JadwalInput[] }) {
    setError("");
    try {
      const url = data.id ? `/api/admin/lomba/${data.id}` : "/api/admin/lomba";
      const method = data.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal");
      setCreating(false);
      setEditing(null);
      // Optimistic update — build pjByKategori map from flat pjList
      const pjMap: Record<string, Pj[]> = {};
      for (const p of data.pjList) {
        if (!pjMap[p.kategoriId]) pjMap[p.kategoriId] = [];
        pjMap[p.kategoriId].push({ nama: p.pjNama, kontak: p.pjKontak });
      }
      if (data.id) {
        const jadwalMap: Record<string, JadwalInput> = {};
        for (const j of data.jadwalList) jadwalMap[j.kategoriId] = j;
        setItems((prev) => prev.map((l) => (l.id === data.id ? { ...l, ...data, id: data.id, pjByKategori: pjMap, jadwalByKategori: jadwalMap } as Lomba : l)));
      } else {
        const tempId = -Math.floor(Math.random() * 1e6);
        const newLocal: Lomba = {
          id: tempId,
          nama: data.nama,
          emoji: data.emoji,
          deskripsi: data.deskripsi,
          syarat: data.syarat,
          kategoriEligible: data.kategoriEligible,
          status: data.status,
          urutan: data.urutan,
          finalisCount: data.finalisCount,
          pendaftaranDibuka: data.pendaftaranDibuka,
          faseEnabled: data.faseEnabled,
          pjByKategori: pjMap,
          jadwalByKategori: {},
        };
        setItems((prev) => [...prev, newLocal]);
      }
      router.refresh();
      notify.success(data.id ? "Lomba berhasil diperbarui" : "Lomba berhasil ditambahkan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
      notify.error(e instanceof Error ? e.message : "Gagal menyimpan lomba");
    }
  }

  async function deleteLomba(id: number, nama: string) {
    const ok = await notify.confirm({
      title: "Hapus Lomba",
      message: `Hapus lomba "${nama}"?\n\nSemua peserta yang terkait akan ikut terhapus.`,
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/lomba/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.filter((l) => l.id !== id));
      router.refresh();
      notify.success(`Lomba "${nama}" berhasil dihapus`);
    } catch {
      notify.error("Gagal hapus lomba");
    } finally {
      setBusy(null);
    }
  }

  async function toggleStatus(l: Lomba) {
    const next = l.status === "aktif" ? "selesai" : "aktif";
    setBusy(l.id);
    try {
      const res = await fetch(`/api/admin/lomba/${l.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.map((x) => (x.id === l.id ? { ...x, status: next } : x)));
      router.refresh();
      notify.success(`Status lomba diubah ke ${next}`);
    } catch {
      notify.error("Gagal update status");
    } finally {
      setBusy(null);
    }
  }

  const isFiltered = search.trim() !== "" || statusFilter !== "all";

  return (
    <>
      {/* ====== Toolbar: search + add button ====== */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="flex-1 relative">
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
        <button
          onClick={() => { setEditing(null); setCreating(true); }}
          className="btn btn-primary whitespace-nowrap"
          style={{ width: "auto" }}
        >
          <i className="fas fa-plus"></i> Tambah Lomba
        </button>
      </div>

      {/* ====== Filter chips + sort dropdown ====== */}
      <div className="flex items-center gap-2 mb-3 -mx-4 px-4 overflow-x-auto pb-1">
        {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((s) => {
          const isActive = statusFilter === s;
          const count = statusCounts[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold border-2 transition-colors ${
                isActive
                  ? "bg-primary border-primary text-white"
                  : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-primary hover:text-primary"
              }`}
            >
              {STATUS_LABEL[s]}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/25" : "bg-[#F3F4F6]"}`}>
                {count}
              </span>
            </button>
          );
        })}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="ml-auto shrink-0 px-3 py-1.5 border-2 border-[#E5E7EB] rounded-full text-[12px] font-semibold bg-white text-[#374151] focus:outline-none focus:border-primary"
          aria-label="Urutkan"
        >
          <option value="urutan">Urut: Posisi</option>
          <option value="nama">Urut: Nama (A-Z)</option>
          <option value="peserta">Urut: Peserta Terbanyak</option>
        </select>
      </div>

      {/* ====== Result count + clear button ====== */}
      {isFiltered && (
        <div className="flex items-center justify-between text-[12px] text-[#6B7280] mb-3">
          <span>
            Menampilkan <strong className="text-[#1F2937]">{visibleItems.length}</strong> dari {items.length} lomba
          </span>
          <button
            type="button"
            onClick={() => { setSearch(""); setStatusFilter("all"); }}
            className="text-primary font-semibold hover:underline"
          >
            <i className="fas fa-xmark text-[10px]"></i> Reset filter
          </button>
        </div>
      )}

      {error && (
        <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-sm rounded p-3.5 mb-4 leading-relaxed">
          <i className="fas fa-exclamation-triangle"></i> {error}
        </div>
      )}

      {/* ====== Card grid ====== */}
      {visibleItems.length === 0 ? (
        <div className="card p-10 text-center text-[#6B7280]">
          <i className={`fas ${items.length === 0 ? "fa-trophy" : "fa-search"} text-5xl text-[#D1D5DB] mb-3 block`}></i>
          <strong className="block text-[#1F2937] text-base mb-1">
            {items.length === 0 ? "Belum ada lomba" : "Tidak ada lomba yang cocok"}
          </strong>
          <p className="text-[13px]">
            {items.length === 0
              ? 'Klik "Tambah Lomba" untuk mulai.'
              : "Coba kata kunci lain atau ubah filter status."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {visibleItems.map((l) => {
            const eligibleKats = (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [])
              .map((kid) => kats.find((k) => k.id === kid))
              .filter((k): k is NonNullable<typeof k> => !!k);
            // Group by public name so k_anak_l + k_anak_p collapse to a
            // single "Anak" badge on the admin card (matches home page
            // and detail-page PJ pattern). First-seen kategori supplies
            // the badge colors; admin still sees one combined block.
            type KatGroup = { publicName: string; sampleKat: NonNullable<typeof kats[number]>; kategoriIds: string[] };
            const groupMap = new Map<string, KatGroup>();
            const groups: KatGroup[] = [];
            for (const k of eligibleKats) {
              // displayKategoriName collapses k_anak_l + k_anak_p → "Anak";
              // for any other kat (including user-added k_<timestamp> ids)
              // it returns the real DB nama so badges don't show the raw id.
              const publicName = displayKategoriName(k.id, k);
              let g = groupMap.get(publicName);
              if (!g) {
                g = { publicName, sampleKat: k, kategoriIds: [k.id] };
                groupMap.set(publicName, g);
                groups.push(g);
              } else {
                g.kategoriIds.push(k.id);
              }
            }
            const js = juaraSummary[l.id];
            const totalPeserta = counts[l.id] || 0;
            const totalJuara = js?.totalJuara || 0;
            return (
              <article
                key={l.id}
                className="bg-white border border-[#E5E7EB] rounded-xl p-4 hover:border-primary hover:shadow-md transition-all flex flex-col gap-3"
              >
                {/* Header: emoji + name + status */}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">
                    {l.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[15px] text-[#1F2937] leading-tight mb-1.5 break-words">
                      {l.nama}
                    </h3>
                    <button
                      onClick={() => toggleStatus(l)}
                      disabled={busy === l.id}
                      className={`status-badge ${STATUS_BADGE[l.status]}`}
                      title="Klik untuk toggle aktif/selesai"
                    >
                      <i className="fas fa-circle" style={{ fontSize: 6 }}></i> {l.status}
                    </button>
                    {/* v8: 3-fase flow badge (Kualifikasi → Semi Final → Final) */}
                    {l.faseEnabled && (
                      <span
                        className="ml-1 mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide bg-gradient-to-r from-[#DBEAFE] via-[#FEF3C7] to-[#F3E8FF] text-[#581C87] border border-[#9333EA]/30"
                        title="Lomba ini punya 3 fase: Kualifikasi → Semi Final → Final"
                      >
                        <i className="fas fa-sitemap"></i> 3 Fase
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {l.deskripsi && (
                  <p className="text-[12px] text-[#6B7280] leading-relaxed line-clamp-2">
                    {l.deskripsi}
                  </p>
                )}

                {/* Tags: kategori + tanggal. Anak (Laki-laki) + Anak
                    (Perempuan) collapse into a single "Anak" badge; jadwal
                    combined into one line (same date → "15 Agu 2026",
                    different dates → "15 & 16 Agu 2026"). */}
                {groups.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {groups.map((g) => {
                      const jadwals = g.kategoriIds
                        .map((kid) => l.jadwalByKategori?.[kid])
                        .filter((j): j is JadwalInput & { tanggal: number } => !!j && j.tanggal != null);
                      if (jadwals.length === 0) {
                        return (
                          <div key={g.publicName} className="flex items-center gap-2 flex-wrap">
                            <KatTag
                              nama={g.publicName}
                              colorBg={g.sampleKat.colorBg}
                              colorText={g.sampleKat.colorText}
                              colorBorder={g.sampleKat.colorBorder}
                            />
                            <span className="text-[10px] text-[#9CA3AF] italic">Belum dijadwalkan</span>
                          </div>
                        );
                      }
                      const allSameDate = jadwals.every((j) => j.tanggal === jadwals[0].tanggal);
                      const uniqueJams = Array.from(new Set(jadwals.map((j) => j.jam).filter((j): j is string => !!j)));
                      const showJam = uniqueJams.length > 0;
                      return (
                        <div key={g.publicName} className="flex items-center gap-2 flex-wrap">
                          <KatTag
                            nama={g.publicName}
                            colorBg={g.sampleKat.colorBg}
                            colorText={g.sampleKat.colorText}
                            colorBorder={g.sampleKat.colorBorder}
                          />
                          <span className="text-[10px] text-[#6B7280] flex items-center gap-1">
                            <i className="far fa-calendar text-primary"></i>
                            {allSameDate ? (
                              <>
                                <span className="font-semibold text-[#374151]">
                                  {formatTanggalLomba(jadwals[0].tanggal, "short")}
                                </span>
                                {showJam && (
                                  <span className="text-[#9CA3AF]">
                                    · {uniqueJams.length === 1 ? uniqueJams[0] : uniqueJams.join(", ")}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="font-semibold text-[#374151]">
                                {jadwals
                                  .map((j) => formatTanggalLomba(j.tanggal, "short"))
                                  .filter((v, i, arr) => arr.indexOf(v) === i)
                                  .join(" & ")}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Stats row */}
                <div className="flex items-center gap-4 py-2.5 border-t border-b border-[#F3F4F6] text-[12px] text-[#374151]">
                  <div className="flex items-center gap-1.5">
                    <i className="fas fa-users text-[#6B7280]"></i>
                    <span><strong className="text-[#1F2937]">{totalPeserta}</strong> pendaftar</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <i className="fas fa-trophy text-[#6B7280]"></i>
                    {totalJuara === 0 ? (
                      <span className="text-[#9CA3AF]">Belum ada juara</span>
                    ) : (
                      <span><strong className="text-[#1F2937]">{totalJuara}</strong> juara</span>
                    )}
                  </div>
                </div>

                {/* Action row — each button has distinct semantic color so
                    they're easy to see at a glance. View + Peserta = blue
                    (info), Juara = green (success), Edit = primary red,
                    Hapus = strong red (danger, pushed right). */}
                <div className="flex items-center gap-1.5 -mb-1">
                  <Link href={`/lomba/${l.id}`} target="_blank" className="icon-action info" title="Lihat publik" style={{ width: 36, height: 36 }}>
                    <i className="fas fa-eye"></i>
                  </Link>
                  <Link href={`/admin/peserta/${l.id}`} className="icon-action info" title="Peserta" style={{ width: 36, height: 36 }}>
                    <i className="fas fa-users"></i>
                  </Link>
                  <Link href={`/admin/lomba/${l.id}/juara`} className="icon-action success" title="Pilih Juara" style={{ width: 36, height: 36 }}>
                    <i className="fas fa-trophy"></i>
                  </Link>
                  <button
                    onClick={() => { setEditing(l); setCreating(true); }}
                    className="icon-action"
                    title="Edit"
                    style={{ width: 36, height: 36 }}
                  >
                    <i className="fas fa-pen"></i>
                  </button>
                  <button
                    onClick={() => deleteLomba(l.id, l.nama)}
                    disabled={busy === l.id}
                    className="icon-action danger ml-auto"
                    title="Hapus"
                    style={{ width: 36, height: 36 }}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {creating && (
        <LombaModal
          editing={editing}
          kats={kats}
          nextUrutan={items.length > 0 ? Math.max(...items.map((l) => l.urutan)) + 1 : 1}
          onClose={() => { setCreating(false); setEditing(null); setError(""); }}
          onSave={saveLomba}
        />
      )}
    </>
  );
}
