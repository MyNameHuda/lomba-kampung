"use client";

import { useEffect, useState } from "react";
import { useNotify } from "@/components/notify-provider";
import { getInitials } from "@/lib/format";
import { SECTION_ICON, SECTION_COLOR } from "@/lib/constants";
import html2canvas from "html2canvas";
import type { AdminGroupKey, AdminGroupData, AdminSection, EligibleKategori, PesertaSlim as Peserta } from "@/lib/types";

// Re-export so existing imports of AdminGroupKey from this file keep working
export type { AdminGroupKey, AdminGroupData, AdminSection } from "@/lib/types";

export default function PesertaClient({
  lomba,
  sections,
  initial,
  eligibleKategori,
}: {
  lomba: { id: number; nama: string; emoji: string };
  sections: AdminSection[];
  initial: AdminGroupData;
  eligibleKategori: EligibleKategori[];
}) {
  const notify = useNotify();
  const [items, setItems] = useState<AdminGroupData>(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "hadir" | "belum">("all");
  const [editing, setEditing] = useState<Peserta | null>(null);
  // v7: per-section export-to-image state. Section key being exported,
  // or null when no export is in flight.
  const [exporting, setExporting] = useState<AdminGroupKey | null>(null);

  // Sync with server-rendered prop after router.refresh()
  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const allItems = (Object.values(items) as Peserta[][]).flat();
  const hadir = allItems.filter((i) => i.hadir).length;

  // Group key for a peserta — derives from kategoriId + umur + jenisKelamin
  // to match the server-side `groupPendaftarForLomba` classification.
  function groupKeyFor(p: { kategoriId: string; umur: number; jenisKelamin: "L" | "P" }): AdminGroupKey | null {
    const k = eligibleKategori.find((x) => x.id === p.kategoriId);
    if (!k) return null;
    if (k.min < 5) return "balita";
    if (k.min < 18) return p.jenisKelamin === "L" ? "anakL" : "anakP";
    return "dewasa";
  }

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

  function moveItem(id: number, newFields: { umur: number; jenisKelamin: "L" | "P"; kategoriId: string }) {
    setItems((prev) => {
      const next: AdminGroupData = { balita: [], anakL: [], anakP: [], dewasa: [] };
      // Build new kategori name
      const newKat = eligibleKategori.find((k) => k.id === newFields.kategoriId);
      (Object.keys(prev) as AdminGroupKey[]).forEach((k) => {
        for (const it of prev[k]) {
          if (it.id === id) {
            // move this item to the correct new section
            const newKey = groupKeyFor(newFields);
            if (newKey) {
              const updated: Peserta = {
                ...it,
                ...newFields,
                kategori: newKat?.nama || it.kategori,
              };
              next[newKey].push(updated);
            }
            // if newKey is null, drop the item (shouldn't happen)
          } else {
            next[k].push(it);
          }
        }
      });
      return next;
    });
  }

  function removeItem(id: number) {
    setItems((prev) => {
      const next: AdminGroupData = { balita: [], anakL: [], anakP: [], dewasa: [] };
      (Object.keys(prev) as AdminGroupKey[]).forEach((k) => {
        next[k] = prev[k].filter((it) => it.id !== id);
      });
      return next;
    });
  }

  async function deleteItem(p: Peserta) {
    const ok = await notify.confirm({
      title: "Hapus Peserta",
      message: `Hapus peserta "${p.nama}" (${p.nomor})?\n\nTindakan ini tidak bisa dibatalkan.`,
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(p.id);
    try {
      const res = await fetch(`/api/admin/pendaftar/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Gagal");
      }
      removeItem(p.id);
      notify.success(`Peserta "${p.nama}" berhasil dihapus`);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Gagal hapus peserta");
    } finally {
      setBusy(null);
    }
  }

  // v7: Export a single kategori section as a PNG image. Builds an
  // offscreen DOM with a clean 5-column table (Lomba, Kategori, No,
  // Nama Peserta, Umur) + a header banner, then renders it via
  // html2canvas and triggers a download. The DOM container is removed
  // immediately after capture.
  //
  // Why offscreen + inline styles (not the visible DOM): the visible
  // section has icons, action buttons, hadir toggle — we want a clean
  // printable table with just the requested 4 columns. Inline styles
  // ensure html2canvas paints correctly without depending on the
  // page's CSS variables or external font loading.
  async function exportSectionAsImage(sec: AdminSection, data: Peserta[]) {
    if (data.length === 0) {
      notify.warning("Tidak ada peserta untuk diexport");
      return;
    }
    setExporting(sec.key);
    // Build offscreen container
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "-99999px";
    container.style.left = "-99999px";
    container.style.width = "720px";
    container.style.background = "#ffffff";
    container.style.padding = "24px";
    container.style.fontFamily = "Arial, Helvetica, sans-serif";
    container.style.color = "#1F2937";
    container.style.boxSizing = "border-box";

    const escapeHtml = (s: string) =>
      s.replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
      );
    const today = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    container.innerHTML = `
      <div style="border-bottom: 3px solid #E11D1D; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="font-size: 20px; font-weight: 800; color: #E11D1D; line-height: 1.2;">
          ${escapeHtml(lomba.emoji)} ${escapeHtml(lomba.nama)}
        </div>
        <div style="font-size: 14px; color: #6B7280; margin-top: 6px; font-weight: 600;">
          Kategori: ${escapeHtml(sec.title)} &middot; ${escapeHtml(sec.rangeLabel)}
        </div>
        <div style="font-size: 12px; color: #9CA3AF; margin-top: 4px;">
          ${data.length} peserta &middot; Dicetak ${escapeHtml(today)}
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; line-height: 1.4;">
        <thead>
          <tr style="background: #E11D1D; color: #ffffff;">
            <th style="padding: 10px 8px; text-align: left; border: 1px solid #cbd5e1; font-weight: 700;">Lomba</th>
            <th style="padding: 10px 8px; text-align: left; border: 1px solid #cbd5e1; font-weight: 700;">Kategori</th>
            <th style="padding: 10px 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: 700; width: 36px;">No</th>
            <th style="padding: 10px 8px; text-align: left; border: 1px solid #cbd5e1; font-weight: 700;">Nama Peserta</th>
            <th style="padding: 10px 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: 700; width: 56px;">Umur</th>
          </tr>
        </thead>
        <tbody>
          ${data
            .map(
              (p, i) => `
            <tr style="background: ${i % 2 === 0 ? "#ffffff" : "#F9FAFB"};">
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(lomba.nama)}</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(sec.title)}</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; color: #6B7280;">${i + 1}</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: 600;">${escapeHtml(p.nama)}</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${p.umur} th</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9CA3AF; text-align: center;">
        Daftar Peserta &middot; ${escapeHtml(lomba.nama)} &middot; ${escapeHtml(sec.title)}
      </div>
    `;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",
        scale: 2, // retina-quality
        logging: false,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const safeName = `${lomba.nama}-${sec.title}`
        .replace(/[^a-zA-Z0-9.-]+/g, "_")
        .replace(/_+/g, "_");
      link.href = dataUrl;
      link.download = `${safeName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      notify.success(`Export ${sec.title} berhasil (${data.length} peserta)`);
    } catch (e) {
      console.error("Export failed:", e);
      notify.error("Gagal export gambar");
    } finally {
      document.body.removeChild(container);
      setExporting(null);
    }
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
          <div className="row-actions justify-end">
            {p.noWa && (
              <a
                href={`https://wa.me/${p.noWa.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="icon-action"
                title="Chat WhatsApp"
              >
                <i className="fab fa-whatsapp"></i>
              </a>
            )}
            <button
              onClick={() => setEditing(p)}
              disabled={busy === p.id}
              className="icon-action"
              title="Edit peserta"
            >
              <i className="fas fa-pen"></i>
            </button>
            <button
              onClick={() => deleteItem(p)}
              disabled={busy === p.id}
              className="icon-action reject"
              title="Hapus peserta"
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      {/* Lomba Header */}
      <div
        className="card mb-4"
        style={{ background: "linear-gradient(135deg, #E11D1D 0%, #9D1010 100%)", color: "white", border: "none" }}
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
          const c = SECTION_COLOR[sec.key as keyof typeof SECTION_COLOR];
          const isExporting = exporting === sec.key;
          return (
            <div key={sec.key} className={`rounded-lg border ${c.bg} ${c.border} overflow-hidden`}>
              <div className={`px-3.5 py-2.5 flex items-center gap-2 text-[12px] font-bold ${c.text}`}>
                <i className={`fas ${SECTION_ICON[sec.key]}`}></i>
                <span>{sec.title}</span>
                <span className="font-normal opacity-70">· {sec.rangeLabel}</span>
                <span className="ml-auto bg-white/60 px-2 py-0.5 rounded-full text-[11px]">
                  {data.length} orang
                </span>
                {/* v7: Export-to-image button per kategori section */}
                <button
                  type="button"
                  onClick={() => exportSectionAsImage(sec, data)}
                  disabled={exporting !== null}
                  className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/80 hover:bg-white text-[11px] font-bold border border-current/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title={`Export ${sec.title} sebagai gambar PNG`}
                >
                  {isExporting ? (
                    <><i className="fas fa-spinner fa-spin"></i> Export...</>
                  ) : (
                    <><i className="fas fa-image"></i> Export</>
                  )}
                </button>
              </div>
              <div className="bg-white">
                <table className="w-full border-collapse text-[13px] mobile-card-table">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase text-[#6B7280] bg-[#F9FAFB]">
                      <th className="text-left p-2.5 pl-3.5 w-[80px]">No</th>
                      <th className="text-left p-2.5">Peserta</th>
                      <th className="text-center p-2.5 w-[60px]">Umur</th>
                      <th className="text-center p-2.5 w-[60px]">Hadir</th>
                      <th className="text-right p-2.5 pr-3.5 w-[120px]">Aksi</th>
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

      {/* Edit Modal */}
      {editing && (
        <EditPesertaModal
          peserta={editing}
          eligibleKategori={eligibleKategori}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            // Move the item to the correct section based on updated kategori/umur/jk
            moveItem(updated.id, {
              kategoriId: updated.kategoriId,
              umur: updated.umur,
              jenisKelamin: updated.jenisKelamin,
            });
            // Update other fields in place (within the new section)
            updateItem(updated.id, () => updated);
            setEditing(null);
            notify.success("Peserta berhasil diperbarui");
          }}
        />
      )}
    </>
  );
}

function EditPesertaModal({
  peserta,
  eligibleKategori,
  onClose,
  onSaved,
}: {
  peserta: Peserta;
  eligibleKategori: EligibleKategori[];
  onClose: () => void;
  onSaved: (updated: Peserta) => void;
}) {
  const [nama, setNama] = useState(peserta.nama);
  const [noWa, setNoWa] = useState(peserta.noWa || "");
  const [umur, setUmur] = useState<number>(peserta.umur);
  const [jenisKelamin, setJenisKelamin] = useState<"L" | "P">(peserta.jenisKelamin);
  const [kategoriId, setKategoriId] = useState(peserta.kategoriId);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Warn if umur outside the chosen kategori range
  const kat = eligibleKategori.find((k) => k.id === kategoriId);
  const umurWarning = kat && (umur < kat.min || umur > kat.max)
    ? `Umur ${umur} di luar range kategori ${kat.nama} (${kat.min}-${kat.max} th)`
    : "";

  async function save() {
    setErr("");
    if (!nama.trim()) { setErr("Nama wajib diisi"); return; }
    if (nama.trim().length < 2) { setErr("Nama minimal 2 karakter"); return; }
    if (umur < 1 || umur > 120) { setErr("Umur harus 1-120"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pendaftar/${peserta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: nama.trim(),
          noWa: noWa.trim() || null,
          umur,
          jenisKelamin,
          kategoriId,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal");
      onSaved({
        ...peserta,
        nama: nama.trim(),
        noWa: noWa.trim() || null,
        umur,
        jenisKelamin,
        kategoriId,
        kategori: kat?.nama || peserta.kategori,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-[480px] w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">Edit Peserta</h3>
            <div className="text-[11px] text-[#6B7280] font-mono mt-0.5">{peserta.nomor}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F9FAFB] text-[#6B7280] flex items-center justify-center hover:bg-[#E5E7EB]">
            <i className="fas fa-xmark"></i>
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-3.5">
          <div>
            <label className="label">Nama <span className="text-primary">*</span></label>
            <input className="input" value={nama} onChange={(e) => setNama(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">No WhatsApp <span className="text-[10px] text-[#6B7280] font-normal">(opsional)</span></label>
            <input className="input" value={noWa} onChange={(e) => setNoWa(e.target.value)} placeholder="0812-..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Umur <span className="text-primary">*</span></label>
              <input type="number" className="input" min={1} max={120} value={umur} onChange={(e) => setUmur(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Jenis Kelamin <span className="text-primary">*</span></label>
              <select className="input" value={jenisKelamin} onChange={(e) => setJenisKelamin(e.target.value as "L" | "P")}>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Kategori <span className="text-primary">*</span></label>
            <select className="input" value={kategoriId} onChange={(e) => setKategoriId(e.target.value)}>
              {eligibleKategori.map((k) => (
                <option key={k.id} value={k.id}>{k.nama} ({k.min}-{k.max} th)</option>
              ))}
            </select>
          </div>
          {umurWarning && (
            <div className="bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-[12px] rounded p-2.5 leading-snug">
              <i className="fas fa-triangle-exclamation"></i> {umurWarning}
            </div>
          )}
          {err && (
            <div className="bg-[#FEE2E2] text-[#991B1B] text-sm rounded p-3 leading-relaxed">
              <i className="fas fa-exclamation-triangle"></i> {err}
            </div>
          )}
        </div>
        <div className="p-4 bg-[#F9FAFB] flex gap-2 border-t border-[#E5E7EB]">
          <button onClick={onClose} className="btn btn-secondary flex-1">Batal</button>
          <button onClick={save} disabled={saving} className="btn btn-primary flex-1 disabled:opacity-60">
            {saving ? <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</> : <><i className="fas fa-save"></i> Simpan</>}
          </button>
        </div>
      </div>
    </div>
  );
}
