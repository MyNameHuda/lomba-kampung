import AdminShell from "@/components/admin-shell";
import PesertaListClient from "./peserta-list-client";
import { getLomba, getKategori, countPendaftarByLomba, countPendaftarHadir } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PesertaListPage() {
  // Parallelize: fetch lomba + kategori together, then all counts together
  const [rows, kats] = await Promise.all([getLomba(true), getKategori()]);
  const counts = await Promise.all(
    rows.map(async (l) => ({
      id: l.id,
      total: await countPendaftarByLomba(l.id),
      disetujui: await countPendaftarByLomba(l.id, "disetujui"),
      hadir: await countPendaftarHadir(l.id),
    }))
  );
  const countById = new Map(counts.map((c) => [c.id, c]));

  // Flatten lomba + counts into the shape the client component needs.
  // Client component does the kategori filter (no URL change, no nav).
  const lomba = rows.map((l) => ({
    id: l.id,
    nama: l.nama,
    emoji: l.emoji,
    kategoriEligible: Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [],
    total: countById.get(l.id)?.total ?? 0,
    disetujui: countById.get(l.id)?.disetujui ?? 0,
    hadir: countById.get(l.id)?.hadir ?? 0,
  }));

  return (
    <AdminShell title="Manajemen Peserta" breadcrumb="Manajemen Peserta" activeNav="/admin/peserta">
      <PesertaListClient lomba={lomba} kategori={kats} />
    </AdminShell>
  );
}
