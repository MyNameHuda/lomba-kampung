import AdminShell from "@/components/admin-shell";
import ApprovalClient from "./approval-client";
import {
  getPendaftar,
  getLomba,
  getKategori,
  countPendaftarByStatus,
  countAllPendaftar,
} from "@/lib/db";
import type { KategoriSlim } from "@/lib/types";

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

  // Slim shapes for the client-side filter chips. Only lomba that
  // actually have at least 1 pending pendaftar are passed — keeps the
  // chip row short and relevant.
  const lombaByPending = new Map<string, number>();
  for (const p of pending) lombaByPending.set(String(p.lombaId), (lombaByPending.get(String(p.lombaId)) ?? 0) + 1);
  const filterLomba = allLomba
    .filter((l) => lombaByPending.has(String(l.id)))
    .map((l) => ({ id: l.id, nama: l.nama, emoji: l.emoji }));
  // For kategori: any kategori that has at least 1 pending pendaftar.
  const katByPending = new Map<string, number>();
  for (const p of pending) katByPending.set(p.kategoriId, (katByPending.get(p.kategoriId) ?? 0) + 1);
  const filterKategori: KategoriSlim[] = kats
    .filter((k) => katByPending.has(k.id))
    .map((k) => ({
      id: k.id,
      nama: k.nama,
      icon: k.icon,
      min: k.min,
      max: k.max,
      colorBg: k.colorBg,
      colorText: k.colorText,
      colorBorder: k.colorBorder,
    }));

  return (
    <AdminShell title="Approval Pendaftar" breadcrumb="Approval" activeNav="/admin/approval">
      <ApprovalClient initial={initial} stats={stats} lombaList={filterLomba} kategoriList={filterKategori} />
    </AdminShell>
  );
}
