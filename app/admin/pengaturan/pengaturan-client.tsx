"use client";

import { useEffect, useState } from "react";
import ProfilTab from "./tabs/profil-tab";
import PasswordTab from "./tabs/password-tab";
import KategoriTab from "./tabs/kategori-tab";
import DataTab from "./tabs/data-tab";
import TentangTab from "./tabs/tentang-tab";
import type { Kategori } from "@/lib/db";

type Tab = "profil" | "password" | "kategori" | "data" | "tentang";

const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: "profil", icon: "fa-user", label: "Profil Aplikasi" },
  { id: "password", icon: "fa-key", label: "Ubah Password" },
  { id: "kategori", icon: "fa-layer-group", label: "Kategori Usia" },
  { id: "data", icon: "fa-database", label: "Data & Backup" },
  { id: "tentang", icon: "fa-circle-info", label: "Tentang" },
];

export default function PengaturanClient({
  settings,
  kategori,
}: {
  settings: { appName: string; kampungName: string; tahunAktif: string } | null;
  kategori: Kategori[];
}) {
  const [tab, setTab] = useState<Tab>("profil");

  // Local state as source of truth for the kategori list (the kategori tab
  // mutates it; we re-sync from the prop only when its ID set actually changes,
  // to avoid races with optimistic updates from router.refresh()).
  const [kats, setKats] = useState<Kategori[]>(kategori);
  useEffect(() => {
    const propIds = kategori.map((k) => k.id).sort().join(",");
    const localIds = kats.map((k) => k.id).sort().join(",");
    if (propIds !== localIds) {
      setKats(kategori);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategori]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
      {/* Side nav */}
      <nav className="card p-2 h-fit lg:sticky lg:top-4 flex lg:flex-col flex-row overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
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
        {tab === "profil" && <ProfilTab settings={settings} />}
        {tab === "password" && <PasswordTab />}
        {tab === "kategori" && <KategoriTab kats={kats} setKats={setKats} />}
        {tab === "data" && <DataTab />}
        {tab === "tentang" && <TentangTab />}

        {/* Logout (always visible) */}
        <div className="text-center mt-6">
          <form action="/api/admin/logout" method="POST">
            <button type="submit" className="btn btn-secondary inline-flex">
              <i className="fas fa-right-from-bracket"></i> Logout
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
