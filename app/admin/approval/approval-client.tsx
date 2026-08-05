"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNotify } from "@/components/notify-provider";
import { getInitials, timeAgo, dateFmt } from "@/lib/format";
import KatTag from "@/components/kat-tag";
import { KAT_ICON, DEFAULT_KAT_ICON } from "@/lib/constants";
import type { KategoriSlim } from "@/lib/types";

type Item = {
  id: number;
  nomor: string;
  nama: string;
  noWa: string | null;
  jenisKelamin: "L" | "P";
  umur: number;
  lombaId: number;
  lombaNama: string;
  lombaEmoji: string;
  lombaTipe: string;
  kategori: string;
  kategoriId: string;
  status: "pending" | "disetujui" | "ditolak";
  createdAt: string;
};

type Stats = {
  pending: number;
  disetujui: number;
  ditolak: number;
  total: number;
};

type LombaOption = { id: number; nama: string; emoji: string };

export default function ApprovalClient({
  initial,
  stats,
  lombaList,
  kategoriList,
}: {
  initial: Item[];
  stats: Stats;
  lombaList: LombaOption[];
  kategoriList: KategoriSlim[];
}) {
  const router = useRouter();
  const notify = useNotify();
  const [items, setItems] = useState(initial);
  // Local copy of stats so the cards update in real time as the user
  // approves/rejects, without waiting for the parent server re-render.
  const [liveStats, setLiveStats] = useState(stats);
  const [busy, setBusy] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterLombaId, setFilterLombaId] = useState<number | null>(null);
  const [filterKategoriId, setFilterKategoriId] = useState<string | null>(null);

  // Sync with server-rendered prop after router.refresh()
  useEffect(() => {
    setItems(initial);
    setLiveStats(stats);
  }, [initial, stats]);

  // Per-lomba / per-kategori pending counts for the chip badges.
  // Recomputed on every items change so the numbers stay accurate as
  // the user approves/rejects (without waiting for a server refresh).
  const countByLomba = useMemo(() => {
    const m = new Map<number, number>();
    for (const it of items) m.set(it.lombaId, (m.get(it.lombaId) ?? 0) + 1);
    return m;
  }, [items]);

  const countByKategori = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.kategoriId, (m.get(it.kategoriId) ?? 0) + 1);
    return m;
  }, [items]);

  // Combined filter: search (name) + lomba + kategori. All client-side.
  // "Semua" chips clear the respective filter. Empty chips hide when
  // the underlying filter has no matches.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (q && !it.nama.toLowerCase().includes(q)) return false;
      if (filterLombaId !== null && it.lombaId !== filterLombaId) return false;
      if (filterKategoriId !== null && it.kategoriId !== filterKategoriId) return false;
      return true;
    });
  }, [items, search, filterLombaId, filterKategoriId]);

  // Group visible items by lombaId for the card layout. Section order matches
  // the order items arrive in (newest first via DB ORDER BY created_at DESC),
  // so a freshly-arrived pendaftar shows up in its lomba's section at the top.
  // Returns Array (not Map) so React keys stay stable and we can .map().
  const groupedByLomba = useMemo(() => {
    const order: number[] = [];
    const groups = new Map<number, Item[]>();
    for (const it of visible) {
      if (!groups.has(it.lombaId)) {
        groups.set(it.lombaId, []);
        order.push(it.lombaId);
      }
      groups.get(it.lombaId)!.push(it);
    }
    return order
      .map((id) => {
        const arr = groups.get(id)!;
        const first = arr[0];
        return {
          lombaId: id,
          lombaNama: first.lombaNama,
          lombaEmoji: first.lombaEmoji,
          items: arr,
        };
      });
  }, [visible]);

  // Lookup map for kategori colors (used as left-border accent on each card)
  const katById = useMemo(() => {
    const m = new Map<string, KategoriSlim>();
    for (const k of kategoriList) m.set(k.id, k);
    return m;
  }, [kategoriList]);

  const pendingCount = items.length;
  const visibleCount = visible.length;
  const activeLomba = filterLombaId ? lombaList.find((l) => l.id === filterLombaId) : null;
  const activeKategori = filterKategoriId ? kategoriList.find((k) => k.id === filterKategoriId) : null;

  async function setStatus(id: number, status: "disetujui" | "ditolak") {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/pendaftar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Gagal");
      // Remove the item from local state — no longer pending
      setItems((prev) => prev.filter((it) => it.id !== id));
      // Update stats in real time so the cards reflect the change without refresh
      setLiveStats((prev) => ({
        ...prev,
        pending: Math.max(0, prev.pending - 1),
        [status === "disetujui" ? "disetujui" : "ditolak"]: prev[status === "disetujui" ? "disetujui" : "ditolak"] + 1,
      }));
      // Also tell Next.js to re-fetch server data so other pages (dashboard) update
      router.refresh();
      notify.success(status === "disetujui" ? "Pendaftar disetujui" : "Pendaftar ditolak");
    } catch (e) {
      notify.error("Gagal update status");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card warning">
          <div className="icon"><i className="fas fa-hourglass-half"></i></div>
          <div><div className="label">Menunggu</div><div className="value">{liveStats.pending}</div></div>
        </div>
        <div className="stat-card success">
          <div className="icon"><i className="fas fa-check"></i></div>
          <div><div className="label">Disetujui</div><div className="value">{liveStats.disetujui}</div></div>
        </div>
        <div className="stat-card primary">
          <div className="icon"><i className="fas fa-times"></i></div>
          <div><div className="label">Ditolak</div><div className="value">{liveStats.ditolak}</div></div>
        </div>
        <div className="stat-card info">
          <div className="icon"><i className="fas fa-users"></i></div>
          <div><div className="label">Total</div><div className="value">{liveStats.total}</div></div>
        </div>
      </div>

      {/* Filter chips — client-side, no URL change (matches user pref) */}
      {(lombaList.length > 0 || kategoriList.length > 0) && (
        <div className="space-y-2 mb-3">
          {/* Lomba chips */}
          {lombaList.length > 0 && (
            <div className="-mx-5 px-5 overflow-x-auto">
              <div className="flex gap-1.5 min-w-max pb-0.5">
                <button
                  type="button"
                  onClick={() => setFilterLombaId(null)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold border-2 transition-all ${
                    filterLombaId === null
                      ? "bg-primary border-primary text-white"
                      : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-primary hover:text-primary"
                  }`}
                >
                  <i className="fas fa-trophy text-[10px]"></i> Semua ({pendingCount})
                </button>
                {lombaList.map((l) => {
                  const isActive = filterLombaId === l.id;
                  const count = countByLomba.get(l.id) ?? 0;
                  if (count === 0 && !isActive) return null; // hide lomba with no pending
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setFilterLombaId(isActive ? null : l.id)}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold border-2 transition-all ${
                        isActive
                          ? "bg-primary border-primary text-white"
                          : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-primary hover:text-primary"
                      }`}
                    >
                      <span className="text-sm leading-none">{l.emoji}</span> {l.nama} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* Kategori chips */}
          {kategoriList.length > 0 && (
            <div className="-mx-5 px-5 overflow-x-auto">
              <div className="flex gap-1.5 min-w-max pb-0.5">
                <button
                  type="button"
                  onClick={() => setFilterKategoriId(null)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold border-2 transition-all ${
                    filterKategoriId === null
                      ? "bg-primary border-primary text-white"
                      : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-primary hover:text-primary"
                  }`}
                >
                  <i className="fas fa-tags text-[10px]"></i> Semua Kategori
                </button>
                {kategoriList.map((k) => {
                  const isActive = filterKategoriId === k.id;
                  const count = countByKategori.get(k.id) ?? 0;
                  if (count === 0 && !isActive) return null;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setFilterKategoriId(isActive ? null : k.id)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold border-2 transition-all"
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
          )}
        </div>
      )}

      <div className="filter-bar">
        <div className="search flex-1 md:min-w-[200px] min-w-0 relative">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-sm"></i>
          <input
            type="text"
            placeholder="Cari nama pendaftar..."
            className="input w-full pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Active filter summary */}
      {(filterLombaId || filterKategoriId) && (
        <div className="text-[11px] text-[#6B7280] mb-2 flex items-center gap-2 flex-wrap">
          <span>Filter aktif:</span>
          {activeLomba && (
            <button
              onClick={() => setFilterLombaId(null)}
              className="inline-flex items-center gap-1 bg-primary-light text-primary px-2 py-0.5 rounded-full font-semibold"
            >
              {activeLomba.emoji} {activeLomba.nama} <i className="fas fa-xmark text-[9px]"></i>
            </button>
          )}
          {activeKategori && (
            <button
              onClick={() => setFilterKategoriId(null)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold"
              style={{
                background: activeKategori.colorBg || "#E11D1D",
                color: activeKategori.colorText || "#FFFFFF",
              }}
            >
              {KAT_ICON[activeKategori.icon || "fa-user"] || DEFAULT_KAT_ICON} {activeKategori.nama} <i className="fas fa-xmark text-[9px]"></i>
            </button>
          )}
          <button
            onClick={() => { setFilterLombaId(null); setFilterKategoriId(null); }}
            className="text-[#9D1010] font-semibold hover:underline"
          >
            Reset semua
          </button>
        </div>
      )}
      <div className="text-[11px] text-[#6B7280] mb-2">
        {visibleCount} dari {pendingCount} pendaftar ditampilkan
      </div>

      {visible.length === 0 ? (
        <div className="card p-8 text-center">
          {search.trim() || filterLombaId || filterKategoriId ? (
            <div className="flex flex-col items-center gap-2.5 leading-relaxed max-w-[360px] mx-auto">
              <i className="fas fa-filter text-4xl text-[#D1D5DB] mb-1"></i>
              <strong className="block text-[#1F2937] text-base">Tidak ada hasil</strong>
              <span className="text-sm">Coba reset filter atau ganti kata kunci pencarian.</span>
              <button
                onClick={() => { setSearch(""); setFilterLombaId(null); setFilterKategoriId(null); }}
                className="inline-block mt-3 px-5 py-2.5 bg-primary-light text-primary rounded-lg font-semibold text-sm hover:bg-[#FBE0E0] transition-all whitespace-nowrap"
              >
                Reset semua filter
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5 leading-relaxed max-w-[360px] mx-auto">
              <i className="fas fa-check-circle text-5xl text-[#FBE0E0] mb-2"></i>
              <strong className="block text-[#9D1010] text-base">Semua bersih!</strong>
              <span className="text-sm">Tidak ada pendaftar yang menunggu approval.</span>
              <Link
                href="/admin/peserta"
                className="inline-block mt-3 px-5 py-2.5 bg-primary-light text-primary rounded-lg font-semibold text-sm no-underline hover:bg-[#FBE0E0] transition-all whitespace-nowrap"
              >
                Lihat daftar peserta →
              </Link>
            </div>
          )}
        </div>
      ) : (
        // Group cards by lomba. Each section has a sticky header so the user
        // always knows which lomba they're scrolling through. LombaTipe is
        // dropped (it was metadata that didn't help with the actual review
        // decision). Left border accent on each card uses the kategori color.
        <div>
          {groupedByLomba.map((group) => (
            <section key={group.lombaId} className="lomba-section">
              <header className="lomba-section-header">
                <span className="ls-emoji">{group.lombaEmoji}</span>
                <span className="ls-nama">{group.lombaNama}</span>
                <span className="ls-count">{group.items.length}</span>
              </header>
              <div>
                {group.items.map((it) => {
                  const initials = getInitials(it.nama);
                  const kat = katById.get(it.kategoriId);
                  const accent = kat?.colorBorder || kat?.colorBg || "#E5E7EB";
                  return (
                    <article
                      key={it.id}
                      className="pendaftar-card"
                      style={{ ["--accent" as string]: accent }}
                    >
                      <div className="pc-top">
                        <div className="pc-avatar">{initials}</div>
                        <div className="pc-identity">
                          <div className="pc-nama">{it.nama}</div>
                          {it.noWa && (
                            <a
                              href={`https://wa.me/${it.noWa.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="pc-wa"
                            >
                              <i className="fab fa-whatsapp"></i> {it.noWa}
                            </a>
                          )}
                        </div>
                        <div className="pc-actions">
                          <button
                            onClick={() => setStatus(it.id, "disetujui")}
                            disabled={busy === it.id}
                            className="icon-action approve"
                            title="Setujui"
                            aria-label="Setujui"
                          >
                            <i className="fas fa-check"></i>
                          </button>
                          <button
                            onClick={() => setStatus(it.id, "ditolak")}
                            disabled={busy === it.id}
                            className="icon-action reject"
                            title="Tolak"
                            aria-label="Tolak"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      </div>
                      <div className="pc-divider" />
                      <div className="pc-meta">
                        <span className="pc-meta-item">
                          <KatTag
                            nama={it.kategori}
                            colorBg={kat?.colorBg}
                            colorText={kat?.colorText}
                            colorBorder={kat?.colorBorder}
                            size="sm"
                          />
                        </span>
                        <span className="pc-meta-item">
                          <i className={`fas ${it.jenisKelamin === "L" ? "fa-mars text-[#3B82F6]" : "fa-venus text-[#EC4899]"}`}></i>
                          {it.jenisKelamin === "L" ? "Laki-laki" : "Perempuan"} · {it.umur} tahun
                        </span>
                        <span className="pc-time" title={dateFmt(it.createdAt)}>
                          <i className="far fa-clock"></i> {timeAgo(it.createdAt)}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
