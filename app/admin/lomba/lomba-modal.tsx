"use client";

import { useMemo, useState } from "react";
import { APP_CONFIG } from "@/lib/constants";
import { dateStrToTs, tsToUtcDateStr, publicKategoriName } from "@/lib/format";
import type { Pj, PjInput, KategoriSlim as Kat } from "@/lib/types";

// Jadwal entry — per-kategori execution date + optional jam.
export type JadwalInput = {
  kategoriId: string;
  tanggal: number | null; // unix seconds, start of day
  jam: string | null;     // "HH:MM" or null
};

// Form-side lomba shape — omits pjByKategori (we use pjList at the API layer)
// and other DB-only fields. Kept local since the modal has its own needs.
export type LombaFormData = {
  id?: number;
  nama: string;
  emoji: string;
  deskripsi: string | null;
  syarat: string[];
  kategoriEligible: string[];
  status: "draft" | "aktif" | "selesai";
  urutan: number;
  // Stage system v3 — kualifikasi config. How many finalists per kategori
  // advance from kualifikasi to final (range 1-50, default 5).
  finalisCount: number;
  // Public registration toggle. Independent of `status` (lomba lifecycle).
  // Admin can close this while keeping lomba visible (e.g. for kualifikasi
  // phase). Admin input-manual always works regardless.
  pendaftaranDibuka: boolean;
  // Per-kategori jadwal (loaded from editing.jadwalByKategori, sent back as
  // jadwalList on save). Server-side this lives in `lomba_jadwal` table.
  jadwalByKategori?: Record<string, JadwalInput>;
};

const EMOJI_OPTIONS = ["🏆", "🍪", "🏃", "🪢", "🌴", "💧", "🎤", "🪑", "🥚", "🎯", "🏐", "🎲", "🎨", "🎭", "📚", "🚌"];

const EMPTY_LOMBA: Omit<LombaFormData, "id"> = {
  nama: "",
  emoji: "🏆",
  deskripsi: "",
  syarat: [],
  kategoriEligible: [],
  status: "aktif",
  urutan: 0,
  finalisCount: 5,
  pendaftaranDibuka: true,
};

const MAX_PJ_PER_KAT = APP_CONFIG.MAX_PJ_PER_KAT;

