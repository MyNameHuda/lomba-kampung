"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useNotify } from "@/components/notify-provider";

type Lomba = {
  id: number;
  nama: string;
  emoji: string;
  deskripsi: string | null;
  syarat: string[];
  kategoriEligible: string[];
  status: "draft" | "aktif" | "selesai";
  urutan: number;
  pjByKategori: Record<string, { nama: string; kontak: string | null }>;
};

type PjInput = { kategoriId: string; pjNama: string; pjKontak: string | null };

type Kat = { id: string; nama: string };

const EMOJI_OPTIONS = ["🏆", "🍪", "🏃", "🪢", "🌴", "💧", "🎤", "🪑", "🥚", "🎯", "🏐", "🎲", "🎨", "🎭", "📚", "🚌"];

const EMPTY_LOMBA: Omit<Lomba, "id" | "pjByKategori"> = {
  nama: "",
  emoji: "🏆",
  deskripsi: "",
  syarat: [],
  kategoriEligible: [],
  status: "aktif",
  urutan: 0,
};

export default function LombaClient({ initial, kats, counts }: { initial: Lomba[]; kats: Kat[]; counts: Record<number, number> }) {
  const router = useRouter();
  const notify = useNotify();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Lomba | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Sync local items with server-provided initial prop after router.refresh()
  // Without this, new lomba created via POST only appears after manual page refresh
  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const katMap = new Map(kats.map((k) => [k.id, k]));

  async function saveLomba(data: Omit<Lomba, "id" | "pjByKategori"> & { id?: number; pjList: PjInput[] }) {
    setError("");
    try {
      const url = data.id ? `/api/admin/lomba/${data.id}` : "/api/admin/lomba";
      const method = data.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal");
      setCreating(false);
      setEditing(null);
      // Optimistic update: append/replace in local state immediately so user
      // sees the change without waiting for router.refresh() to round-trip.
      if (data.id) {
        // Update existing — refresh will sync pjByKategori from server
        setItems((prev) => prev.map((l) => (l.id === data.id ? { ...l, ...data, id: data.id, pjByKategori: l.pjByKategori } as Lomba : l)));
      } else {
        // Create new — synthesize a local entry; router.refresh will replace with full server data
        const tempId = -Math.floor(Math.random() * 1e6);
        const newLocal: Lomba = {
          id: tempId,
          nama: data.nama,
          emoji: data.emoji,
          deskripsi: data.deskripsi,
          syarat: data.syarat,
          kategoriEligible: data.kategoriEligible,
          status: data.status,
          urutan: data.urutan,
          pjByKategori: Object.fromEntries(data.pjList.map((p) => [p.kategoriId, { nama: p.pjNama, kontak: p.pjKontak }])),
        };
        setItems((prev) => [...prev, newLocal]);
      }
      router.refresh();
      notify.success(data.id ? "Lomba berhasil diperbarui" : "Lomba berhasil ditambahkan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
      notify.error(e instanceof Error ? e.message : "Gagal menyimpan lomba");
    }
  }

  async function deleteLomba(id: number, nama: string) {
    const ok = await notify.confirm({
      title: "Hapus Lomba",
      message: `Hapus lomba "${nama}"?\n\nSemua peserta yang terkait akan ikut terhapus.`,
      confirmText: "Hapus",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/lomba/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.filter((l) => l.id !== id));
      router.refresh();
      notify.success(`Lomba "${nama}" berhasil dihapus`);
    } catch {
      notify.error("Gagal hapus lomba");
    } finally {
      setBusy(null);
    }
  }

  async function toggleStatus(l: Lomba) {
    const next = l.status === "aktif" ? "selesai" : "aktif";
    setBusy(l.id);
    try {
      const res = await fetch(`/api/admin/lomba/${l.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.map((x) => (x.id === l.id ? { ...x, status: next } : x)));
      router.refresh();
      notify.success(`Status lomba diubah ke ${next}`);
    } catch {
      notify.error("Gagal update status");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="flex justify-center mb-4">
        <button onClick={() => { setEditing(null); setCreating(true); }} className="btn btn-primary btn-sm">
          <i className="fas fa-plus"></i> Tambah Lomba
        </button>
      </div>

      {error && (
        <div className="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-sm rounded p-3.5 mb-4 leading-relaxed">
          <i className="fas fa-exclamation-triangle"></i> {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="admin-table mobile-card-table">
          <thead>
            <tr>
              <th>Lomba</th>
              <th>Kategori</th>
              <th>Peserta</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => {
              const tags = (l.kategoriEligible || [])
                .map((kid) => katMap.get(kid))
                .filter(Boolean)
                .map((k) => <span key={k!.id} className={`tag tag-${k!.id.replace("k_", "")}`}>{k!.nama}</span>);
              return (
                <tr key={l.id}>
                  <td className="cell-primary" data-label="Lomba">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center text-xl">{l.emoji}</div>
                      <div className="flex flex-col gap-0.5 leading-snug min-w-0">
                        <div className="font-semibold text-[13px]">{l.nama}</div>
                        {l.deskripsi && <div className="text-[11px] text-[#6B7280]">{l.deskripsi}</div>}
                      </div>
                    </div>
                  </td>
                  <td data-label="Kategori"><div className="flex flex-wrap gap-1">{tags}</div></td>
                  <td data-label="Peserta">
                    <div className="flex flex-col gap-0.5 leading-snug">
                      <div className="font-semibold">{counts[l.id] || 0}</div>
                      <div className="text-[10px] text-[#9CA3AF]"><i className="fas fa-infinity"></i> Tanpa batas</div>
                    </div>
                  </td>
                  <td data-label="Status">
                    <button
                      onClick={() => toggleStatus(l)}
                      disabled={busy === l.id}
                      className={`status-badge ${l.status === "aktif" ? "status-approved" : l.status === "selesai" ? "status-hadir" : "status-pending"}`}
                      title="Klik untuk toggle"
                    >
                      <i className="fas fa-circle" style={{ fontSize: 6 }}></i> {l.status}
                    </button>
                  </td>
                  <td className="cell-actions" data-label="Aksi">
                    <div className="row-actions">
                      <Link href={`/lomba/${l.id}`} target="_blank" className="icon-action" title="Lihat publik">
                        <i className="fas fa-eye"></i>
                      </Link>
                      <Link href={`/admin/peserta/${l.id}`} className="icon-action" title="Peserta">
                        <i className="fas fa-users"></i>
                      </Link>
                      <button onClick={() => { setEditing(l); setCreating(true); }} className="icon-action" title="Edit">
                        <i className="fas fa-pen"></i>
                      </button>
                      <button onClick={async () => await deleteLomba(l.id, l.nama)} disabled={busy === l.id} className="icon-action reject" title="Hapus">
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-[#6B7280]">Belum ada lomba. Klik "Tambah Lomba" untuk mulai.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <LombaModal
          editing={editing}
          kats={kats}
          nextUrutan={items.length > 0 ? Math.max(...items.map((l) => l.urutan)) + 1 : 1}
          onClose={() => { setCreating(false); setEditing(null); setError(""); }}
          onSave={saveLomba}
        />
      )}
    </>
  );
}

function LombaModal({
  editing,
  kats,
  nextUrutan,
  onClose,
  onSave,
}: {
  editing: Lomba | null;
  kats: Kat[];
  nextUrutan: number;
  onClose: () => void;
  onSave: (data: Omit<Lomba, "id" | "pjByKategori"> & { id?: number; pjList: PjInput[] }) => void;
}) {
  const [nama, setNama] = useState(editing?.nama || "");
  const [emoji, setEmoji] = useState(editing?.emoji || "🏆");
  const [deskripsi, setDeskripsi] = useState(editing?.deskripsi || "");
  const [syarat, setSyarat] = useState((editing?.syarat || []).join("\n"));
  const [kategoriEligible, setKategoriEligible] = useState<string[]>(editing?.kategoriEligible || []);
  const [pjByKategori, setPjByKategori] = useState<Record<string, { nama: string; kontak: string | null }>>(
    editing?.pjByKategori || {}
  );
  const [status, setStatus] = useState<Lomba["status"]>(editing?.status || "aktif");
  const [urutan, setUrutan] = useState(editing?.urutan ?? nextUrutan);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function toggleKat(id: string) {
    setKategoriEligible((prev) => {
      if (prev.includes(id)) {
        // Removing — also remove pj for this kategori
        setPjByKategori((p) => {
          const { [id]: _, ...rest } = p;
          return rest;
        });
        return prev.filter((x) => x !== id);
      } else {
        // Adding — pre-fill pj with empty
        setPjByKategori((p) => ({ ...p, [id]: { nama: "", kontak: null } }));
        return [...prev, id];
      }
    });
  }

  function setPj(katId: string, field: "nama" | "kontak", value: string) {
    setPjByKategori((prev) => ({
      ...prev,
      [katId]: {
        nama: field === "nama" ? value : (prev[katId]?.nama || ""),
        kontak: field === "kontak" ? (value.trim() || null) : (prev[katId]?.kontak ?? null),
      },
    }));
  }

  async function submit() {
    setErr("");
    if (!nama.trim()) { setErr("Nama lomba wajib diisi"); return; }
    if (kategoriEligible.length === 0) { setErr("Pilih minimal 1 kategori"); return; }
    // Validate PJ for each selected kategori
    for (const katId of kategoriEligible) {
      const pj = pjByKategori[katId];
      if (!pj || !pj.nama.trim()) {
        const kat = kats.find((k) => k.id === katId);
        setErr(`PJ untuk kategori "${kat?.nama || katId}" wajib diisi`); return;
      }
    }
    setSaving(true);
    try {
      const pjList: PjInput[] = kategoriEligible.map((katId) => ({
        kategoriId: katId,
        pjNama: (pjByKategori[katId]?.nama || "").trim(),
        pjKontak: pjByKategori[katId]?.kontak || null,
      }));
      await onSave({
        id: editing?.id,
        nama: nama.trim(),
        emoji,
        deskripsi: deskripsi.trim() || null,
        syarat: syarat.split("\n").map((s) => s.trim()).filter(Boolean),
        kategoriEligible,
        pjList,
        status,
        urutan,
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
                <span className="text-[10px] text-[#6B7280] ml-1 font-normal">setiap kategori punya PJ sendiri</span>
              </label>
              <div className="space-y-3">
                {kategoriEligible.map((katId) => {
                  const kat = kats.find((k) => k.id === katId);
                  const pj = pjByKategori[katId] || { nama: "", kontak: null };
                  return (
                    <div key={katId} className="border-2 border-primary-light rounded-lg p-3 bg-white">
                      <div className="text-[11px] font-bold text-primary uppercase tracking-wide mb-2.5">
                        <i className="fas fa-tag"></i> {kat?.nama || katId}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        <div>
                          <input
                            className="input"
                            value={pj.nama}
                            onChange={(e) => setPj(katId, "nama", e.target.value)}
                            placeholder="Nama PJ (cth: Bu Yuni)"
                          />
                        </div>
                        <div>
                          <input
                            className="input"
                            value={pj.kontak || ""}
                            onChange={(e) => setPj(katId, "kontak", e.target.value)}
                            placeholder="No WA (cth: 0812-...)"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Lomba["status"])}>
                <option value="aktif">Aktif</option>
                <option value="draft">Draft</option>
                <option value="selesai">Selesai</option>
              </select>
            </div>
            <div>
              <label className="label">Urutan Tampil</label>
              <input type="number" className="input" min={0} value={urutan} onChange={(e) => setUrutan(Number(e.target.value))} />
            </div>
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
