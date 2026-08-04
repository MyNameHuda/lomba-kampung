"use client";

import { useState } from "react";
import type { Kategori } from "@/lib/db";

const ICON_OPTIONS = [
  "fa-child", "fa-user", "fa-user-tie", "fa-user-graduate",
  "fa-person", "fa-person-cane", "fa-baby",
  "fa-people-group", "fa-user-astronaut",
  "fa-heart", "fa-star", "fa-trophy", "fa-medal", "fa-crown",
];

export type KategoriFormData = {
  id?: string;
  nama: string;
  icon: string;
  min: number;
  max: number;
  autoAge: boolean;
  colorBg: string;
  colorText: string;
  colorBorder: string;
};

export default function KategoriModal({
  editing,
  onClose,
  onSave,
}: {
  editing: Kategori | null;
  onClose: () => void;
  onSave: (data: KategoriFormData) => void;
}) {
  const [nama, setNama] = useState(editing?.nama || "");
  const [icon, setIcon] = useState(editing?.icon || "fa-child");
  const [min, setMin] = useState(editing?.min || 5);
  const [max, setMax] = useState(editing?.max || 11);
  const [autoAge, setAutoAge] = useState(editing?.autoAge ?? (min >= 18));
  const [colorBg, setColorBg] = useState(editing?.colorBg || "#FEF3C7");
  const [colorText, setColorText] = useState(editing?.colorText || "#92400E");
  const [colorBorder, setColorBorder] = useState(editing?.colorBorder || "#FDE68A");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!nama.trim()) { setError("Nama wajib diisi"); return; }
    if (min < 1 || max < 1 || min > max) { setError("Range umur tidak valid"); return; }
    setBusy(true);
    setError("");
    try {
      await onSave({ id: editing?.id, nama: nama.trim(), icon, min, max, autoAge, colorBg, colorText, colorBorder });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-5" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-[480px] w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-base font-bold">{editing ? "Edit Kategori" : "Tambah Kategori"}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#F9FAFB] text-[#6B7280] flex items-center justify-center">
            <i className="fas fa-xmark"></i>
          </button>
        </div>
        <div className="p-5 overflow-y-auto">
          <div className="mb-4">
            <label className="label">Nama Kategori <span className="text-primary">*</span></label>
            <input className="input" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Contoh: Lansia" />
          </div>
          <div className="mb-4">
            <label className="label">Icon</label>
            <div className="grid grid-cols-5 gap-1.5">
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`aspect-square border-2 rounded flex items-center justify-center ${
                    icon === ic ? "bg-primary border-primary text-white" : "bg-white border-[#E5E7EB] text-[#6B7280]"
                  }`}
                >
                  <i className={`fas ${ic}`}></i>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Umur Min <span className="text-primary">*</span></label>
              <input type="number" className="input" value={min} min={1} max={150} onChange={(e) => setMin(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Umur Max <span className="text-primary">*</span></label>
              <input type="number" className="input" value={max} min={1} max={150} onChange={(e) => setMax(Number(e.target.value))} />
            </div>
          </div>
          <div className="text-[11px] text-[#6B7280] mt-2">
            <i className="fas fa-circle-info"></i> {autoAge ? "Kategori auto-umur: peserta tidak perlu pilih umur" : `${max - min + 1} umur akan muncul sebagai tombol di form`}
          </div>

          <div className="mt-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoAge}
                onChange={(e) => setAutoAge(e.target.checked)}
                className="mt-0.5 w-[18px] h-[18px] accent-primary"
              />
              <div>
                <strong className="block text-[#1F2937] text-[13px] mb-0.5">
                  <i className="fas fa-bolt text-[#9D1010]"></i> Auto Umur
                </strong>
                <span className="text-[#6B7280] text-[11px]">
                  Peserta tidak perlu pilih umur di form. Umur otomatis tercatat sebagai nilai minimum kategori ({min} tahun ke atas). Cocok untuk kategori "Dewasa" / "Lansia".
                </span>
              </div>
            </label>
          </div>

          <div className="mt-4">
            <label className="label">Warna Tag</label>
            <div className="text-[11px] text-[#6B7280] mb-2">
              <i className="fas fa-circle-info"></i> Warna badge yang muncul di daftar lomba & form pendaftaran
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-[#6B7280] uppercase tracking-wide font-bold">Background</label>
                <div className="flex items-center gap-1.5 mt-1">
                  <input type="color" value={colorBg} onChange={(e) => setColorBg(e.target.value)} className="w-10 h-10 rounded border border-[#E5E7EB] cursor-pointer" />
                  <input type="text" value={colorBg} onChange={(e) => setColorBg(e.target.value)} className="input flex-1 text-[11px] font-mono" maxLength={7} />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[#6B7280] uppercase tracking-wide font-bold">Teks</label>
                <div className="flex items-center gap-1.5 mt-1">
                  <input type="color" value={colorText} onChange={(e) => setColorText(e.target.value)} className="w-10 h-10 rounded border border-[#E5E7EB] cursor-pointer" />
                  <input type="text" value={colorText} onChange={(e) => setColorText(e.target.value)} className="input flex-1 text-[11px] font-mono" maxLength={7} />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[#6B7280] uppercase tracking-wide font-bold">Border</label>
                <div className="flex items-center gap-1.5 mt-1">
                  <input type="color" value={colorBorder} onChange={(e) => setColorBorder(e.target.value)} className="w-10 h-10 rounded border border-[#E5E7EB] cursor-pointer" />
                  <input type="text" value={colorBorder} onChange={(e) => setColorBorder(e.target.value)} className="input flex-1 text-[11px] font-mono" maxLength={7} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] text-[#6B7280]">Preview:</span>
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold"
                style={{ background: colorBg, color: colorText, border: `1.5px solid ${colorBorder}` }}
              >
                {nama || "Contoh"}
              </span>
            </div>
          </div>
          {error && (
            <div className="bg-[#FEE2E2] text-[#991B1B] text-sm rounded p-2.5 mt-3">
              <i className="fas fa-exclamation-triangle"></i> {error}
            </div>
          )}
        </div>
        <div className="p-3 bg-[#F9FAFB] flex gap-2">
          <button onClick={onClose} className="btn btn-secondary flex-1">Batal</button>
          <button onClick={submit} disabled={busy} className="btn btn-primary flex-1 disabled:opacity-60">
            {busy ? <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</> : <><i className="fas fa-save"></i> Simpan</>}
          </button>
        </div>
      </div>
    </div>
  );
}
