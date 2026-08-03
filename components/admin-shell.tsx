import type { ReactNode } from "react";
import { getSettings } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminShellClient from "./admin-shell-client";

export const dynamic = "force-dynamic";

export default async function AdminShell({
  children,
  title,
  breadcrumb,
  actions,
  activeNav,
}: {
  children: ReactNode;
  title: string;
  breadcrumb?: string;
  actions?: ReactNode;
  activeNav: string;
}) {
  const session = await getSession();
  if (!session.isAdmin) redirect("/admin/login");

  const cfg = await getSettings();

  return (
    <AdminShellClient
      title={title}
      breadcrumb={breadcrumb}
      actions={actions}
      activeNav={activeNav}
      appName={cfg?.appName || "Lomba Kampung"}
      kampungName={cfg?.kampungName || "Kampung Merdeka"}
    >
      {children}
    </AdminShellClient>
  );
}
