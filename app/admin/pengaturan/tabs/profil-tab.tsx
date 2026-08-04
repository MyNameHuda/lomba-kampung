"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNotify } from "@/components/notify-provider";
import { APP_CONFIG } from "@/lib/constants";

const TAHUN_OPTIONS = [
  "HUT RI ke-81 (2026)",
  "HUT RI ke-80 (2025)",
  "HUT RI ke-79 (2024)",
  "HUT RI ke-82 (2027)",
];

export default function ProfilTab({
  settings,
}: {
  settings: { appName: string; kampungName: string; tahunAktif: string } | null;
}) {
  const router = useRouter();
  const notify = useNotify();
  const [appName, setAppName] = useState(settings?.appName || APP_CONFIG.DEFAULT_APP_NAME);
  const [kampungName, setKampungName] = useState(settings?.kampungName || APP_CONFIG.DEFAULT_KAMPUNG_NAME);
  const [tahunAktif, setTahunAktif] = useState(settings?.tahunAktif || APP_CONFIG.DEFAULT_TAHUN);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
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
      setBusy(false);
    }
  }

  return (
    <div className="card mb-5">
      <div className="p-4 border-b border-[#E5E7EB]">
        <div className="font-bold text-sm flex items-center gap-2"><i className="fas fa-user text-primary"></i> Profil Aplikasi</div>
        <div className="text-xs text-[#6B7280] mt-0.5">Identitas visual yang ditampilkan di sidebar & dashboard</div>
      </div>
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <div className="text-[13px] font-semibold">Nama Aplikasi</div>
            <div className="text-[11px] text-[#6B7280]">Ditampilkan di sidebar & title</div>
          </div>
          <input className="input" value={appName} onChange={(e) => setAppName(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <div className="text-[13px] font-semibold">Nama Kampung</div>
            <div className="text-[11px] text-[#6B7280]">Subtitle di sidebar</div>
          </div>
          <input className="input" value={kampungName} onChange={(e) => setKampungName(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <div className="text-[13px] font-semibold">Tahun Aktif</div>
            <div className="text-[11px] text-[#6B7280]">Tahun peringatan HUT RI</div>
          </div>
          <select className="input" value={tahunAktif} onChange={(e) => setTahunAktif(e.target.value)}>
            {TAHUN_OPTIONS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="p-4 border-t border-[#E5E7EB] flex justify-end gap-2">
        <button
          onClick={() => {
            setAppName(settings?.appName || APP_CONFIG.DEFAULT_APP_NAME);
            setKampungName(settings?.kampungName || APP_CONFIG.DEFAULT_KAMPUNG_NAME);
            setTahunAktif(settings?.tahunAktif || APP_CONFIG.DEFAULT_TAHUN);
          }}
          className="btn btn-secondary btn-sm"
        >
          Batal
        </button>
        <button onClick={save} disabled={busy} className="btn btn-primary btn-sm">
          {busy ? <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</> : <><i className="fas fa-save"></i> Simpan</>}
        </button>
      </div>
    </div>
  );
}
