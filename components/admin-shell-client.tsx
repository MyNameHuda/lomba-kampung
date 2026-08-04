"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { NotifyProvider } from "./notify-provider";

const NAV = [
  { href: "/admin", icon: "fa-house", label: "Dashboard" },
  { href: "/admin/lomba", icon: "fa-trophy", label: "Manajemen Lomba" },
  { href: "/admin/approval", icon: "fa-user-check", label: "Approval" },
  { href: "/admin/peserta", icon: "fa-users", label: "Peserta" },
  { href: "/admin/input-manual", icon: "fa-user-plus", label: "Input Manual" },
  { href: "/admin/pengaturan", icon: "fa-gear", label: "Pengaturan" },
];

export default function AdminShellClient({
  children,
  title,
  breadcrumb,
  actions,
  activeNav,
  appName,
  kampungName,
}: {
  children: ReactNode;
  title: string;
  breadcrumb?: string;
  actions?: ReactNode;
  activeNav: string;
  appName: string;
  kampungName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <NotifyProvider>
      <div
        className={`sidebar-overlay ${open ? "active" : ""}`}
        onClick={() => setOpen(false)}
      />

      <aside className={`admin-sidebar ${open ? "open" : ""}`}>
        <div className="p-5 pr-12 border-b border-[#E5E7EB] mb-4 relative">
          <button
            className="sidebar-close"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
          >
            <i className="fas fa-xmark"></i>
          </button>
          <Link href="/admin" className="flex items-center gap-2.5 no-underline text-inherit">
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-primary-light">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.webp" alt="Logo IPEKA" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-bold text-[15px]">{appName}</div>
              <div className="text-[11px] text-[#6B7280]">{kampungName}</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 py-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`sidebar-nav-item ${activeNav === n.href ? "active" : ""}`}
              onClick={() => setOpen(false)}
            >
              <i className={`fas ${n.icon}`} style={{ width: 20, fontSize: 16 }}></i>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-[#E5E7EB]">
          <div className="flex items-center gap-2.5 p-2.5 rounded bg-[#F9FAFB]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-[13px] font-bold">A</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold">Admin</div>
            </div>
            <Link href="/" className="text-[#9CA3AF] text-xs" title="Lihat Halaman Publik" onClick={() => setOpen(false)}>
              <i className="fas fa-globe"></i>
            </Link>
            <form action="/api/admin/logout" method="POST">
              <button type="submit" className="text-[#9CA3AF] text-xs" title="Logout">
                <i className="fas fa-right-from-bracket"></i>
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              className="hamburger"
              onClick={() => setOpen(!open)}
              aria-label="Buka menu"
            >
              <i className="fas fa-bars"></i>
            </button>
            <div className="min-w-0">
              {breadcrumb && <div className="text-[11px] text-[#6B7280] mb-0.5">{breadcrumb}</div>}
              <div className="font-bold text-base">{title}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="btn btn-secondary btn-sm"
              style={{ width: "auto" }}
              title="Lihat halaman publik (tab ini)"
            >
              <i className="fas fa-globe"></i>
              <span className="hidden md:inline">Halaman Publik</span>
            </Link>
            {actions}
          </div>
        </header>
        <div className="admin-content">{children}</div>
      </main>
    </NotifyProvider>
  );
}
