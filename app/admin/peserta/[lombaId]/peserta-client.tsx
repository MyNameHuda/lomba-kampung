"use client";

import { useEffect, useState } from "react";
import { useNotify } from "@/components/notify-provider";
import { getInitials } from "@/lib/format";

type Peserta = {
  id: number;
  nomor: string;
  nama: string;
  noWa: string | null;
  umur: number;
  jenisKelamin: "L" | "P";
  kategoriId: string;
  kategori: string;
  hadir: boolean;
};

export type AdminGroupKey = "balita" | "anakL" | "anakP" | "dewasa";
export type AdminGroupData = Record<AdminGroupKey, Peserta[]>;

export type AdminSection = {
  key: AdminGroupKey;
  title: string;
  rangeLabel: string;
};

const ICON: Record<AdminGroupKey, string> = {
  balita: "fa-baby",
  anakL: "fa-child",
  anakP: "fa-child-dress",
  dewasa: "fa-user-tie",
};

const COLOR: Record<AdminGroupKey, { bg: string; text: string; border: string }> = {
  balita: { bg: "bg-[#FDF2F8]", text: "text-[#9D174D]", border: "border-[#FBCFE8]" },
  anakL:  { bg: "bg-[#EFF6FF]", text: "text-[#1E40AF]", border: "border-[#BFDBFE]" },
  anakP:  { bg: "bg-[#FDF2F8]", text: "text-[#9D174D]", border: "border-[#FBCFE8]" },
  dewasa: { bg: "bg-[#FFFBEB]", text: "text-[#92400E]", border: "border-[#FDE68A]" },
};

