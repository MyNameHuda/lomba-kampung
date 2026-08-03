"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Kategori = {
  id: string;
  nama: string;
  icon: string;
  min: number;
  max: number;
  autoAge: boolean;
};

type Lomba = {
  id: number;
  nama: string;
  emoji: string;
};

const ICON_MAP: Record<string, string> = {
  "fa-child": "👶",
  "fa-user": "🧑",
  "fa-user-tie": "👨‍💼",
  "fa-baby": "👶",
  "fa-user-graduate": "🎓",
  "fa-person-cane": "🧓",
};

export default function DaftarForm({ lomba, kategori }: { lomba: Lomba; kategori: Kategori[] }) {
  const router = useRouter();
  // Default to first eligible kategori (caller has already filtered by lomba.kategoriEligible)
  const [selectedKategori, setSelectedKategori] = useState<string | null>(kategori[0]?.id || null);
  const [selectedUmur, setSelectedUmur] = useState<number | null>(null);
  const [nama, setNama] = useState("");
  const [jenisKelamin, setJenisKelamin] = useState<"L" | "P">("L");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedKat = useMemo(
    () => kategori.find((k) => k.id === selectedKategori) || null,
    [selectedKategori, kategori]
  );

  const ages = useMemo(() => {
    if (!selectedKat) return [];
    const arr: number[] = [];
    for (let i = selectedKat.min; i <= selectedKat.max; i++) arr.push(i);
    return arr;
  }, [selectedKat]);

  const skipUmur = selectedKat?.autoAge ?? false;

  // Reset umur when kategori changes
  function selectKategori(id: string) {
    setSelectedKategori(id);
    const kat = kategori.find((k) => k.id === id);
    if (kat) {
      // For autoAge categories, default umur to min (e.g. 18 for Dewasa)
      setSelectedUmur(kat.autoAge ? kat.min : null);
    }
  }

  async function submit() {
    if (!nama.trim()) { setError("Nama wajib diisi"); return; }
    if (!selectedUmur) { setError("Pilih umur dulu"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/pendaftar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: nama.trim(),
          noWa: null,
          jenisKelamin,
          kategoriId: selectedKategori,
          umur: selectedUmur,
          lombaId: lomba.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal");
      router.push(`/lomba/${lomba.id}/daftar/sukses?nomor=${data.nomor}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mendaftar");
      setSubmitting(false);
    }
  }

  return (
    <div className="form-page">
      <header className="form-header">
        <Link href={`/lomba/${lomba.id}`} className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center">
          <i className="fas fa-arrow-left"></i>
        </Link>
        <h2 className="text-base font-bold">Form Pendaftaran</h2>
      </header>

      <main className="form-body">
        <div className="form-intro">
          <strong>{lomba.emoji} Lomba: {lomba.nama}</strong>
          <div className="mt-1">Semua usia · Kapasitas tanpa batas</div>
        </div>

        {/* Step 1: Pilih Kategori */}
        <div className="step-badge">
          <i className="fas fa-1"></i> Langkah 1
        </div>
        <div className="mb-4">
          <label className="label">Pilih Kategori <span className="text-primary">*</span></label>
          <div className="flex flex-col gap-2">
            {kategori.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => selectKategori(k.id)}
                className={`w-full px-4 py-3 border-2 rounded text-sm font-semibold text-left flex items-center gap-3 transition-all ${
                  selectedKategori === k.id
                    ? "bg-primary-light border-primary text-primary"
                    : "bg-white border-[#E5E7EB] text-[#1F2937]"
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base ${
                  selectedKategori === k.id ? "bg-primary text-white" : "bg-[#F9FAFB] text-[#6B7280]"
                }`}>
                  {ICON_MAP[k.icon] || "👤"}
                </div>
                <div className="flex-1">
                  <div className="font-bold">{k.nama}</div>
                  <div className={`text-[11px] font-normal ${selectedKategori === k.id ? "text-primary-dark" : "text-[#6B7280]"}`}>
                    {k.autoAge ? `Usia ${k.min}+ tahun · otomatis` : `Usia ${k.min}-${k.max} tahun`}
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[11px] ${
                  selectedKategori === k.id ? "bg-primary border-primary text-white" : "border-[#D1D5DB] text-transparent"
                }`}>
                  <i className="fas fa-check"></i>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Pilih Umur (skip kalau autoAge) */}
        {!skipUmur && (
          <>
            <div className="step-badge">
              <i className="fas fa-2"></i> Langkah 2
            </div>
            <div className="mb-4">
              <label className="label">Pilih Umur <span className="text-primary">*</span></label>
              <div className="grid grid-cols-5 gap-1.5">
                {ages.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setSelectedUmur(a)}
                    className={`py-3 border-2 rounded text-sm font-bold text-center min-h-[44px] ${
                      selectedUmur === a
                        ? "bg-primary border-primary text-white"
                        : "bg-white border-[#E5E7EB] text-[#1F2937]"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              {selectedKat && (
                <div className="bg-[#F9FAFB] rounded p-2 text-[11px] text-[#6B7280] text-center mt-2">
                  <strong className="text-primary">{ages.length}</strong> tombol umur untuk kategori <strong>{selectedKat.nama}</strong> ({selectedKat.min}-{selectedKat.max} tahun)
                </div>
              )}
            </div>
          </>
        )}

        {skipUmur && selectedKat && (
          <div className="bg-[#d4f1f4] border border-[#a7dde0] rounded-lg p-3 mb-4 flex items-start gap-2">
            <i className="fas fa-circle-info text-[#093a3e] mt-0.5"></i>
            <div className="text-[12px] text-[#093a3e]">
              <strong>Kategori {selectedKat.nama}:</strong> tidak perlu pilih umur. Peserta akan otomatis tercatat dengan usia minimum kategori ({selectedKat.min} tahun ke atas).
            </div>
          </div>
        )}

        {/* Step Data Diri */}
        <div className="step-badge" style={{ background: "#DCFCE7", color: "#15803D" }}>
          <i className={`fas ${skipUmur ? "fa-2" : "fa-3"}`}></i> Langkah {skipUmur ? "2" : "3"}
        </div>

        <div className="mb-4">
          <label className="label">Nama Lengkap <span className="text-primary">*</span></label>
          <input
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Contoh: Budi Santoso"
            className="input"
          />
          <div className="text-[11px] text-[#9CA3AF] mt-1">Sesuai KTP / Kartu Keluarga</div>
        </div>

        <div className="mb-4">
          <label className="label">Jenis Kelamin <span className="text-primary">*</span></label>
          <div className="radio-group">
            <div
              className={`radio-option ${jenisKelamin === "L" ? "active" : ""}`}
              onClick={() => setJenisKelamin("L")}
            >
              <i className="fas fa-mars"></i> Laki-laki
            </div>
            <div
              className={`radio-option ${jenisKelamin === "P" ? "active" : ""}`}
              onClick={() => setJenisKelamin("P")}
            >
              <i className="fas fa-venus"></i> Perempuan
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-sm rounded p-3 mb-3">
            <i className="fas fa-exclamation-triangle"></i> {error}
          </div>
        )}
      </main>

      <div className="form-footer">
        <button
          onClick={submit}
          disabled={submitting}
          className="btn btn-primary btn-block disabled:opacity-60"
        >
          {submitting ? (
            <><i className="fas fa-spinner fa-spin"></i> Mengirim...</>
          ) : (
            <><i className="fas fa-paper-plane"></i> Kirim Pendaftaran</>
          )}
        </button>
      </div>
    </div>
  );
}
