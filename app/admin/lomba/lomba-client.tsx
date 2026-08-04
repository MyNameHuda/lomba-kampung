"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useNotify } from "@/components/notify-provider";
import KatTag from "@/components/kat-tag";
import LombaModal, { type LombaFormData } from "./lomba-modal";
import type { Pj, PjInput, KategoriSlim as Kat } from "@/lib/types";

// Lomba row shape (server-rendered + PJ populated).
// The pjByKategori map is hydrated by the server; the form uses pjList
// for create/update instead, converted to pjByKategori in the modal.
type Lomba = LombaFormData & {
  id: number;
  pjByKategori: Record<string, Pj[]>;
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
  useEffect(() => {
    setItems(initial);
  }, [initial]);

  async function saveLomba(data: LombaFormData & { pjList: PjInput[] }) {
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
      // Optimistic update — build pjByKategori map from flat pjList
      const pjMap: Record<string, Pj[]> = {};
      for (const p of data.pjList) {
        if (!pjMap[p.kategoriId]) pjMap[p.kategoriId] = [];
        pjMap[p.kategoriId].push({ nama: p.pjNama, kontak: p.pjKontak });
      }
      if (data.id) {
        setItems((prev) => prev.map((l) => (l.id === data.id ? { ...l, ...data, id: data.id, pjByKategori: pjMap } as Lomba : l)));
      } else {
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
          pjByKategori: pjMap,
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
              const tags = (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [])
                .map((kid) => kats.find((k) => k.id === kid))
                .filter(Boolean)
                .map((k) => <KatTag key={k!.id} nama={k!.nama} colorBg={k!.colorBg} colorText={k!.colorText} colorBorder={k!.colorBorder} />);
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
              <tr><td colSpan={5} className="text-center py-8 text-[#6B7280] empty-state-cell">Belum ada lomba. Klik "Tambah Lomba" untuk mulai.</td></tr>
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
