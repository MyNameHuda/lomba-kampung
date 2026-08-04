"use client";

import { useState } from "react";
import { useNotify } from "@/components/notify-provider";

export default function PasswordTab() {
  const notify = useNotify();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function change() {
    if (!oldPw || !newPw) { notify.warning("Semua field wajib diisi"); return; }
    if (newPw !== confirmPw) { notify.warning("Password baru tidak cocok"); return; }
    if (newPw.length < 6) { notify.warning("Password baru minimal 6 karakter"); return; }
    setBusy(true);
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
      setBusy(false);
    }
  }

  return (
    <div className="card mb-5">
      <div className="p-4 border-b border-[#E5E7EB]">
        <div className="font-bold text-sm flex items-center gap-2"><i className="fas fa-key text-primary"></i> Ubah Password</div>
        <div className="text-xs text-[#6B7280] mt-0.5">Ganti kata sandi admin</div>
      </div>
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div><div className="text-[13px] font-semibold">Password Saat Ini</div></div>
          <input type="password" className="input" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <div className="text-[13px] font-semibold">Password Baru</div>
            <div className="text-[11px] text-[#6B7280]">Min 6 karakter</div>
          </div>
          <input type="password" className="input" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div><div className="text-[13px] font-semibold">Konfirmasi Password</div></div>
          <input type="password" className="input" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        </div>
      </div>
      <div className="p-4 border-t border-[#E5E7EB] flex justify-end gap-2">
        <button onClick={() => { setOldPw(""); setNewPw(""); setConfirmPw(""); }} className="btn btn-secondary btn-sm">Batal</button>
        <button onClick={change} disabled={busy} className="btn btn-primary btn-sm">
          {busy ? <><i className="fas fa-spinner fa-spin"></i> Mengubah...</> : <><i className="fas fa-key"></i> Ubah</>}
        </button>
      </div>
    </div>
  );
}
