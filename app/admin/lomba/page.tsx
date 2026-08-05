import AdminShell from "@/components/admin-shell";
import LombaClient from "./lomba-client";
import { getLomba, getKategori, countPendaftarByLomba, countJuaraByKategori, getJuaraReadiness } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LombaAdminPage() {
  // Parallelize: fetch lomba + kategori together, then all counts together
  const [rows, kats] = await Promise.all([getLomba(true), getKategori()]);
  const [countsArr, juaraReadinessArr] = await Promise.all([
    Promise.all(rows.map((l) => countPendaftarByLomba(l.id))),
    Promise.all(rows.map((l) => getJuaraReadiness(l.id))),
  ]);
  const counts: Record<number, number> = {};
  const juaraSummary: Record<number, { totalJuara: number; allReady: boolean }> = {};
  rows.forEach((l, i) => {
    counts[l.id] = countsArr[i];
    const r = juaraReadinessArr[i];
    // Total juara = sum of ju1+ju2+ju3 across all eligible kategori
    const totalJuara = Object.values(r.perKategori).reduce(
      (sum, c) => sum + c.ju1 + c.ju2 + c.ju3,
      0
    );
    juaraSummary[l.id] = { totalJuara, allReady: r.allReady };
  });

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
      <p className="text-[13px] text-[#6B7280] mb-4 text-center">Kelola lomba: tambah, edit, hapus, atau ubah status (aktif/selesai).</p>
      <LombaClient
        initial={rows}
        kats={kats.map((k) => ({ id: k.id, nama: k.nama }))}
        counts={counts}
        juaraSummary={juaraSummary}
      />
    </AdminShell>
  );
}
