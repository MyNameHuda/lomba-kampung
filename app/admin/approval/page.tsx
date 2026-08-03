import AdminShell from "@/components/admin-shell";
import ApprovalClient from "./approval-client";
import {
  getPendaftar,
  getLomba,
  getKategori,
  countPendaftarByStatus,
  countAllPendaftar,
} from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ApprovalPage() {
  // Approval page only shows pendaftar that still need review (pending).
  // Once approved/rejected, they're auto-removed from this list (still in DB
  // and visible in /admin/peserta, just not in the approval queue).
  const [allPendaftar, allLomba, kats, pendingN, disetujuiN, ditolakN, totalN] = await Promise.all([
    getPendaftar(),
    getLomba(true),
    getKategori(),
    countPendaftarByStatus("pending"),
    countPendaftarByStatus("disetujui"),
    countPendaftarByStatus("ditolak"),
    countAllPendaftar(),
  ]);
  const pending = allPendaftar.filter((p) => p.status === "pending");
  const lombaById = new Map(allLomba.map((l) => [l.id, l]));

  // Summary counts for the stat cards (across all statuses, not just pending)
  const stats = {
    pending: pendingN,
    disetujui: disetujuiN,
    ditolak: ditolakN,
    total: totalN,
  };

  const initial = pending.map((p) => {
    const l = lombaById.get(p.lombaId);
    const k = kats.find((kk) => kk.id === p.kategoriId);
    return {
      id: p.id,
      nomor: p.nomor,
      nama: p.nama,
      noWa: p.noWa,
      jenisKelamin: p.jenisKelamin,
      umur: p.umur,
      lombaId: p.lombaId,
      lombaNama: l?.nama || "Lomba dihapus",
      lombaEmoji: l?.emoji || "❓",
      lombaTipe: (l?.kategoriEligible || []).length === 3 ? "Semua usia" : "Kategori khusus",
      kategori: k?.nama || "—",
      kategoriId: p.kategoriId,
      status: p.status,
      createdAt: new Date(p.createdAt * 1000).toISOString(),
    };
  });

  return (
    <AdminShell title="Approval Pendaftar" breadcrumb="Approval" activeNav="/admin/approval">
      <ApprovalClient initial={initial} stats={stats} />
    </AdminShell>
  );
}
