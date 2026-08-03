import AdminShell from "@/components/admin-shell";
import LombaClient from "./lomba-client";
import { getLomba, getKategori, countPendaftarByLomba } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LombaAdminPage() {
  const rows = await getLomba(true);
  const kats = await getKategori();
  const counts: Record<number, number> = {};
  for (const l of rows) counts[l.id] = await countPendaftarByLomba(l.id);

  return (
    <AdminShell
      title="Manajemen Lomba"
      breadcrumb="Manajemen Lomba"
      activeNav="/admin/lomba"
      actions={
        <Link href="/admin/input-manual" className="btn btn-sm" style={{ background: "#F59E0B", color: "white", width: "auto" }}>
          <i className="fas fa-user-plus"></i> Input Manual
        </Link>
      }
    >
      <p className="text-[13px] text-[#6B7280] mb-4">Kelola lomba: tambah, edit, hapus, atau ubah status (aktif/selesai).</p>
      <LombaClient initial={rows} kats={kats.map((k) => ({ id: k.id, nama: k.nama }))} counts={counts} />
    </AdminShell>
  );
}
