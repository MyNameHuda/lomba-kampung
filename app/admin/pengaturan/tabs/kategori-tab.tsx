"use client";

import { useState } from "react";
import { useNotify } from "@/components/notify-provider";
import KategoriModal from "../kategori-modal";
import type { Kategori } from "@/lib/db";

export default function KategoriTab({
  kats,
  setKats,
}: {
  kats: Kategori[];
  setKats: React.Dispatch<React.SetStateAction<Kategori[]>>;
}) {
  const notify = useNotify();
  const [editing, setEditing] = useState<Kategori | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function saveKategori(data: { id?: string; nama: string; icon: string; min: number; max: number; autoAge: boolean; colorBg: string; colorText: string; colorBorder: string }) {
    try {
      const isNew = !data.id;
      const res = await fetch("/api/admin/kategori", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: data.id,
          nama: data.nama,
          icon: data.icon,
          min: data.min,
          max: data.max,
          urutan: data.id ? (kats.find((k) => k.id === data.id)?.urutan || 0) : kats.length + 1,
          autoAge: data.autoAge,
          colorBg: data.colorBg,
          colorText: data.colorText,
          colorBorder: data.colorBorder,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal");
      if (isNew) {
        const newKat: Kategori = { id: json.id, nama: data.nama, icon: data.icon, min: data.min, max: data.max, urutan: kats.length + 1, autoAge: data.autoAge, colorBg: data.colorBg, colorText: data.colorText, colorBorder: data.colorBorder, createdAt: 0 };
        setKats((prev) => [...prev, newKat].sort((a, b) => a.min - b.min));
      } else {
        setKats((prev) => prev.map((k) => (k.id === data.id ? { ...k, ...data } as Kategori : k)).sort((a, b) => a.min - b.min));
      }
      setShowModal(false);
      setEditing(null);
      notify.success(isNew ? "Kategori berhasil ditambahkan" : "Kategori berhasil diperbarui");
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Gagal simpan kategori");
    }
  }

  async function deleteKat(id: string, nama: string) {
    const ok = await notify.confirm({
      title: "Hapus Kategori",
      message: `Hapus kategori "${nama}"?\n\nLomba yang menggunakan kategori ini mungkin akan kehilangan eligibility.`,
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/kategori?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setKats((prev) => prev.filter((k) => k.id !== id));
      notify.success(`Kategori "${nama}" berhasil dihapus`);
    } catch {
      notify.error("Gagal hapus kategori");
    }
  }

  return (
    <div className="card mb-5">
      <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
        <div>
          <div className="font-bold text-sm flex items-center gap-2"><i className="fas fa-layer-group text-primary"></i> Kategori Usia</div>
          <div className="text-xs text-[#6B7280] mt-0.5">Atur kategori yang muncul di form pendaftaran</div>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="btn btn-primary btn-sm"
        >
          <i className="fas fa-plus"></i> Tambah
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[11px] font-bold uppercase text-[#6B7280]" style={{ background: "#F9FAFB" }}>
              <th className="text-left p-3 border-b border-[#E5E7EB] w-[50px]"></th>
              <th className="text-left p-3 border-b border-[#E5E7EB]">Nama</th>
              <th className="text-left p-3 border-b border-[#E5E7EB]">Range Umur</th>
              <th className="text-left p-3 border-b border-[#E5E7EB]">Tombol</th>
              <th className="text-left p-3 border-b border-[#E5E7EB] w-[100px]">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {kats.map((k) => (
              <tr key={k.id} className="hover:bg-[#F9FAFB]">
                <td className="p-3 border-b border-[#E5E7EB]">
                  <div className="w-8 h-8 rounded-full bg-primary-light text-primary flex items-center justify-center">
                    <i className={`fas ${k.icon}`}></i>
                  </div>
                </td>
                <td className="p-3 border-b border-[#E5E7EB]">
                  <strong>{k.nama}</strong>
                  {k.autoAge && (
                    <span className="ml-2 inline-flex items-center gap-1 bg-[#FCE0E0] text-[#9D1010] text-[10px] font-bold px-1.5 py-0.5 rounded">
                      <i className="fas fa-bolt" style={{ fontSize: 8 }}></i> AUTO UMUR
                    </span>
                  )}
                </td>
                <td className="p-3 border-b border-[#E5E7EB]">
                  <span className="font-mono font-semibold text-primary bg-primary-light px-2 py-0.5 rounded-full text-[11px]">
                    {k.autoAge ? `${k.min}+ tahun` : `${k.min}–${k.max} tahun`}
                  </span>
                </td>
                <td className="p-3 border-b border-[#E5E7EB] text-[#6B7280] text-xs">
                  {k.autoAge ? <span className="text-[#9D1010]">skip</span> : `${k.max - k.min + 1} tombol`}
                </td>
                <td className="p-3 border-b border-[#E5E7EB]">
                  <div className="row-actions">
                    <button onClick={() => { setEditing(k); setShowModal(true); }} className="icon-action"><i className="fas fa-pen"></i></button>
                    <button onClick={() => deleteKat(k.id, k.nama)} className="icon-action reject"><i className="fas fa-trash"></i></button>
                  </div>
                </td>
              </tr>
            ))}
            {kats.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6 text-[#6B7280] empty-state-cell">Belum ada kategori.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <KategoriModal
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={saveKategori}
        />
      )}
    </div>
  );
}
