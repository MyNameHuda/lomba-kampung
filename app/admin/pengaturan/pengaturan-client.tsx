"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNotify } from "@/components/notify-provider";

type Kat = {
  id: string;
  nama: string;
  icon: string;
  min: number;
  max: number;
  urutan: number;
  autoAge: boolean;
};

const ICON_OPTIONS = [
  "fa-child", "fa-user", "fa-user-tie", "fa-user-graduate",
  "fa-person", "fa-person-cane", "fa-baby",
  "fa-people-group", "fa-user-astronaut",
  "fa-heart", "fa-star", "fa-trophy", "fa-medal", "fa-crown",
];

const TAHUN_OPTIONS = [
  "HUT RI ke-81 (2026)",
  "HUT RI ke-80 (2025)",
  "HUT RI ke-79 (2024)",
  "HUT RI ke-82 (2027)",
];

export default function PengaturanClient({
  settings,
  kategori,
}: {
  settings: { appName: string; kampungName: string; tahunAktif: string } | null;
  kategori: Kat[];
}) {
  const router = useRouter();
  const notify = useNotify();
  const [tab, setTab] = useState<"profil" | "password" | "kategori" | "data" | "tentang">("profil");
  // Local state as source of truth for the kategori list.
  // Initialized from prop on mount; updates via setKats on every action.
  // `router.refresh()` in Next.js 14 doesn't reliably re-render the prop
  // when the parent re-fetch returns the same array reference, so we
  // use local state instead. The `useEffect` re-syncs when the prop's
  // IDs actually differ (to handle cross-tab/device changes).
  const [kats, setKats] = useState(kategori);
  useEffect(() => {
    // Only sync from prop if the IDs differ (avoid race with optimistic updates)
    const propIds = kategori.map((k) => k.id).sort().join(",");
    const localIds = kats.map((k) => k.id).sort().join(",");
    if (propIds !== localIds) {
      setKats(kategori);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategori]);
  const [editing, setEditing] = useState<Kat | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Settings form
  const [appName, setAppName] = useState(settings?.appName || "Lomba Kampung");
  const [kampungName, setKampungName] = useState(settings?.kampungName || "Kampung Merdeka");
  const [tahunAktif, setTahunAktif] = useState(settings?.tahunAktif || "HUT RI ke-81 (2026)");

  // Profile status
  const [profileBusy, setProfileBusy] = useState(false);

  // Password form
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  // Reset state
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  async function saveProfile() {
    setProfileBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName: appName.trim(), kampungName: kampungName.trim(), tahunAktif }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal");
      notify.success("Profil berhasil disimpan");
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Gagal simpan");
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword() {
    if (!oldPw || !newPw) { notify.warning("Semua field wajib diisi"); return; }
    if (newPw !== confirmPw) { notify.warning("Password baru tidak cocok"); return; }
    if (newPw.length < 6) { notify.warning("Password baru minimal 6 karakter"); return; }
    setPwBusy(true);
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal");
      notify.success("Password berhasil diubah. Silakan login ulang.");
      setOldPw(""); setNewPw(""); setConfirmPw("");
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Gagal ubah password");
    } finally {
      setPwBusy(false);
    }
  }

  async function saveKategori(data: { id?: string; nama: string; icon: string; min: number; max: number; autoAge: boolean }) {
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
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal");
      if (isNew) {
        const newKat: Kat = { id: json.id, nama: data.nama, icon: data.icon, min: data.min, max: data.max, urutan: kats.length + 1, autoAge: data.autoAge };
        setKats((prev) => [...prev, newKat].sort((a, b) => a.min - b.min));
      } else {
        setKats((prev) => prev.map((k) => (k.id === data.id ? { ...k, ...data } as Kat : k)).sort((a, b) => a.min - b.min));
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

  function downloadBackup() {
    window.location.href = "/api/admin/backup";
    notify.info("Mendownload backup database...");
  }

  function downloadExcel() {
    window.location.href = "/api/admin/export";
    notify.info("Mendownload export CSV...");
  }

  async function doReset() {
    if (resetConfirm !== "HAPUS SEMUA DATA") {
      notify.warning('Ketik persis: HAPUS SEMUA DATA untuk konfirmasi');
      return;
    }
    const ok = await notify.confirm({
      title: "Hapus Semua Data",
      message: "Tindakan ini tidak dapat dibatalkan.\n\nSemua lomba & peserta akan dihapus. Kategori usia tetap dipertahankan.\n\nLanjutkan?",
      confirmText: "Ya, Hapus",
      variant: "danger",
    });
    if (!ok) return;
    setResetBusy(true);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: resetConfirm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal");
      notify.success("Semua data lomba & peserta berhasil dihapus. Kategori dipertahankan.");
      setResetConfirm("");
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Gagal reset");
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
      {/* Side nav */}
      <nav className="card p-2 h-fit lg:sticky lg:top-4 flex lg:flex-col flex-row overflow-x-auto">
        {[
          { id: "profil", icon: "fa-user", label: "Profil Aplikasi" },
          { id: "password", icon: "fa-key", label: "Ubah Password" },
          { id: "kategori", icon: "fa-layer-group", label: "Kategori Usia" },
          { id: "data", icon: "fa-database", label: "Data & Backup" },
          { id: "tentang", icon: "fa-circle-info", label: "Tentang" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded text-[13px] font-semibold transition-all whitespace-nowrap lg:w-full ${
              tab === t.id ? "bg-primary-light text-primary" : "text-[#6B7280] hover:bg-[#F9FAFB]"
            }`}
          >
            <i className={`fas ${t.icon}`} style={{ width: 18 }}></i>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <div>
        {tab === "profil" && (
          <div className="card mb-5">
            <div className="p-4 border-b border-[#E5E7EB]">
              <div className="font-bold text-sm flex items-center gap-2"><i className="fas fa-user text-primary"></i> Profil Aplikasi</div>
              <div className="text-xs text-[#6B7280] mt-0.5">Identitas visual yang ditampilkan di sidebar & dashboard</div>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div><div className="text-[13px] font-semibold">Nama Aplikasi</div><div className="text-[11px] text-[#6B7280]">Ditampilkan di sidebar & title</div></div>
                <input className="input" value={appName} onChange={(e) => setAppName(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div><div className="text-[13px] font-semibold">Nama Kampung</div><div className="text-[11px] text-[#6B7280]">Subtitle di sidebar</div></div>
                <input className="input" value={kampungName} onChange={(e) => setKampungName(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div><div className="text-[13px] font-semibold">Tahun Aktif</div><div className="text-[11px] text-[#6B7280]">Tahun peringatan HUT RI</div></div>
                <select className="input" value={tahunAktif} onChange={(e) => setTahunAktif(e.target.value)}>
                  {TAHUN_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-[#E5E7EB] flex justify-end gap-2">
              <button onClick={() => { setAppName(settings?.appName || ""); setKampungName(settings?.kampungName || ""); setTahunAktif(settings?.tahunAktif || ""); }} className="btn btn-secondary btn-sm">Batal</button>
              <button onClick={saveProfile} disabled={profileBusy} className="btn btn-primary btn-sm">
                {profileBusy ? <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</> : <><i className="fas fa-save"></i> Simpan</>}
              </button>
            </div>
          </div>
        )}

        {tab === "password" && (
          <div className="card mb-5">
            <div className="p-4 border-b border-[#E5E7EB]">
              <div className="font-bold text-sm flex items-center gap-2"><i className="fas fa-key text-primary"></i> Ubah Password</div>
              <div className="text-xs text-[#6B7280] mt-0.5">Ganti kata sandi admin</div>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div><div className="text-[13px] font-semibold">Password Saat Ini</div></div>
                <input type="password" className="input" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div><div className="text-[13px] font-semibold">Password Baru</div><div className="text-[11px] text-[#6B7280]">Min 6 karakter</div></div>
                <input type="password" className="input" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div><div className="text-[13px] font-semibold">Konfirmasi Password</div></div>
                <input type="password" className="input" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="••••••••" />
              </div>
            </div>
            <div className="p-4 border-t border-[#E5E7EB] flex justify-end gap-2">
              <button onClick={() => { setOldPw(""); setNewPw(""); setConfirmPw(""); }} className="btn btn-secondary btn-sm">Batal</button>
              <button onClick={changePassword} disabled={pwBusy} className="btn btn-primary btn-sm">
                {pwBusy ? <><i className="fas fa-spinner fa-spin"></i> Mengubah...</> : <><i className="fas fa-key"></i> Ubah</>}
              </button>
            </div>
          </div>
        )}

        {tab === "kategori" && (
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
                          <span className="ml-2 inline-flex items-center gap-1 bg-[#d4f1f4] text-[#093a3e] text-[10px] font-bold px-1.5 py-0.5 rounded">
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
                        {k.autoAge ? <span className="text-[#093a3e]">skip</span> : `${k.max - k.min + 1} tombol`}
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
                    <tr><td colSpan={5} className="text-center py-6 text-[#6B7280]">Belum ada kategori.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "data" && (
          <div className="card mb-5">
            <div className="p-4 border-b border-[#E5E7EB]">
              <div className="font-bold text-sm flex items-center gap-2"><i className="fas fa-database text-primary"></i> Data & Backup</div>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-4 p-3.5 border-b border-[#E5E7EB]">
                <div>
                  <div className="text-[13px] font-semibold">Export Semua Data (CSV / Excel)</div>
                  <div className="text-[11px] text-[#6B7280]">Download data lomba & peserta, bisa dibuka di Excel</div>
                </div>
                <button onClick={downloadExcel} className="btn btn-secondary"><i className="fas fa-file-excel"></i> Download</button>
              </div>
              <div className="flex items-center justify-between gap-4 p-3.5 border-b border-[#E5E7EB]">
                <div>
                  <div className="text-[13px] font-semibold">Backup Database (JSON)</div>
                  <div className="text-[11px] text-[#6B7280]">Snapshot lengkap semua data, untuk restore manual</div>
                </div>
                <button onClick={downloadBackup} className="btn btn-secondary"><i className="fas fa-download"></i> Download</button>
              </div>
              <div className="bg-[#FEE2E2] border border-[#FECACA] rounded p-5 mt-6">
                <h4 className="text-[#991B1B] text-[13px] font-bold mb-1">⚠ Danger Zone</h4>
                <p className="text-[#991B1B] text-xs mb-3">Hapus semua lomba & peserta. Kategori usia tetap dipertahankan. Tindakan tidak dapat dibatalkan.</p>
                <div className="space-y-3">
                  <input
                    className="input"
                    value={resetConfirm}
                    onChange={(e) => setResetConfirm(e.target.value)}
                    placeholder="Ketik: HAPUS SEMUA DATA"
                  />
                  <button onClick={doReset} disabled={resetBusy} className="btn btn-danger">
                    {resetBusy ? <><i className="fas fa-spinner fa-spin"></i> Menghapus...</> : <><i className="fas fa-trash"></i> Hapus Semua Data</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "tentang" && (
          <div className="card mb-5">
            <div className="p-4 border-b border-[#E5E7EB]">
              <div className="font-bold text-sm flex items-center gap-2"><i className="fas fa-circle-info text-primary"></i> Tentang Aplikasi</div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3.5"><div className="text-[11px] text-[#6B7280]">Versi</div><div className="text-[13px] font-semibold">v1.1 MVP</div></div>
                <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3.5"><div className="text-[11px] text-[#6B7280]">Lisensi</div><div className="text-[13px] font-semibold">Free for Kampung Merdeka</div></div>
                <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3.5"><div className="text-[11px] text-[#6B7280]">Stack</div><div className="text-[13px] font-semibold">Next.js 14 + node:sqlite</div></div>
                <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded p-3.5"><div className="text-[11px] text-[#6B7280]">🇮🇩</div><div className="text-[13px] font-semibold">Untuk HUT RI Kampung</div></div>
              </div>
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="text-center mt-6">
          <form action="/api/admin/logout" method="POST">
            <button type="submit" className="btn btn-secondary inline-flex">
              <i className="fas fa-right-from-bracket"></i> Logout
            </button>
          </form>
        </div>
      </div>

      {/* Modal Kategori */}
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

function KategoriModal({
  editing,
  onClose,
  onSave,
}: {
  editing: Kat | null;
  onClose: () => void;
  onSave: (data: { id?: string; nama: string; icon: string; min: number; max: number; autoAge: boolean }) => void;
}) {
  const [nama, setNama] = useState(editing?.nama || "");
  const [icon, setIcon] = useState(editing?.icon || "fa-child");
  const [min, setMin] = useState(editing?.min || 5);
  const [max, setMax] = useState(editing?.max || 11);
  const [autoAge, setAutoAge] = useState(editing?.autoAge ?? (min >= 18));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!nama.trim()) { setError("Nama wajib diisi"); return; }
    if (min < 1 || max < 1 || min > max) { setError("Range umur tidak valid"); return; }
    setBusy(true);
    setError("");
    try {
      await onSave({ id: editing?.id, nama: nama.trim(), icon, min, max, autoAge });
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
                  <i className="fas fa-bolt text-[#093a3e]"></i> Auto Umur
                </strong>
                <span className="text-[#6B7280] text-[11px]">
                  Peserta tidak perlu pilih umur di form. Umur otomatis tercatat sebagai nilai minimum kategori ({min} tahun ke atas). Cocok untuk kategori "Dewasa" / "Lansia".
                </span>
              </div>
            </label>
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
