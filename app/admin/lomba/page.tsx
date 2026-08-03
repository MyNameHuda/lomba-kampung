import AdminShell from "@/components/admin-shell";
import LombaClient from "./lomba-client";
import { getLomba, getKategori, countPendaftarByLomba } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LombaAdminPage() {
  // Parallelize: fetch lomba + kategori together, then all counts together
  const [rows, kats] = await Promise.all([getLomba(true), getKategori()]);
  const countsArr = await Promise.all(rows.map((l) => countPendaftarByLomba(l.id)));
  const counts: Record<number, number> = {};
  rows.forEach((l, i) => (counts[l.id] = countsArr[i]));

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