export default function PesertaClient({
  lomba,
  sections,
  initial,
}: {
  lomba: { id: number; nama: string; emoji: string };
  sections: AdminSection[];
  initial: AdminGroupData;
}) {
  const notify = useNotify();
  const [items, setItems] = useState<AdminGroupData>(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "hadir" | "belum">("all");

  // Sync with server-rendered prop after router.refresh()
  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const allItems = (Object.values(items) as Peserta[][]).flat();
  const hadir = allItems.filter((i) => i.hadir).length;

  async function toggleHadir(id: number, current: boolean) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/pendaftar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hadir: !current }),
      });
      if (!res.ok) throw new Error();
      updateItem(id, (it) => ({ ...it, hadir: !current }));
      notify.success(current ? "Status hadir dibatalkan" : "Ditandai hadir");
    } catch {
      notify.error("Gagal update kehadiran");
    } finally {
      setBusy(null);
    }
  }

  function updateItem(id: number, updater: (it: Peserta) => Peserta) {
    setItems((prev) => {
      const next = { ...prev };
      (Object.keys(next) as AdminGroupKey[]).forEach((k) => {
        next[k] = next[k].map((it) => (it.id === id ? updater(it) : it));
      });
      return next;
    });
  }

  function renderRow(p: Peserta) {
    const initials = getInitials(p.nama);
    const visible = filter === "all" || (filter === "hadir" ? p.hadir : !p.hadir);
    if (!visible) return null;
    return (
      <tr key={p.id} style={p.hadir ? { background: "rgba(219, 234, 254, 0.25)" } : {}}>
        <td className="p-2.5 pl-3.5 text-[#9CA3AF] font-mono text-[11px]">
          {p.nomor.replace(/^LMB-/, "")}
        </td>
        <td className="p-2.5" data-label="Peserta">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex flex-col gap-0.5 leading-snug">
              <div className="font-semibold text-[12px] truncate">{p.nama}</div>
              {p.noWa && <div className="text-[10px] text-[#6B7280]">📞 {p.noWa}</div>}
            </div>
          </div>
        </td>
        <td className="p-2.5 text-center" data-label="Umur">
          <span className="inline-block bg-[#F3F4F6] px-2 py-0.5 rounded-full text-[10px] font-bold text-[#374151]">
            {p.umur} th
          </span>
        </td>
        <td className="p-2.5 text-center" data-label="Hadir">
          <button
            onClick={() => toggleHadir(p.id, p.hadir)}
            disabled={busy === p.id}
            className={`inline-flex items-center justify-center w-8 h-8 rounded text-xs ${
              p.hadir ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#F3F4F6] text-[#6B7280]"
            }`}
            title={p.hadir ? "Batalkan hadir" : "Tandai hadir"}
          >
            <i className={`fas ${p.hadir ? "fa-check" : "fa-clock"}`}></i>
          </button>
        </td>
        <td className="p-2.5 pr-3.5 text-right" data-label="Aksi">
          {p.noWa ? (
            <a
              href={`https://wa.me/${p.noWa.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="icon-action"
              title="Chat WhatsApp"
            >
              <i className="fab fa-whatsapp"></i>
            </a>
          ) : (
            <span className="text-[#9CA3AF] text-[10px]">—</span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <>
      {/* Lomba Header */}
      <div
        className="card mb-4"
        style={{ background: "linear-gradient(135deg, #3aafb9 0%, #093a3e 100%)", color: "white", border: "none" }}
      >
        <div className="p-4 flex items-center gap-4">
          <div className="text-5xl">{lomba.emoji}</div>
          <div className="flex-1">
            <div className="text-xl font-extrabold">{lomba.nama}</div>
            <div className="text-[13px] opacity-90 mt-1">
              <i className="fas fa-infinity"></i> Kapasitas Tanpa Batas ·
              <i className="fas fa-users ml-2"></i> {allItems.length} peserta
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card success">
          <div className="icon"><i className="fas fa-user-check"></i></div>
          <div><div className="label">Total Disetujui</div><div className="value">{allItems.length}</div></div>
        </div>
        <div className="stat-card info">
          <div className="icon"><i className="fas fa-clipboard-check"></i></div>
          <div><div className="label">Hadir</div><div className="value">{hadir}</div></div>
        </div>
        <div className="stat-card primary">
          <div className="icon"><i className="fas fa-hourglass-half"></i></div>
          <div><div className="label">Belum Hadir</div><div className="value">{allItems.length - hadir}</div></div>
        </div>
      </div>

      {/* Filter */}
      <div className="filter-bar mb-4">
        <select
          className="input md:w-auto"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
        >
          <option value="all">Semua Peserta</option>
          <option value="hadir">Hadir saja</option>
          <option value="belum">Belum hadir</option>
        </select>
        <div className="text-[11px] text-[#6B7280] md:ml-auto leading-snug">
          <i className="fas fa-layer-group"></i> {allItems.length} peserta total · klik tombol hadir untuk toggle
        </div>
      </div>

      {/* Grouped Sections — driven by master kategori */}
      <div className="space-y-4">
        {sections.map((sec) => {
          const data = items[sec.key] || [];
          if (data.length === 0) return null;
          const c = COLOR[sec.key];
          return (
            <div key={sec.key} className={`rounded-lg border ${c.bg} ${c.border} overflow-hidden`}>
              <div className={`px-3.5 py-2.5 flex items-center gap-2 text-[12px] font-bold ${c.text}`}>
                <i className={`fas ${ICON[sec.key]}`}></i>
                <span>{sec.title}</span>
                <span className="font-normal opacity-70">· {sec.rangeLabel}</span>
                <span className="ml-auto bg-white/60 px-2 py-0.5 rounded-full text-[11px]">
                  {data.length} orang
                </span>
              </div>
              <div className="bg-white">
                <table className="w-full border-collapse text-[13px] mobile-card-table">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase text-[#6B7280] bg-[#F9FAFB]">
                      <th className="text-left p-2.5 pl-3.5 w-[80px]">No</th>
                      <th className="text-left p-2.5">Peserta</th>
                      <th className="text-center p-2.5 w-[60px]">Umur</th>
                      <th className="text-center p-2.5 w-[60px]">Hadir</th>
                      <th className="text-right p-2.5 pr-3.5 w-[60px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(renderRow)}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {allItems.length === 0 && (
          <div className="text-center py-8 text-[#6B7280] bg-white border border-[#E5E7EB] rounded-lg">
            <i className="fas fa-user-slash text-3xl text-[#D1D5DB] mb-2 block"></i>
            Belum ada peserta disetujui untuk lomba ini.
          </div>
        )}
      </div>
    </>
  );
}
