"use client";

import { useState, useEffect, useMemo, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useNotify } from "@/components/notify-provider";
import { getInitials, timeAgo } from "@/lib/format";

type Lomba = {
  id: number;
  nama: string;
  emoji: string;
  status: string;
  kategoriEligible: string[];
};
type Kat = {
  id: string;
  nama: string;
  min: number;
  max: number;
  autoAge: boolean;
};
type Recent = { id: number; nama: string; lombaEmoji: string; lombaNama: string; status: string; createdAt: string };

export default function InputManualClient({ lombaList, kats, recent }: { lombaList: Lomba[]; kats: Kat[]; recent: Recent[] }) {
  const router = useRouter();
  const notify = useNotify();
  const [lombaId, setLombaId] = useState<number | null>(lombaList.find((l) => l.status === "aktif")?.id || lombaList[0]?.id || null);
  const [nama, setNama] = useState("");
  const [jenisKelamin, setJenisKelamin] = useState<"L" | "P">("L");
  const [kategoriId, setKategoriId] = useState<string>("");
  const [umur, setUmur] = useState<number | null>(null);
  const [hadir, setHadir] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Derive selected lomba + eligible kats from the master list
  const selectedLomba = useMemo(() => lombaList.find((l) => l.id === lombaId) || null, [lombaId, lombaList]);
  const eligibleKats = useMemo(() => {
    if (!selectedLomba) return [];
    const set = new Set(selectedLomba.kategoriEligible);
    return kats.filter((k) => set.has(k.id));
  }, [selectedLomba, kats]);

  const selectedKat = useMemo(() => eligibleKats.find((k) => k.id === kategoriId) || null, [eligibleKats, kategoriId]);
  const skipUmur = selectedKat?.autoAge ?? false;

  // Whenever lomba changes, ensure kategoriId points to an eligible one (or empty)
  useEffect(() => {
    if (eligibleKats.length === 0) {
      if (kategoriId !== "") setKategoriId("");
      if (umur !== null) setUmur(null);
      return;
    }
    if (!eligibleKats.some((k) => k.id === kategoriId)) {
      const first = eligibleKats[0];
      setKategoriId(first.id);
      setUmur(first.autoAge ? first.min : null);
    }
  }, [eligibleKats, kategoriId, umur]);

  function changeLombaId(newId: number) {
    setLombaId(newId);
    const l = lombaList.find((x) => x.id === newId);
    if (!l) {
      setKategoriId("");
      setUmur(null);
      return;
    }
    const set = new Set(l.kategoriEligible);
    const first = kats.find((k) => set.has(k.id));
    if (first) {
      setKategoriId(first.id);
      setUmur(first.autoAge ? first.min : null);
    } else {
      setKategoriId("");
      setUmur(null);
    }
  }

  function selectKategori(id: string) {
    setKategoriId(id);
    const k = eligibleKats.find((x) => x.id === id);
    if (k) setUmur(k.autoAge ? k.min : null);
    else setUmur(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!nama.trim() || !lombaId || !kategoriId || (!skipUmur && !umur)) {
      notify.warning("Semua field wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/pendaftar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: nama.trim(),
          jenisKelamin,
          kategoriId,
          umur: umur ?? selectedKat?.min ?? 0,
          lombaId,
          hadir,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal");
      notify.success(`Berhasil! Nomor: ${data.nomor}`);
      setNama("");
      // Keep lomba, jenisKelamin, kategoriId, umur as-is so admin can do rapid input.
      // Just reset hadir for the next entry.
      setHadir(false);
      setTimeout(() => router.refresh(), 500);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setSubmitting(false);
    }
  }

  const eligibleAges = selectedKat && !skipUmur
    ? Array.from({ length: selectedKat.max - selectedKat.min + 1 }, (_, i) => selectedKat.min + i)
    : [];

  return (
    <>
      <div className="bg-[#d4f1f4] border border-[#a7dde0] border-l-4 border-l-[#3aafb9] rounded p-3.5 mb-5 flex gap-3 items-start">
        <div className="w-8 h-8 rounded-full bg-[#3aafb9] text-white flex items-center justify-center flex-shrink-0 text-[13px]">
          <i className="fas fa-circle-info"></i>
        </div>
        <div className="text-[13px] text-[#093a3e] leading-relaxed">
          <strong className="block mb-1">Kapan pakai fitur ini?</strong>
          Untuk warga yang tidak bisa mendaftar sendiri (gaptek, tidak punya HP, atau datang langsung ke balai).
          Peserta otomatis <strong>Disetujui</strong> tanpa review admin.
        </div>
      </div>

      <div className="card max-w-[720px] p-6">
        <h3 className="text-base font-bold mb-1">📝 Data Peserta</h3>
        <div className="text-xs text-[#6B7280] mb-5">
          Semua field bertanda <span className="text-primary">*</span> wajib diisi
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Pilih Lomba <span className="text-primary">*</span></label>
            <select
              value={lombaId ?? ""}
              onChange={(e) => changeLombaId(Number(e.target.value))}
              className="input"
            >
              {lombaList.map((l) => (
                <option key={l.id} value={l.id}>{l.emoji} {l.nama}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Nama Lengkap <span className="text-primary">*</span></label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Hartono Wijaya"
                className="input"
              />
            </div>
            <div>
              <label className="label">Jenis Kelamin <span className="text-primary">*</span></label>
              <div className="radio-group">
                <div className={`radio-option ${jenisKelamin === "L" ? "active" : ""}`} onClick={() => setJenisKelamin("L")}>
                  <i className="fas fa-mars"></i> Laki-laki
                </div>
                <div className={`radio-option ${jenisKelamin === "P" ? "active" : ""}`} onClick={() => setJenisKelamin("P")}>
                  <i className="fas fa-venus"></i> Perempuan
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="label">Kategori Usia <span className="text-primary">*</span></label>
            {eligibleKats.length === 0 ? (
              <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-sm rounded p-3">
                <i className="fas fa-exclamation-triangle"></i> Lomba ini belum memiliki kategori eligible.
                Hubungi admin lomba untuk mengatur kategori.
              </div>
            ) : (
              <>
                <div className="radio-group" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {eligibleKats.map((k) => (
                    <div
                      key={k.id}
                      className={`radio-option ${kategoriId === k.id ? "active" : ""}`}
                      onClick={() => selectKategori(k.id)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        padding: "12px 8px",
                        lineHeight: 1.25,
                      }}
                    >
                      <strong style={{ display: "block", lineHeight: 1.2 }}>{k.nama}</strong>
                      <small
                        className="text-[10px] opacity-70"
                        style={{ display: "block", lineHeight: 1.2, fontWeight: 500 }}
                      >
                        {k.autoAge ? `${k.min}+ th · otomatis` : `${k.min}-${k.max} th`}
                      </small>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-[#6B7280] mt-1.5 text-center">
                  {eligibleKats.length} kategori tersedia untuk lomba ini
                </div>
              </>
            )}
          </div>

          {/* Pilih Umur — skip kalau autoAge (Dewasa) */}
          {selectedKat && !skipUmur && (
            <div>
              <label className="label">Pilih Umur <span className="text-primary">*</span></label>
              <div className="grid grid-cols-5 gap-1.5">
                {eligibleAges.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setUmur(a)}
                    className={`py-2 border-2 rounded text-sm font-bold min-h-[40px] ${
                      umur === a ? "bg-primary border-primary text-white" : "bg-white border-[#E5E7EB]"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Info kalau autoAge — tidak perlu pilih umur */}
          {selectedKat && skipUmur && (
            <div className="bg-[#d4f1f4] border border-[#a7dde0] rounded p-3 flex items-start gap-2">
              <i className="fas fa-circle-info text-[#093a3e] mt-0.5"></i>
              <div className="text-[12px] text-[#093a3e]">
                <strong>Kategori {selectedKat.nama}:</strong> usia otomatis tercatat{" "}
                <strong>{selectedKat.min} tahun ke atas</strong>. Tidak perlu pilih umur.
              </div>
            </div>
          )}

          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3.5">
            <label className="flex gap-2.5 items-start cursor-pointer text-[13px]">
              <input type="checkbox" checked={hadir} onChange={(e) => setHadir(e.target.checked)} className="mt-0.5 w-[18px] h-[18px] accent-primary" />
              <div>
                <strong className="block text-[#1F2937] mb-0.5">
                  <i className="fas fa-check-circle text-[#15803D]"></i> Tandai sebagai Hadir
                </strong>
                <span className="text-[#6B7280] text-xs">Centang jika warga ini sedang di depan Anda dan ikut serta sekarang</span>
              </div>
            </label>
          </div>

          <div className="flex gap-2 pt-5 mt-6 border-t border-[#E5E7EB]">
            <button
              type="button"
              className="btn btn-secondary flex-1"
              onClick={() => {
                setNama("");
                setUmur(skipUmur && selectedKat ? selectedKat.min : null);
                setHadir(false);
              }}
            >
              Batal
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary flex-1 disabled:opacity-60">
              {submitting ? <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</> : <><i className="fas fa-save"></i> Simpan & Setujui</>}
            </button>
          </div>
        </form>
      </div>

      {/* Recent */}
      {recent.length > 0 && (
        <div className="card mt-6 overflow-hidden">
          <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <div>
              <div className="font-bold text-sm">Input Manual Terbaru</div>
              <div className="text-xs text-[#6B7280] mt-0.5">5 peserta terakhir yang diinput</div>
            </div>
            <LinkButton href="/admin/peserta">Lihat semua →</LinkButton>
          </div>
          <div className="divide-y divide-[#E5E7EB]">
            {recent.map((r) => (
              <div key={r.id} className="p-3 flex items-center gap-3">
                <div className="text-2xl leading-none">{r.lombaEmoji}</div>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5 leading-snug">
                  <div className="font-semibold text-[13px]">{r.nama}</div>
                  <div className="text-[11px] text-[#6B7280]">{r.lombaNama} · {timeAgo(r.createdAt)}</div>
                </div>
                {r.status === "disetujui" && <span className="status-badge status-approved"><i className="fas fa-check"></i> OK</span>}
                {r.status === "hadir" && <span className="status-badge status-hadir"><i className="fas fa-check"></i> Hadir</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-xs text-primary font-semibold no-underline">
      {children}
    </a>
  );
}
