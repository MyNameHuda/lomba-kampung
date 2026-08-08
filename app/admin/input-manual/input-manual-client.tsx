"use client";

import { useState, useEffect, useMemo, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useNotify } from "@/components/notify-provider";
import { getInitials } from "@/lib/format";
import { SUMBER } from "@/lib/constants";
import type { PesertaSlim } from "@/lib/types";

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
  urutan?: number;
  icon?: string;
  colorBg?: string;
  colorText?: string;
  colorBorder?: string;
};

// Server-provided rows (already slimmed in page.tsx).
type PesertaRow = PesertaSlim & { sumber: "publik" | "manual"; createdAt: number };

// v2: collapse k_anak_l + k_anak_p into a single "Anak" picker option
// when both are eligible, matching the public daftar-form pattern. The
// "Laki-laki" / "Perempuan" button below (Jenis Kelamin) determines
// which sub-kategori is saved. Admin already knows the gender of the
// warga they're inputting, so no need to ask twice.
const VIRTUAL_ANAK_ID = "_anak_virtual";

// Display collapse for k_anak_l + k_anak_p — used in the lomba picker
// so admin sees one "Anak" group instead of two near-duplicates. The
// underlying k_anak_l / k_anak_p ids still pass through to the DB.
const ANAK_COLLAPSED_ID = "_anak_collapsed";
const displayKatId = (id: string) =>
  id === "k_anak_l" || id === "k_anak_p" ? ANAK_COLLAPSED_ID : id;
const displayKatName = (id: string, kats: Kat[]) => {
  if (id === ANAK_COLLAPSED_ID) return "Anak";
  return kats.find((k) => k.id === id)?.nama ?? id;
};

const SORT_BY_NAME_ASC = (a: { nama: string }, b: { nama: string }) =>
  a.nama.localeCompare(b.nama, "id", { sensitivity: "base" });

// v5: sort by umur ASC, with nama as tiebreaker so the order is
// deterministic when two peserta share the same age.
const SORT_BY_UMUR_ASC = (a: { umur: number; nama: string }, b: { umur: number; nama: string }) =>
  a.umur - b.umur || SORT_BY_NAME_ASC(a, b);

// =================== Group styling (v2 picker) ===================
// Each picker group gets a distinct pastel tint + icon so the kategori
// separator is visually obvious. Hardcoded here (not from DB) because
// the DB kategori colors are tuned for tag/badge use, not large
// surface tints (e.g. k_anak_l has saturated primary red bg which is
// too loud for a 5-lomba list container).
type LombaGroup = {
  key: string;
  displayName: string;
  icon: string;
  bgColor: string;      // pastel bg for group container
  borderColor: string;  // matching border
  textColor: string;    // used in header text + icon
  lomba: Lomba[];
};

const GROUP_STYLE: Record<string, { icon: string; bgColor: string; borderColor: string; textColor: string }> = {
  k_balita:        { icon: "fa-baby",          bgColor: "#FDF2F8", borderColor: "#FBCFE8", textColor: "#9D174D" }, // soft pink
  [ANAK_COLLAPSED_ID]: { icon: "fa-child",     bgColor: "#EFF6FF", borderColor: "#BFDBFE", textColor: "#1E40AF" }, // soft blue
  k_dewasa_p:      { icon: "fa-person-dress",  bgColor: "#FFFBEB", borderColor: "#FDE68A", textColor: "#92400E" }, // soft amber
  k_remaja:        { icon: "fa-user",          bgColor: "#F3F4F6", borderColor: "#D1D5DB", textColor: "#374151" }, // soft gray
  _uncategorized:  { icon: "fa-folder-open",   bgColor: "#F9FAFB", borderColor: "#E5E7EB", textColor: "#6B7280" },
};

const GROUP_STYLE_FALLBACK = { icon: "fa-folder-open", bgColor: "#F3F4F6", borderColor: "#E5E7EB", textColor: "#6B7280" };

function makeLombaGroup(key: string, displayName: string, kats: Kat[], lomba: Lomba[] = []): LombaGroup {
  const style = GROUP_STYLE[key] ?? GROUP_STYLE_FALLBACK;
  return { key, displayName, lomba, ...style };
}

// Server-side "eligible source" row — used by the Salin dari Lomba
// Lain card on the right side. Pre-built on the server to avoid
// re-deriving kategori overlap on every client render.
type SourceLomba = {
  id: number;
  nama: string;
  emoji: string;
  count: number;
  sharedKategori: string[];
};

