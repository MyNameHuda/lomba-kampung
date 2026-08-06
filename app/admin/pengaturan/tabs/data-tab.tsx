"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNotify } from "@/components/notify-provider";

export default function DataTab() {
  const router = useRouter();
  const notify = useNotify();
  const [resetConfirm, setResetConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  function downloadBackup() {
    window.location.href = "/api/admin/backup";
    notify.info("Mendownload backup database...");
  }

  function downloadExcel() {
    window.location.href = "/api/admin/export";
    notify.info("Mendownload export Excel (.xlsx)...");
  }

  async function doReset() {
    if (resetConfirm !== "HAPUS SEMUA DATA") {
      notify.warning("Ketik persis: HAPUS SEMUA DATA untuk konfirmasi");
      return;
    }
    const ok = await notify.confirm({
      title: "Hapus Semua Data",
      message: "Tindakan ini tidak dapat dibatalkan.\n\nSemua lomba & peserta akan dihapus. Kategori usia tetap dipertahankan.\n\nLanjutkan?",
      confirmText: "Ya, Hapus",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
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
      setBusy(false);
    }
  }

  return (
    <div className="card mb-5">
      <div className="p-4 border-b border-[#E5E7EB]">
        <div className="font-bold text-sm flex items-center gap-2"><i className="fas fa-database text-primary"></i> Data & Backup</div>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-4 p-3.5 border-b border-[#E5E7EB]">
          <div>
            <div className="text-[13px] font-semibold">Export Semua Data (Excel .xlsx)</div>
            <div className="text-[11px] text-[#6B7280]">Download data lomba & peserta dalam workbook Excel (3 sheet: Lomba, Peserta, Kategori)</div>
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
            <button onClick={doReset} disabled={busy} className="btn btn-danger">
              {busy ? <><i className="fas fa-spinner fa-spin"></i> Menghapus...</> : <><i className="fas fa-trash"></i> Hapus Semua Data</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
