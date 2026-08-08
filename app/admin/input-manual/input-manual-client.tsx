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

// v2: collapse k_anak_l + k_anak_p into a single "Anak" picker option
// when both are eligible, matching the public daftar-form pattern. The
// "Laki-laki" / "Perempuan" button below (Jenis Kelamin) determines
// which sub-kategori is saved. Admin already knows the gender of the
// warga they're inputting, so no need to ask twice.
const VIRTUAL_ANAK_ID = "_anak_virtual";

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
  // v2: search filter for lomba dropdown (21 lomba in prod is too long
  // to scroll through). Keeps the current select element; just narrows
  // the options shown.
  const [lombaSearch, setLombaSearch] = useState("");

  // Derive selected lomba + eligible kats from the master list
  const selectedLomba = useMemo(() => lombaList.find((l) => l.id === lombaId) || null, [lombaId, lombaList]);

  // Collapse k_anak_l + k_anak_p into a single virtual option when both
  // are eligible. The virtual id "_anak_virtual" gets mapped to the
  // real k_anak_l / k_anak_p at submit time based on jenisKelamin.
  const eligibleKats = useMemo(() => {
    if (!selectedLomba) return [];
    const set = new Set(selectedLomba.kategoriEligible);
    const baseKats = kats.filter((k) => set.has(k.id));
    const hasL = baseKats.some((k) => k.id === "k_anak_l");
    const hasP = baseKats.some((k) => k.id === "k_anak_p");
    if (hasL && hasP) {
      // Replace k_anak_l + k_anak_p with a single virtual "Anak" option.
      // Reuse k_anak_l's metadata (min/max/autoAge) — both share same.
      const sample = baseKats.find((k) => k.id === "k_anak_l")!;
      return [
        ...baseKats.filter((k) => k.id !== "k_anak_l" && k.id !== "k_anak_p"),
        { ...sample, id: VIRTUAL_ANAK_ID, nama: "Anak" },
      ];
    }
    return baseKats;
  }, [selectedLomba, kats]);

  const selectedKat = useMemo(() => eligibleKats.find((k) => k.id === kategoriId) || null, [eligibleKats, kategoriId]);
  const skipUmur = selectedKat?.autoAge ?? false;

  // v3: When lombaId changes, derive kategoriId + umur from the new
  // eligibleKats. Declared with ONLY [lombaId] dep so it only runs
  // when the user picks a new lomba (not on every eligibleKats/
  // kategoriId/umur change, which would cause race conditions with
  // the manual setKategoriId calls inside changeLombaId).
  //
  // The earlier version had `[eligibleKats, kategoriId, umur]` deps
  // which caused a real bug: when the user searched for a lomba and
  // clicked a result, the form fields (Kategori Usia, Umur) didn't
  // update to match the new lomba's specs. The old useEffect would
  // race with changeLombaId's manual setKategoriId and leave the
  // state pointing to the OLD lomba's first eligible.
  useEffect(() => {
    if (eligibleKats.length === 0) {
      setKategoriId("");
      setUmur(null);
      return;
    }
    // Always snap to the first eligible of the new lomba. This is
    // the simpler, more predictable behavior — admin is switching
    // contexts, not preserving the old kategori selection.
    const first = eligibleKats[0];
    setKategoriId(first.id);
    setUmur(first.autoAge ? first.min : null);
  }, [lombaId]);

  function changeLombaId(newId: number) {
    setLombaId(newId);
    setLombaSearch(""); // clear search when changing lomba
    // Don't manually setKategoriId/setUmur here — the useEffect above
    // derives them from eligibleKats. This avoids race conditions
    // where this function's updates would be overwritten by the
    // useEffect on the next render.
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
      // Resolve virtual "_anak_virtual" → real k_anak_l / k_anak_p
      // based on the selected jenis_kelamin. Other ids pass through.
      const realKategoriId =
        kategoriId === VIRTUAL_ANAK_ID
          ? jenisKelamin === "L" ? "k_anak_l" : "k_anak_p"
          : kategoriId;
      const res = await fetch("/api/admin/pendaftar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: nama.trim(),
          jenisKelamin,
          kategoriId: realKategoriId,
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

  // v2: filter lomba list by search query (case-insensitive, matches nama).
  // When search is empty, show all lomba. Sorted by urutan (already
  // sorted from server).
  const filteredLombaList = useMemo(() => {
    const q = lombaSearch.trim().toLowerCase();
    if (!q) return lombaList;
    return lombaList.filter((l) => l.nama.toLowerCase().includes(q));
  }, [lombaList, lombaSearch]);

  return (
    <>
      <div className="bg-[#FCE0E0] border border-[#FBE0E0] border-l-4 border-l-[#E11D1D] rounded p-3.5 mb-5 flex gap-3 items-start">
        <div className="w-8 h-8 rounded-full bg-[#E11D1D] text-white flex items-center justify-center flex-shrink-0 text-[13px]">
          <i className="fas fa-circle-info"></i>
        </div>
        <div className="text-[13px] text-[#9D1010] leading-relaxed">
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
            {/* v2: search bar above the dropdown. With 21+ lomba in prod
                the native <select> is hard to scroll through. Type-ahead
                filter narrows the options. */}
            <div className="relative mb-2">
              <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-sm pointer-events-none"></i>
              <input
                type="text"
                value={lombaSearch}
                onChange={(e) => setLombaSearch(e.target.value)}
                placeholder="Cari nama lomba..."
                className="w-full pl-10 pr-10 py-2 border border-[#E5E7EB] rounded-lg text-sm bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-colors"
              />
              {lombaSearch && (
                <button
                  type="button"
                  onClick={() => setLombaSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#6B7280] flex items-center justify-center"
                  aria-label="Bersihkan pencarian"
                >
                  <i className="fas fa-xmark text-[12px]"></i>
                </button>
              )}
            </div>
            <select
              value={lombaId ?? ""}
              onChange={(e) => changeLombaId(Number(e.target.value))}
              className="input"
              size={Math.min(8, Math.max(3, filteredLombaList.length))}
            >
              {filteredLombaList.length === 0 ? (
                <option disabled value="">Tidak ada lomba yang cocok</option>
              ) : (
                filteredLombaList.map((l) => (
                  <option key={l.id} value={l.id}>{l.emoji} {l.nama}</option>
                ))
              )}
            </select>
            {lombaSearch && (
              <div className="text-[11px] text-[#6B7280] mt-1.5">
                {filteredLombaList.length} dari {lombaList.length} lomba cocok dengan "{lombaSearch}"
              </div>
            )}
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
            <div className="bg-[#FCE0E0] border border-[#FBE0E0] rounded p-3 flex items-start gap-2">
              <i className="fas fa-circle-info text-[#9D1010] mt-0.5"></i>
              <div className="text-[12px] text-[#9D1010]">
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