export default function InputManualClient({
  lombaList,
  kats,
  pesertaByLomba,
  sourceByLomba,
}: {
  lombaList: Lomba[];
  kats: Kat[];
  pesertaByLomba: Record<number, PesertaRow[]>;
  sourceByLomba: Record<number, SourceLomba[]>;
}) {
  const router = useRouter();
  const notify = useNotify();
  const [lombaId, setLombaId] = useState<number | null>(
    lombaList.find((l) => l.status === "aktif")?.id || lombaList[0]?.id || null
  );
  const [nama, setNama] = useState("");
  const [jenisKelamin, setJenisKelamin] = useState<"L" | "P">("L");
  const [kategoriId, setKategoriId] = useState<string>("");
  const [umur, setUmur] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // v3: filter chip state. "all" shows every lomba; otherwise we show
  // only lomba whose kategoriEligible contains the chip's kategoriId
  // (with k_anak_l + k_anak_p collapsed into one "Anak" chip).
  const [selectedKategori, setSelectedKategori] = useState<string>("all");

  // v3: dropdown state for the picker. Only one group open at a time.
  // null = all groups collapsed. Keyed by LombaGroup.key.
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // When the filter chip narrows to a single kategori, force-open
  // that group so admin doesn't have to click an already-isolated
  // card. When chip is "all", reset to closed (default view).
  useEffect(() => {
    if (selectedKategori === "all") {
      setOpenGroup(null);
    } else {
      setOpenGroup(selectedKategori);
    }
  }, [selectedKategori]);

  // Local peserta list — mirrors server prop, allows optimistic updates
  // after edit/delete without a full router.refresh.
  const [pesertaList, setPesertaList] = useState<PesertaRow[]>([]);
  const [editingPeserta, setEditingPeserta] = useState<PesertaRow | null>(null);

  // v4: copy-from-other-lomba state. `copySource` is the source lomba
  // the admin picked from the picker (null = no modal open). The
  // confirm modal opens as soon as a source is picked; closing it
  // resets the state.
  const [copySource, setCopySource] = useState<SourceLomba | null>(null);
  const [copying, setCopying] = useState(false);

  // v5: peserta list sort mode. "nama" = A-Z by name, "umur" = by age
  // ascending then by nama as tiebreaker. Toggled from a button group
  // in the Daftar Peserta card header.
  const [sortMode, setSortMode] = useState<"nama" | "umur">("nama");

  // Derive selected lomba + eligible kats from the master list
  const selectedLomba = useMemo(
    () => lombaList.find((l) => l.id === lombaId) || null,
    [lombaId, lombaList]
  );

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
      const sample = baseKats.find((k) => k.id === "k_anak_l")!;
      return [
        ...baseKats.filter((k) => k.id !== "k_anak_l" && k.id !== "k_anak_p"),
        { ...sample, id: VIRTUAL_ANAK_ID, nama: "Anak" },
      ];
    }
    return baseKats;
  }, [selectedLomba, kats]);

  const selectedKat = useMemo(
    () => eligibleKats.find((k) => k.id === kategoriId) || null,
    [eligibleKats, kategoriId]
  );
  const skipUmur = selectedKat?.autoAge ?? false;

  // v3: When lombaId changes, derive kategoriId + umur from the new
  // eligibleKats. Declared with ONLY [lombaId] dep so it only runs
  // when the user picks a new lomba (not on every eligibleKats/
  // kategoriId/umur change, which would cause race conditions with
  // the manual setKategoriId calls inside changeLombaId).
  useEffect(() => {
    if (eligibleKats.length === 0) {
      setKategoriId("");
      setUmur(null);
      return;
    }
    const first = eligibleKats[0];
    setKategoriId(first.id);
    setUmur(first.autoAge ? first.min : null);
  }, [lombaId]);

  // Sync local peserta list whenever the selected lomba or server prop changes
  useEffect(() => {
    if (!lombaId) {
      setPesertaList([]);
      return;
    }
    setPesertaList(pesertaByLomba[lombaId] || []);
  }, [lombaId, pesertaByLomba]);

  function changeLombaId(newId: number) {
    setLombaId(newId);
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

  // v3: toggle a picker group's open state. Only one group open at a
  // time — opening a new one auto-closes the previously open one.
  // Clicking the currently-open group collapses it.
  function toggleGroup(key: string) {
    setOpenGroup((curr) => (curr === key ? null : key));
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
          ? jenisKelamin === "L"
            ? "k_anak_l"
            : "k_anak_p"
          : kategoriId;
      // v2: manual input is always treated as auto-hadir. Admin is at
      // the balai physically filling in the form — they have visual
      // confirmation that the warga is in front of them. No more
      // "Tandai sebagai Hadir" checkbox.
      const res = await fetch("/api/admin/pendaftar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: nama.trim(),
          jenisKelamin,
          kategoriId: realKategoriId,
          umur: umur ?? selectedKat?.min ?? 0,
          lombaId,
          hadir: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal");
      notify.success(`Berhasil! Nomor: ${data.nomor}`);
      setNama("");
      // Keep lomba, jenisKelamin, kategoriId, umur as-is so admin can do rapid input.
      setTimeout(() => router.refresh(), 500);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setSubmitting(false);
    }
  }

  const eligibleAges =
    selectedKat && !skipUmur
      ? Array.from({ length: selectedKat.max - selectedKat.min + 1 }, (_, i) => selectedKat.min + i)
      : [];

  // ============ Lomba picker (v4: grouped by kategori, no search) ============
  //
  // - When selectedKategori === "all", show all lomba grouped by their
  //   primary eligible kategori, each section sorted A-Z.
  // - When selectedKategori is a specific kategori, show only lomba
  //   whose kategoriEligible contains that kategori, flat A-Z sorted.
  //
  // k_anak_l + k_anak_p are collapsed into a single "Anak" group for
  // display (consistent with the form picker behavior). Each group
  // carries its own pastel tint + icon so the separator is visually
  // obvious — admin can scan kategori at a glance without reading text.
  const lombaByKategori = useMemo(() => {
    const sorted = [...lombaList].sort(SORT_BY_NAME_ASC);
    const map = new Map<string, LombaGroup>();
    for (const l of sorted) {
      const raw = l.kategoriEligible[0];
      if (!raw) {
        // Lomba with no kategori — bucket into a synthetic "Lainnya" group
        if (!map.has("_uncategorized")) {
          map.set("_uncategorized", makeLombaGroup("_uncategorized", "Lainnya", kats));
        }
        map.get("_uncategorized")!.lomba.push(l);
        continue;
      }
      const groupKey = displayKatId(raw);
      if (!map.has(groupKey)) {
        map.set(groupKey, makeLombaGroup(groupKey, displayKatName(groupKey, kats), kats));
      }
      map.get(groupKey)!.lomba.push(l);
    }
    // Sort groups: known kategori first by urutan, then by displayName, then "Lainnya" last
    const urutanById = new Map(kats.map((k) => [k.id, k.urutan]));
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "_uncategorized") return 1;
      if (b === "_uncategorized") return -1;
      // If a or b is the collapsed Anak group, slot it after the canonical k_balita
      const aOrder = a === ANAK_COLLAPSED_ID ? 2 : urutanById.get(a) ?? 99;
      const bOrder = b === ANAK_COLLAPSED_ID ? 2 : urutanById.get(b) ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.localeCompare(b, "id");
    }).map(([, g]) => g);
  }, [lombaList, kats]);

  // Which chip categories are actually present in lombaList?
  // Used to only show chips for kategori that have at least one lomba.
  const availableKategori = useMemo(() => {
    const seen = new Set<string>();
    for (const l of lombaList) {
      for (const k of l.kategoriEligible) {
        seen.add(displayKatId(k));
      }
    }
    return Array.from(seen);
  }, [lombaList]);

  // The final list of lomba shown in the picker (after filter chip).
  // When "all" → return the grouped structure. When filtered → single group.
  const filteredLombaGroups = useMemo(() => {
    if (selectedKategori === "all") return lombaByKategori;
    const sorted = lombaList
      .filter((l) =>
        l.kategoriEligible.some((k) => displayKatId(k) === selectedKategori)
      )
      .sort(SORT_BY_NAME_ASC);
    return [makeLombaGroup(selectedKategori, displayKatName(selectedKategori, kats), kats, sorted)];
  }, [lombaByKategori, selectedKategori, lombaList, kats]);

  // ============ CRUD handlers ============
  async function deletePeserta(p: PesertaRow) {
    const ok = await notify.confirm({
      title: "Hapus Peserta",
      message: `Hapus peserta "${p.nama}" (${p.nomor})?\n\nTindakan ini tidak bisa dibatalkan.`,
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/pendaftar/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Gagal");
      }
      setPesertaList((prev) => prev.filter((it) => it.id !== p.id));
      notify.success(`Peserta "${p.nama}" berhasil dihapus`);
      // Light refresh so counts on the admin card stay in sync.
      setTimeout(() => router.refresh(), 500);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Gagal hapus peserta");
    }
  }

  function applyEdit(updated: PesertaRow) {
    setPesertaList((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    setEditingPeserta(null);
    notify.success("Peserta berhasil diperbarui");
    setTimeout(() => router.refresh(), 500);
  }

  // v4: copy peserta from another lomba (in same kategori) into the
  // current selected lomba. Server dedups by nama (case-insensitive +
  // trim) and skips pendaftar whose kategoriId is not eligible in
  // the target. UI gets a single summary toast on completion.
  async function runCopy() {
    if (!copySource || !selectedLomba) return;
    setCopying(true);
    try {
      const res = await fetch(`/api/admin/lomba/${selectedLomba.id}/copy-from`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceLombaId: copySource.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Gagal");
      const parts: string[] = [];
      if (j.copied > 0) parts.push(`✅ ${j.copied} peserta disalin`);
      if (j.skippedDuplicate > 0) parts.push(`⏭️ ${j.skippedDuplicate} duplikat dilewati`);
      if (j.skippedKategori > 0) parts.push(`🚫 ${j.skippedKategori} kategori tidak cocok`);
      if (parts.length === 0) parts.push("Tidak ada yang disalin (semua peserta sudah ada)");
      notify.success(parts.join(" · "));
      setCopySource(null);
      // Refresh server data so the new peserta show up. The page
      // re-renders with the new pesertaByLomba; the useEffect syncs
      // pesertaList from there.
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Gagal menyalin");
    } finally {
      setCopying(false);
    }
  }

  const totalPesertaForLomba = selectedLomba ? pesertaList.length : 0;

  return (
    <>
      {/* ============ Header callout ============ */}
      <div className="bg-[#FCE0E0] border border-[#FBE0E0] border-l-4 border-l-[#E11D1D] rounded p-3.5 mb-5 flex gap-3 items-start">
        <div className="w-8 h-8 rounded-full bg-[#E11D1D] text-white flex items-center justify-center flex-shrink-0 text-[13px]">
          <i className="fas fa-circle-info"></i>
        </div>
        <div className="text-[13px] text-[#9D1010] leading-relaxed">
          <strong className="block mb-1">Kapan pakai fitur ini?</strong>
          Untuk warga yang tidak bisa mendaftar sendiri (gaptek, tidak punya HP, atau datang langsung ke balai).
          Peserta otomatis <strong>Disetujui</strong> dan dianggap <strong>Hadir</strong> tanpa review admin.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* ============ LEFT: form card ============ */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-6">
            <h3 className="text-base font-bold mb-1">📝 Data Peserta</h3>
            <div className="text-xs text-[#6B7280] mb-5">
              Semua field bertanda <span className="text-primary">*</span> wajib diisi
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Pilih Lomba <span className="text-primary">*</span></label>
                <KategoriChips
                  available={availableKategori}
                  kats={kats}
                  current={selectedKategori}
                  onSelect={setSelectedKategori}
                />
                <LombaPicker
                  groups={filteredLombaGroups}
                  selectedId={lombaId}
                  onSelect={changeLombaId}
                  allCount={lombaList.length}
                  currentKategori={selectedKategori}
                  openGroup={openGroup}
                  onToggleGroup={toggleGroup}
                />
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
                    <div
                      className="radio-group"
                      style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}
                    >
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

              {/* v2: removed "Tandai sebagai Hadir" checkbox — manual input
                  is always treated as auto-hadir (admin is physically at
                  the balai, warga is in front of them). */}

              <div className="flex gap-2 pt-5 mt-6 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  className="btn btn-secondary flex-1"
                  onClick={() => {
                    setNama("");
                    setUmur(skipUmur && selectedKat ? selectedKat.min : null);
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary flex-1 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Menyimpan...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save"></i> Simpan & Setujui
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ============ RIGHT: peserta CRUD list ============ */}
        <div className="lg:col-span-3 space-y-5">
          {/* Selected-lomba header */}
          {selectedLomba ? (
            <div
              className="card overflow-hidden"
              style={{ background: "linear-gradient(135deg, #E11D1D 0%, #9D1010 100%)", color: "white", border: "none" }}
            >
              <div className="p-4 flex items-center gap-3">
                <div className="text-4xl leading-none">{selectedLomba.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-extrabold truncate">{selectedLomba.nama}</div>
                  <div className="text-[12px] opacity-90 mt-0.5">
                    <i className="fas fa-users"></i> {totalPesertaForLomba} peserta terdaftar
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-6 text-center text-[#6B7280]">
              <i className="fas fa-trophy text-3xl text-[#D1D5DB] block mb-2"></i>
              Pilih lomba untuk melihat daftar peserta.
            </div>
          )}

          {/* ============ Copy from other lomba ============ */}
          {selectedLomba && (sourceByLomba[selectedLomba.id] || []).length > 0 && (
            <CopyFromLombaCard
              sources={sourceByLomba[selectedLomba.id] || []}
              targetLomba={selectedLomba}
              kats={kats}
              onPickSource={(src) => setCopySource(src)}
            />
          )}

          {/* CRUD list (replaces "Input Manual Terbaru") */}
          {selectedLomba && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-bold text-sm">Daftar Peserta</div>
                  <div className="text-xs text-[#6B7280] mt-0.5">
                    {totalPesertaForLomba} peserta · publik & manual
                  </div>
                </div>
                {/* v5: sort toggle — Nama A-Z vs Umur */}
                {pesertaList.length > 1 && (
                  <div className="inline-flex rounded-lg border border-[#E5E7EB] overflow-hidden bg-white">
                    <SortButton
                      active={sortMode === "nama"}
                      onClick={() => setSortMode("nama")}
                      icon="fa-arrow-down-a-z"
                      label="Nama A-Z"
                    />
                    <SortButton
                      active={sortMode === "umur"}
                      onClick={() => setSortMode("umur")}
                      icon="fa-arrow-down-1-9"
                      label="Umur"
                    />
                  </div>
                )}
              </div>
              {pesertaList.length === 0 ? (
                <div className="p-8 text-center text-[#6B7280]">
                  <i className="fas fa-user-slash text-3xl text-[#D1D5DB] block mb-2"></i>
                  Belum ada peserta untuk lomba ini.
                </div>
              ) : (
                <div className="divide-y divide-[#E5E7EB]">
                  {pesertaList
                    .slice()
                    .sort(sortMode === "nama" ? SORT_BY_NAME_ASC : SORT_BY_UMUR_ASC)
                    .map((p) => (
                      <PesertaRowItem
                        key={p.id}
                        p={p}
                        onEdit={() => setEditingPeserta(p)}
                        onDelete={() => deletePeserta(p)}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editingPeserta && selectedLomba && (
        <EditPesertaModal
          peserta={editingPeserta}
          eligibleKategori={selectedLomba.kategoriEligible.flatMap((kid) => {
            const k = kats.find((x) => x.id === kid);
            return k ? [{ id: k.id, nama: k.nama, min: k.min, max: k.max, autoAge: k.autoAge }] : [];
          })}
          onClose={() => setEditingPeserta(null)}
          onSaved={applyEdit}
        />
      )}

      {/* v4: Copy-from-other-lomba confirm modal */}
      {copySource && selectedLomba && (
        <CopyConfirmModal
          source={copySource}
          target={selectedLomba}
          targetExistingNames={new Set(pesertaList.map((p) => p.nama.trim().toLowerCase()))}
          kats={kats}
          copying={copying}
          onClose={() => !copying && setCopySource(null)}
          onConfirm={runCopy}
        />
      )}
    </>
  );
}

// =====================================================================
// Kategori filter chips — replaces the old search bar
// =====================================================================
function KategoriChips({
  available,
  kats,
  current,
  onSelect,
}: {
  available: string[];
  kats: Kat[];
  current: string;
  onSelect: (id: string) => void;
}) {
  if (available.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-2.5">
      <Chip
        active={current === "all"}
        onClick={() => onSelect("all")}
        icon="fa-layer-group"
        label="Semua"
      />
      {available.map((k) => {
        const name = displayKatName(k, kats);
        // Pick an icon per kategori (k_balita → fa-baby, k_anak → fa-child, k_dewasa → fa-user-tie)
        let icon = "fa-folder";
        if (k === "k_balita") icon = "fa-baby";
        else if (k === ANAK_COLLAPSED_ID) icon = "fa-child";
        else if (k === "k_dewasa_p") icon = "fa-user-tie";
        return (
          <Chip
            key={k}
            active={current === k}
            onClick={() => onSelect(k)}
            icon={icon}
            label={name}
          />
        );
      })}
    </div>
  );
}

function Chip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border-2 transition-all ${
        active
          ? "bg-primary border-primary text-white"
          : "bg-white border-[#E5E7EB] text-[#374151] hover:border-[#D1D5DB]"
      }`}
    >
      <i className={`fas ${icon} text-[10px]`}></i>
      <span>{label}</span>
    </button>
  );
}

// =====================================================================
// Sort toggle button (v5) — used in the Daftar Peserta card header
// =====================================================================
function SortButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
        active
          ? "bg-primary text-white"
          : "bg-white text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#1F2937]"
      }`}
    >
      <i className={`fas ${icon} text-[10px]`}></i>
      <span>{label}</span>
    </button>
  );
}

// =====================================================================
// Lomba picker (v3) — collapsible dropdown per kategori
// =====================================================================
// v3 behavior:
// - All groups are closed by default (openGroup === null).
// - Clicking a group header opens that group; clicking it again closes.
// - Only one group open at a time (auto-close on opening another).
// - When a filter chip narrows to a single kategori, that group is
//   force-opened (handled by useEffect in the parent).
//
// The header is a clickable band with kategori icon, name, count badge,
// and a rotating chevron. Lomba buttons only render when the group is
// open. Active lomba group also gets a primary-red border so admin
// can find their selection even if it's in a closed group (the right
// side red card shows the full lomba context too).
// =====================================================================
function LombaPicker({
  groups,
  selectedId,
  onSelect,
  allCount,
  currentKategori,
  openGroup,
  onToggleGroup,
}: {
  groups: LombaGroup[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  allCount: number;
  currentKategori: string;
  openGroup: string | null;
  onToggleGroup: (key: string) => void;
}) {
  if (allCount === 0) {
    return (
      <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-sm rounded p-3">
        <i className="fas fa-exclamation-triangle"></i> Belum ada lomba. Tambahkan lomba dulu.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {groups.map((group) => {
        const isOpen = openGroup === group.key;
        const hasActive = group.lomba.some((l) => l.id === selectedId);
        return (
          <div
            key={group.key}
            className="rounded-xl border-2 overflow-hidden transition-all"
            style={{
              background: group.bgColor,
              borderColor: hasActive ? "#E11D1D" : group.borderColor,
              borderWidth: hasActive ? 2 : 1.5,
            }}
          >
            {/* Clickable header — toggles this group's open state */}
            <button
              type="button"
              onClick={() => onToggleGroup(group.key)}
              aria-expanded={isOpen}
              className="w-full px-3 py-2 flex items-center gap-2 hover:brightness-95 transition-all text-left"
              style={{ borderBottom: isOpen ? `1px solid ${group.borderColor}` : "1px solid transparent" }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] flex-shrink-0"
                style={{ background: group.textColor, color: "white" }}
                aria-hidden="true"
              >
                <i className={`fas ${group.icon}`}></i>
              </span>
              <span
                className="text-[11px] font-extrabold uppercase tracking-wider truncate"
                style={{ color: group.textColor }}
              >
                {group.displayName}
              </span>
              <span
                className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 flex-shrink-0"
                style={{ background: "white", color: group.textColor, border: `1px solid ${group.borderColor}` }}
              >
                <i className="fas fa-trophy text-[9px]"></i>
                {group.lomba.length} lomba
              </span>
              <i
                className={`fas fa-chevron-down text-[10px] flex-shrink-0 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
                style={{ color: group.textColor }}
                aria-hidden="true"
              ></i>
            </button>
            {/* Body — only render when this group is the open one */}
            {isOpen && (
              <div className="p-1.5 space-y-1">
                {group.lomba.length === 0 ? (
                  <div className="text-center py-3 text-[11px] text-[#6B7280]">
                    Tidak ada lomba.
                  </div>
                ) : (
                  group.lomba.map((l) => {
                    const active = l.id === selectedId;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => onSelect(l.id)}
                        className={`w-full text-left p-2 rounded-lg border transition-all flex items-center gap-2.5 ${
                          active
                            ? "border-primary bg-white shadow-sm"
                            : "border-transparent bg-white/60 hover:bg-white hover:border-white"
                        }`}
                      >
                        <span className="text-xl leading-none flex-shrink-0">{l.emoji}</span>
                        <span
                          className={`flex-1 text-[13px] truncate ${
                            active ? "font-bold text-primary" : "font-semibold text-[#1F2937]"
                          }`}
                        >
                          {l.nama}
                        </span>
                        {l.status === "selesai" && (
                          <span className="text-[9px] bg-[#F3F4F6] text-[#6B7280] px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0">
                            Selesai
                          </span>
                        )}
                        {active && (
                          <i className="fas fa-circle-check text-primary text-xs flex-shrink-0"></i>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
      {currentKategori !== "all" && groups.every((g) => g.lomba.length === 0) && (
        <div className="text-center py-4 text-[#6B7280] text-sm">
          Tidak ada lomba untuk kategori ini.
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Copy-from-other-lomba card (v4)
// =====================================================================
// Shows a list of other lomba in the SAME kategori (with at least 1
// active peserta). Clicking a row opens the CopyConfirmModal. If no
// eligible sources exist for the current target lomba, the parent
// doesn't render this card at all.
// =====================================================================
function CopyFromLombaCard({
  sources,
  targetLomba,
  kats,
  onPickSource,
}: {
  sources: SourceLomba[];
  targetLomba: Lomba;
  kats: Kat[];
  onPickSource: (src: SourceLomba) => void;
}) {
  // Pre-compute display names for the shared kategori badges (so admin
  // can see why each source is eligible).
  const katName = (id: string) => {
    if (id === ANAK_COLLAPSED_ID) return "Anak";
    return kats.find((k) => k.id === id)?.nama ?? id;
  };
  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-bold text-sm flex items-center gap-2">
            <i className="fas fa-copy text-primary"></i>
            Salin Peserta dari Lomba Lain
          </div>
          <div className="text-xs text-[#6B7280] mt-0.5">
            Lomba lain dengan kategori yang sama · duplikat otomatis dilewati
          </div>
        </div>
      </div>
      <div className="divide-y divide-[#E5E7EB]">
        {sources.map((src) => (
          <button
            key={src.id}
            type="button"
            onClick={() => onPickSource(src)}
            className="w-full p-3 text-left flex items-center gap-3 hover:bg-[#F9FAFB] transition-colors"
          >
            <span className="text-2xl leading-none flex-shrink-0">{src.emoji}</span>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5 leading-snug">
              <div className="font-semibold text-[13px] truncate">{src.nama}</div>
              <div className="text-[11px] text-[#6B7280] flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 bg-[#F3F4F6] px-1.5 py-0.5 rounded text-[10px] font-bold text-[#374151]">
                  <i className="fas fa-users text-[9px]"></i> {src.count} peserta
                </span>
                {src.sharedKategori.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 bg-[#EFF6FF] text-[#1E40AF] px-1.5 py-0.5 rounded text-[10px] font-bold"
                  >
                    {katName(k)}
                  </span>
                ))}
              </div>
            </div>
            <i className="fas fa-chevron-right text-[#9CA3AF] text-xs flex-shrink-0"></i>
          </button>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// Copy confirm modal — shows dedup preview, then performs the copy
// =====================================================================
function CopyConfirmModal({
  source,
  target,
  targetExistingNames,
  kats,
  copying,
  onClose,
  onConfirm,
}: {
  source: SourceLomba;
  target: Lomba;
  targetExistingNames: Set<string>;
  kats: Kat[];
  copying: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  // Estimate the dedup outcome client-side for the preview. The server
  // re-computes the same dedup authoritatively — the counts may
  // differ if source lomba has kategori not eligible in target (which
  // the client doesn't know per-pendaftar). That's why we say "±" in
  // the modal and rely on the server response for the final counts.
  //
  // We do know the source count from the picker. The exact
  // per-pendaftar names are not pre-loaded, so we just show the total
  // and an optimistic "akan disalin" estimate. Server handles real
  // dedup.
  const willCopy = source.count; // optimistic
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-[440px] w-full overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <i className="fas fa-copy text-primary"></i>
              Salin Peserta
            </h3>
            <div className="text-[11px] text-[#6B7280] mt-0.5">
              Dari <strong>{source.emoji} {source.nama}</strong> ke <strong>{target.emoji} {target.nama}</strong>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={copying}
            className="w-8 h-8 rounded-full bg-[#F9FAFB] text-[#6B7280] flex items-center justify-center hover:bg-[#E5E7EB] disabled:opacity-50"
          >
            <i className="fas fa-xmark"></i>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg p-3.5 text-[13px] text-[#075985] flex items-start gap-2.5">
            <i className="fas fa-circle-info text-[#0284C7] mt-0.5"></i>
            <div className="leading-relaxed">
              <strong>{source.count} peserta</strong> akan disalin dari lomba sumber.
              Peserta dengan nama yang sudah ada di lomba target (tanpa
              membedakan huruf besar/kecil) akan otomatis dilewati.
            </div>
          </div>
          <div className="space-y-2">
            <SummaryRow icon="fa-copy" color="#E11D1D" label="Akan disalin" value={`~${willCopy} peserta`} />
            <SummaryRow icon="fa-user-plus" color="#15803D" label="Status setelah salin" value="Disetujui + Hadir (sumber: manual)" />
            <SummaryRow icon="fa-shield-halved" color="#1E40AF" label="Duplikat" value="Otomatis dilewati" />
          </div>
          <div className="text-[11px] text-[#6B7280] leading-relaxed">
            <i className="fas fa-lightbulb text-[#EAB308]"></i>{" "}
            Peserta yang sudah ada di lomba target tidak akan ditimpa
            atau di-update. Hanya baris baru yang ditambahkan.
          </div>
        </div>
        <div className="p-4 bg-[#F9FAFB] flex gap-2 border-t border-[#E5E7EB]">
          <button
            onClick={onClose}
            disabled={copying}
            className="btn btn-secondary flex-1 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={copying}
            className="btn btn-primary flex-1 disabled:opacity-60"
          >
            {copying ? (
              <><i className="fas fa-spinner fa-spin"></i> Menyalin...</>
            ) : (
              <><i className="fas fa-copy"></i> Salin Sekarang</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ icon, color, label, value }: { icon: string; color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[12px]">
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
        style={{ background: color, color: "white" }}
      >
        <i className={`fas ${icon}`}></i>
      </span>
      <span className="text-[#6B7280]">{label}:</span>
      <span className="font-bold text-[#1F2937]">{value}</span>
    </div>
  );
}

// =====================================================================
// Per-row peserta card in the CRUD list
// =====================================================================
function PesertaRowItem({
  p,
  onEdit,
  onDelete,
}: {
  p: PesertaRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const initials = getInitials(p.nama);
  const sumberInfo = SUMBER[p.sumber];
  return (
    <div className="p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5 leading-snug">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-[13px] truncate">{p.nama}</span>
          <span className="text-[10px] text-[#6B7280] font-mono">{p.nomor.replace(/^LMB-/, "")}</span>
        </div>
        <div className="text-[11px] text-[#6B7280] flex items-center gap-1.5 flex-wrap">
          <span className="bg-[#F3F4F6] px-1.5 py-0.5 rounded text-[10px] font-bold">
            {p.umur} th
          </span>
          <span className="text-[#D1D5DB]">·</span>
          <span>{p.jenisKelamin === "L" ? "Laki-laki" : "Perempuan"}</span>
          <span className="text-[#D1D5DB]">·</span>
          <span>{p.kategori}</span>
          {p.noWa && (
            <>
              <span className="text-[#D1D5DB]">·</span>
              <span>📞 {p.noWa}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {p.sumber === "manual" && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1 bg-[#FCE0E0] text-[#9D1010]"
            title="Diinput manual oleh admin"
          >
            <i className={`fas ${sumberInfo.icon} text-[9px]`}></i> {sumberInfo.label}
          </span>
        )}
        {p.hadir && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1 bg-[#DCFCE7] text-[#15803D]">
            <i className="fas fa-check text-[9px]"></i> Hadir
          </span>
        )}
        <button
          onClick={onEdit}
          className="icon-action"
          title="Edit peserta"
        >
          <i className="fas fa-pen"></i>
        </button>
        <button
          onClick={onDelete}
          className="icon-action reject"
          title="Hapus peserta"
        >
          <i className="fas fa-trash"></i>
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// Edit modal — used for CRUD update
// =====================================================================
function EditPesertaModal({
  peserta,
  eligibleKategori,
  onClose,
  onSaved,
}: {
  peserta: PesertaRow;
  eligibleKategori: Array<{ id: string; nama: string; min: number; max: number; autoAge: boolean }>;
  onClose: () => void;
  onSaved: (updated: PesertaRow) => void;
}) {
  const [nama, setNama] = useState(peserta.nama);
  const [noWa, setNoWa] = useState(peserta.noWa || "");
  const [umur, setUmur] = useState<number>(peserta.umur);
  const [jenisKelamin, setJenisKelamin] = useState<"L" | "P">(peserta.jenisKelamin);
  const [kategoriId, setKategoriId] = useState(peserta.kategoriId);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

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
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-[480px] w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">Edit Peserta</h3>
            <div className="text-[11px] text-[#6B7280] font-mono mt-0.5">{peserta.nomor}</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F9FAFB] text-[#6B7280] flex items-center justify-center hover:bg-[#E5E7EB]"
          >
            <i className="fas fa-xmark"></i>
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-3.5">
          <div>
            <label className="label">Nama <span className="text-primary">*</span></label>
            <input
              className="input"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">
              No WhatsApp{" "}
              <span className="text-[10px] text-[#6B7280] font-normal">(opsional)</span>
            </label>
            <input
              className="input"
              value={noWa}
              onChange={(e) => setNoWa(e.target.value)}
              placeholder="0812-..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Umur <span className="text-primary">*</span></label>
              <input
                type="number"
                className="input"
                min={1}
                max={120}
                value={umur}
                onChange={(e) => setUmur(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Jenis Kelamin <span className="text-primary">*</span></label>
              <select
                className="input"
                value={jenisKelamin}
                onChange={(e) => setJenisKelamin(e.target.value as "L" | "P")}
              >
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Kategori <span className="text-primary">*</span></label>
            <select
              className="input"
              value={kategoriId}
              onChange={(e) => setKategoriId(e.target.value)}
            >
              {eligibleKategori.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama} ({k.min}-{k.max} th)
                </option>
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
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Batal
          </button>
          <button onClick={save} disabled={saving} className="btn btn-primary flex-1 disabled:opacity-60">
            {saving ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Menyimpan...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i> Simpan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
