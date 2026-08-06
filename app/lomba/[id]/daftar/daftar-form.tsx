"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KAT_ICON, DEFAULT_KAT_ICON } from "@/lib/constants";

// Local kategori type — needs all fields required for umur range + auto-age logic.
// Tighter than the generic KategoriSlim (where everything is optional).
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

// Virtual kategori id used in the form when the lomba is eligible for BOTH
// k_anak_l and k_anak_p. We collapse them into a single "Anak" option here and
// resolve to the real id (k_anak_l / k_anak_p) at submit time based on the
// user-picked jenis_kelamin. This keeps the public form simple — warga just
// pick "Anak" + their gender, and the system auto-sorts into L / P peserta
// list (which is the existing `groupPendaftarForLomba` behaviour).
const VIRTUAL_ANAK_ID = "_anak";

/**
 * Collapse k_anak_l + k_anak_p into a single "Anak" picker option when both
 * are eligible. The merged option reuses the underlying k_anak_l fields for
 * icon / min / max / autoAge (L and P share the same range and metadata —
 * only the gender storage differs). When only one of L/P is eligible, we
 * surface it as-is (so single-gender lomba like a girls-only lomba shows
 * "Anak (Perempuan)" explicitly).
 */
function collapseKats(kategori: Kategori[]): Kategori[] {
  const anakL = kategori.find((k) => k.id === "k_anak_l");
  const anakP = kategori.find((k) => k.id === "k_anak_p");
  if (anakL && anakP) {
    const ref = anakL; // L and P share min/max/icon/autoAge
    return [
      ...kategori.filter((k) => k.id !== "k_anak_l" && k.id !== "k_anak_p"),
      { id: VIRTUAL_ANAK_ID, nama: "Anak", icon: ref.icon, min: ref.min, max: ref.max, autoAge: ref.autoAge },
    ];
  }
  return kategori;
}

/**
 * Resolve a form-level kategori id to the real DB kategori id.
 * Virtual "_anak" gets mapped to k_anak_l / k_anak_p based on jenis_kelamin.
 * Other ids (k_balita, k_dewasa_p, real k_anak_l / k_anak_p) pass through.
 */
function resolveKategoriId(formId: string, jenisKelamin: "L" | "P"): string {
  if (formId === VIRTUAL_ANAK_ID) return jenisKelamin === "L" ? "k_anak_l" : "k_anak_p";
  return formId;
}

export default function DaftarForm({ lomba, kategori }: { lomba: Lomba; kategori: Kategori[] }) {
  const router = useRouter();

  // Pick the kategori list the user actually sees in Step 1. The raw `kategori`
  // prop may contain both k_anak_l + k_anak_p — we collapse them so the picker
  // shows a single "Anak" option when both are eligible.
  const displayKats = useMemo(() => collapseKats(kategori), [kategori]);

  // Default to first eligible kategori (caller has already filtered by lomba.kategoriEligible)
  const [selectedKategori, setSelectedKategori] = useState<string | null>(displayKats[0]?.id || null);
  const [selectedUmur, setSelectedUmur] = useState<number | null>(null);
  const [nama, setNama] = useState("");
  const [jenisKelamin, setJenisKelamin] = useState<"L" | "P">("L");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // If displayKats changes (e.g. props update) and current selection is no
  // longer valid, fall back to the first option. This keeps the form in sync
  // without a hard remount.
  useEffect(() => {
    if (!selectedKategori || !displayKats.find((k) => k.id === selectedKategori)) {
      setSelectedKategori(displayKats[0]?.id || null);
      setSelectedUmur(null);
    }
  }, [displayKats, selectedKategori]);

  const selectedKat = useMemo(
    () => displayKats.find((k) => k.id === selectedKategori) || null,
    [selectedKategori, displayKats]
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
    const kat = displayKats.find((k) => k.id === id);
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
      // Resolve the form-level kategori id to the real DB id. The form
      // collapses k_anak_l + k_anak_p into a single "Anak" option, so we
      // need to map back based on the user-picked jenis_kelamin.
      const realKategoriId = resolveKategoriId(selectedKategori!, jenisKelamin);
      const res = await fetch("/api/pendaftar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: nama.trim(),
          noWa: null,
          jenisKelamin,
          kategoriId: realKategoriId,
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
        <div className="header-content">
          <Link href={`/lomba/${lomba.id}`} className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center" aria-label="Kembali ke detail lomba">
            <i className="fas fa-arrow-left"></i>
          </Link>
          <h2 className="text-base font-bold">Form Pendaftaran</h2>
        </div>
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
            {displayKats.map((k) => (
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
                  {KAT_ICON[k.icon] || DEFAULT_KAT_ICON}
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
          <div className="bg-[#FCE0E0] border border-[#FBE0E0] rounded-lg p-3 mb-4 flex items-start gap-2">
            <i className="fas fa-circle-info text-[#9D1010] mt-0.5"></i>
            <div className="text-[12px] text-[#9D1010]">
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

        {/* Submit button — inline below Jenis Kelamin (not sticky at
            bottom). Sticky CTA was causing desktop width bug AND warga
            shouldn't have to scroll back up to find the form's primary
            action. Form is short (3 steps), scroll is minimal. */}
        <button
          onClick={submit}
          disabled={submitting}
          className="btn btn-primary btn-block disabled:opacity-60 mt-2"
        >
          {submitting ? (
            <><i className="fas fa-spinner fa-spin"></i> Mengirim...</>
          ) : (
            <><i className="fas fa-paper-plane"></i> Kirim Pendaftaran</>
          )}
        </button>
      </main>
    </div>
  );
}