export default function LombaModal({
  editing,
  kats,
  nextUrutan,
  onClose,
  onSave,
}: {
  editing: { id: number; pjByKategori: Record<string, Pj[]>; jadwalByKategori?: Record<string, JadwalInput> } & LombaFormData | null;
  kats: Kat[];
  nextUrutan: number;
  onClose: () => void;
  onSave: (data: LombaFormData & { pjList: PjInput[]; jadwalList: JadwalInput[] }) => void;
}) {
  const [nama, setNama] = useState(editing?.nama || "");
  const [emoji, setEmoji] = useState(editing?.emoji || "🏆");
  const [deskripsi, setDeskripsi] = useState(editing?.deskripsi || "");
  const [syarat, setSyarat] = useState((editing?.syarat || []).join("\n"));
  const [kategoriEligible, setKategoriEligible] = useState<string[]>(editing?.kategoriEligible || []);
  // pjByKategori: per-kategori ARRAY of PJs.
  // Initialize from editing data (already array per the new shape) or empty.
  const [pjByKategori, setPjByKategori] = useState<Record<string, Pj[]>>(() => {
    if (!editing?.pjByKategori) return {};
    // Normalize: server already returns arrays, but be defensive for legacy shapes.
    const out: Record<string, Pj[]> = {};
    for (const [katId, val] of Object.entries(editing.pjByKategori)) {
      if (Array.isArray(val)) {
        out[katId] = val.filter((p) => p && typeof p.nama === "string");
      } else if (val && typeof val === "object" && "nama" in val) {
        // Legacy: single PJ object — wrap in array
        out[katId] = [{ nama: (val as Pj).nama, kontak: (val as Pj).kontak }];
      }
    }
    return out;
  });
  const [status, setStatus] = useState<LombaFormData["status"]>(editing?.status || "aktif");
  const [urutan, setUrutan] = useState(editing?.urutan ?? nextUrutan);
  const [finalisCount, setFinalisCount] = useState<number>(editing?.finalisCount ?? 5);
  const [pendaftaranDibuka, setPendaftaranDibuka] = useState<boolean>(editing?.pendaftaranDibuka ?? true);
  // Per-kategori jadwal (tanggal + jam). Empty Record = no jadwal set.
  const [jadwalByKategori, setJadwalByKategori] = useState<Record<string, JadwalInput>>(() => {
    if (!editing?.jadwalByKategori) return {};
    const out: Record<string, JadwalInput> = {};
    for (const [k, v] of Object.entries(editing.jadwalByKategori)) {
      if (v && (v.tanggal !== null || v.jam !== null)) {
        out[k] = { kategoriId: k, tanggal: v.tanggal ?? null, jam: v.jam ?? null };
      }
    }
    return out;
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function toggleKat(id: string) {
    setKategoriEligible((prev) => {
      if (prev.includes(id)) {
        // Removing — also remove pj list + jadwal for this kategori
        setPjByKategori((p) => {
          const { [id]: _, ...rest } = p;
          return rest;
        });
        setJadwalByKategori((j) => {
          const { [id]: _, ...rest } = j;
          return rest;
        });
        return prev.filter((x) => x !== id);
      } else {
        // Adding — pre-fill with 1 empty PJ
        setPjByKategori((p) => ({ ...p, [id]: [{ nama: "", kontak: null }] }));
        return [...prev, id];
      }
    });
  }

  // Group eligible kategori by public name so k_anak_l + k_anak_p collapse
  // into a single "Anak" PJ/jadwal block (matches the public detail-page
  // pattern and the admin card view). The list in `kategoriEligible` is
  // still per-katId (DB-level), so ops below broadcast to every katId in
  // the group to keep pjByKategori + jadwalByKategori in sync.
  type KatGroup = { publicName: string; katIds: string[]; sampleKat?: Kat };
  const groups: KatGroup[] = useMemo(() => {
    const seen = new Map<string, KatGroup>();
    const ordered: KatGroup[] = [];
    for (const katId of kategoriEligible) {
      const publicName = publicKategoriName(katId);
      let g = seen.get(publicName);
      if (!g) {
        g = { publicName, katIds: [katId], sampleKat: kats.find((k) => k.id === katId) };
        seen.set(publicName, g);
        ordered.push(g);
      } else {
        g.katIds.push(katId);
      }
    }
    return ordered;
  }, [kategoriEligible, kats]);

  // Broadcast helpers — apply the same op to every katId in the group so
  // pjByKategori[k_anak_l] and pjByKategori[k_anak_p] stay in lockstep.
  function addPjForGroup(katIds: string[]) {
    setPjByKategori((prev) => {
      const next = { ...prev };
      for (const katId of katIds) {
        const list = next[katId] || [];
        if (list.length >= MAX_PJ_PER_KAT) continue;
        next[katId] = [...list, { nama: "", kontak: null }];
      }
      return next;
    });
  }

  function removePjForGroup(katIds: string[], index: number) {
    setPjByKategori((prev) => {
      // Never let a kategori drop to 0 — check all kats in the group
      const canRemove = katIds.every((kid) => (prev[kid] || []).length > 1);
      if (!canRemove) return prev;
      const next = { ...prev };
      for (const katId of katIds) {
        next[katId] = (next[katId] || []).filter((_, i) => i !== index);
      }
      return next;
    });
  }

  function setPjForGroup(katIds: string[], index: number, field: "nama" | "kontak", value: string) {
    setPjByKategori((prev) => {
      const next = { ...prev };
      for (const katId of katIds) {
        const list = next[katId] || [];
        next[katId] = list.map((p, i) =>
          i === index
            ? {
                nama: field === "nama" ? value : p.nama,
                kontak: field === "kontak" ? (value.trim() || null) : p.kontak,
              }
            : p
        );
      }
      return next;
    });
  }

  function setJadwalForGroup(katIds: string[], field: "tanggal" | "jam", value: string | null) {
    setJadwalByKategori((prev) => {
      const next = { ...prev };
      for (const katId of katIds) {
        const cur = next[katId] || { kategoriId: katId, tanggal: null, jam: null };
        const j: JadwalInput = { ...cur, kategoriId: katId };
        if (field === "tanggal") {
          j.tanggal = value ? dateStrToTs(value) : null;
        } else {
          j.jam = value || null;
        }
        if (j.tanggal === null && j.jam === null) {
          delete next[katId];
        } else {
          next[katId] = j;
        }
      }
      return next;
    });
  }

  async function submit() {
    setErr("");
    if (!nama.trim()) { setErr("Nama lomba wajib diisi"); return; }
    if (kategoriEligible.length === 0) { setErr("Pilih minimal 1 kategori"); return; }
    if (finalisCount < 1 || finalisCount > 50) {
      setErr("Finalis per kategori harus 1-50"); return;
    }
    // Validate: each eligible kategori has ≥1 PJ with non-empty nama.
    // Use publicKategoriName so collapsed "Anak" groups show one error
    // (not separate ones for L and P).
    for (const katId of kategoriEligible) {
      const list = pjByKategori[katId] || [];
      const name = publicKategoriName(katId);
      if (list.length === 0) {
        setErr(`Kategori "${name}" minimal 1 PJ`); return;
      }
      for (const pj of list) {
        if (!pj.nama.trim()) {
          setErr(`Semua nama PJ di kategori "${name}" wajib diisi`); return;
        }
      }
    }
    setSaving(true);
    try {
      // Flatten: each PJ row becomes one PjInput entry
      const pjList: PjInput[] = [];
      for (const katId of kategoriEligible) {
        for (const pj of pjByKategori[katId] || []) {
          pjList.push({
            kategoriId: katId,
            pjNama: pj.nama.trim(),
            pjKontak: pj.kontak || null,
          });
        }
      }
      // Build jadwalList — only kategori with a date or jam set
      const jadwalList: JadwalInput[] = [];
      for (const katId of kategoriEligible) {
        const j = jadwalByKategori[katId];
        if (j && (j.tanggal !== null || j.jam !== null)) {
          jadwalList.push(j);
        }
      }
      await onSave({
        id: editing?.id,
        nama: nama.trim(),
        emoji,
        deskripsi: deskripsi.trim() || null,
        syarat: syarat.split("\n").map((s) => s.trim()).filter(Boolean),
        kategoriEligible,
        pjList,
        jadwalList,
        status,
        urutan,
        finalisCount,
        pendaftaranDibuka,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-[600px] w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-base font-bold">{editing ? "Edit Lomba" : "Tambah Lomba"}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F9FAFB] text-[#6B7280] flex items-center justify-center hover:bg-[#E5E7EB]">
            <i className="fas fa-xmark"></i>
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-5">
          <div>
            <label className="label">Nama Lomba <span className="text-primary">*</span></label>
            <input className="input" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Contoh: Makan Kerupuk" />
          </div>

          <div>
            <label className="label">Emoji</label>
            <div className="grid grid-cols-8 gap-2">
              {EMOJI_OPTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEmoji(em)}
                  className={`aspect-square text-2xl border-2 rounded flex items-center justify-center transition-all ${
                    emoji === em ? "bg-primary-light border-primary" : "bg-white border-[#E5E7EB] hover:border-primary"
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Deskripsi (opsional)</label>
            <textarea className="input" rows={2} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder="Deskripsi singkat lomba" />
          </div>

          <div>
            <label className="label">Syarat & Ketentuan <span className="text-[11px] text-[#6B7280]">(1 syarat per baris)</span></label>
            <textarea className="input" rows={4} value={syarat} onChange={(e) => setSyarat(e.target.value)} placeholder={"Contoh:\nPeserta berusia 5 tahun ke atas\nBawa sendiri alat"} />
          </div>

          <div>
            <label className="label">Kategori Eligible <span className="text-primary">*</span></label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {kats.map((k) => (
                <label key={k.id} className={`flex items-center gap-2.5 p-3 border-2 rounded cursor-pointer ${kategoriEligible.includes(k.id) ? "border-primary bg-primary-light" : "border-[#E5E7EB]"}`}>
                  <input type="checkbox" checked={kategoriEligible.includes(k.id)} onChange={() => toggleKat(k.id)} className="accent-primary w-4 h-4" />
                  <span className="text-[13px] font-semibold">{k.nama}</span>
                </label>
              ))}
            </div>
          </div>

          {kategoriEligible.length > 0 && (
            <div>
              <label className="label">
                Penanggung Jawab per Kategori <span className="text-primary">*</span>
                <span className="text-[10px] text-[#6B7280] ml-1 font-normal">bisa lebih dari 1 PJ per kategori</span>
              </label>
              <div className="space-y-3">
                {/* Group eligible kategori by public name so k_anak_l +
                    k_anak_p collapse into a single "Anak" PJ block. Same
                    PJs handle both genders — showing 2 separate blocks
                    for them is redundant. The broadcast helpers above
                    keep pjByKategori[k_anak_l] and pjByKategori[k_anak_p]
                    in sync, so DB-level the per-katId shape is preserved. */}
                {groups.map((g) => {
                  // Use the first katId in the group for jadwal read-back
                  // (the broadcast setter keeps every katId identical
                  // anyway, so any of them works).
                  const primaryKatId = g.katIds[0];
                  const list = pjByKategori[primaryKatId] || [];
                  const jadwal = jadwalByKategori[primaryKatId];
                  // Convert unix seconds (midnight UTC) to YYYY-MM-DD for
                  // <input type="date">. Stored value is always midnight UTC,
                  // so toISOString() (also UTC) round-trips cleanly.
                  const tanggalStr = jadwal?.tanggal
                    ? tsToUtcDateStr(jadwal.tanggal)
                    : "";
                  return (
                    <div key={g.publicName} className="border-2 border-primary-light rounded-lg p-3 bg-white">
                      <div className="text-[11px] font-bold text-primary uppercase tracking-wide mb-2.5 flex items-center justify-between">
                        <span><i className="fas fa-tag"></i> {g.publicName}</span>
                        <span className="text-[10px] text-[#6B7280] normal-case font-normal">{list.length} PJ</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2.5 pb-2.5 border-b border-dashed border-[#E5E7EB]">
                        <div>
                          <label className="text-[10px] text-[#6B7280] block mb-0.5">Tanggal Pelaksanaan</label>
                          <input
                            type="date"
                            className="input"
                            value={tanggalStr}
                            onChange={(e) => setJadwalForGroup(g.katIds, "tanggal", e.target.value || null)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#6B7280] block mb-0.5">Jam (opsional)</label>
                          <input
                            type="time"
                            className="input"
                            value={jadwal?.jam || ""}
                            onChange={(e) => setJadwalForGroup(g.katIds, "jam", e.target.value || null)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        {/* Column header — labels only once per kategori, so every PJ
                            row is uniform height (no label-tall-first-row misalignment
                            on the remove button). */}
                        <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 text-[10px] text-[#6B7280] font-semibold">
                          <div>Nama</div>
                          <div>No WA (opsional)</div>
                          <div className="w-9"></div>
                        </div>
                        {list.map((pj, idx) => (
                          <div key={idx} className="flex gap-1.5 items-center">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                              <input
                                className="input"
                                value={pj.nama}
                                onChange={(e) => setPjForGroup(g.katIds, idx, "nama", e.target.value)}
                                placeholder="Nama PJ (cth: Bu Yuni)"
                              />
                              <input
                                className="input"
                                value={pj.kontak || ""}
                                onChange={(e) => setPjForGroup(g.katIds, idx, "kontak", e.target.value)}
                                placeholder="0812-..."
                              />
                            </div>
                            {list.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removePjForGroup(g.katIds, idx)}
                                className="w-9 h-9 rounded-lg bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center hover:bg-[#FECACA] flex-shrink-0"
                                title="Hapus PJ ini"
                                aria-label="Hapus PJ"
                              >
                                <i className="fas fa-xmark text-sm"></i>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {list.length < MAX_PJ_PER_KAT && (
                        <button
                          type="button"
                          onClick={() => addPjForGroup(g.katIds)}
                          className="mt-2.5 w-full text-[12px] font-semibold text-primary border-2 border-dashed border-primary-light rounded-lg py-1.5 hover:bg-primary-light hover:border-primary transition-colors"
                        >
                          <i className="fas fa-plus text-[10px]"></i> Tambah PJ
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value as LombaFormData["status"])}>
                <option value="aktif">Aktif</option>
                <option value="draft">Draft</option>
                <option value="selesai">Selesai</option>
              </select>
            </div>
            <div>
              <label className="label">Finalis<span className="text-[10px] text-[#6B7280] ml-1 font-normal">per kategori</span></label>
              <input type="number" className="input" min={1} max={50} value={finalisCount} onChange={(e) => setFinalisCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
            </div>
            <div>
              <label className="label">Urutan Tampil</label>
              <input type="number" className="input" min={0} value={urutan} onChange={(e) => setUrutan(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 p-3.5 border border-[#E5E7EB] rounded-lg bg-[#F9FAFB]">
            <div>
              <div className="text-[13px] font-semibold flex items-center gap-2">
                <i className={`fas ${pendaftaranDibuka ? "fa-toggle-on text-[#22C55E]" : "fa-toggle-off text-[#9CA3AF]"}`}></i>
                Pendaftaran Publik
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pendaftaranDibuka ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>
                  {pendaftaranDibuka ? "DIBUKA" : "DITUTUP"}
                </span>
              </div>
              <div className="text-[11px] text-[#6B7280] mt-1">
                {pendaftaranDibuka
                  ? "Warga bisa mendaftar via form publik. Input manual admin tetap bisa."
                  : "Form publik tertutup. Input manual admin tetap bisa."}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPendaftaranDibuka((v) => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${pendaftaranDibuka ? "bg-[#22C55E]" : "bg-[#D1D5DB]"}`}
              title={pendaftaranDibuka ? "Tutup pendaftaran" : "Buka pendaftaran"}
              aria-pressed={pendaftaranDibuka}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${pendaftaranDibuka ? "translate-x-6" : "translate-x-0"}`}
              />
            </button>
          </div>

          {err && (
            <div className="bg-[#FEE2E2] text-[#991B1B] text-sm rounded p-3 leading-relaxed">
              <i className="fas fa-exclamation-triangle"></i> {err}
            </div>
          )}
        </div>
        <div className="p-4 bg-[#F9FAFB] flex gap-2 border-t border-[#E5E7EB]">
          <button onClick={onClose} className="btn btn-secondary flex-1">Batal</button>
          <button onClick={submit} disabled={saving} className="btn btn-primary flex-1 disabled:opacity-60">
            {saving ? <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</> : <><i className="fas fa-save"></i> Simpan</>}
          </button>
        </div>
      </div>
    </div>
  );
}
