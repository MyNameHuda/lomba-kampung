import AdminShell from "@/components/admin-shell";
import PesertaClient, { type AdminGroupKey, type AdminGroupData } from "./peserta-client";
import { getLombaById, getPendaftarByLomba, getKategori, groupPendaftarForLomba } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PesertaDetailPage({ params }: { params: Promise<{ lombaId: string }> }) {
  const { lombaId } = await params;
  const id = Number(lombaId);
  if (isNaN(id)) notFound();
  const l = await getLombaById(id);
  if (!l) notFound();

  // Parallelize: allRows, kats, groups are all independent after we have `l`
  const [allRows, kats, groups] = await Promise.all([
    getPendaftarByLomba(id, "disetujui"),
    getKategori(),
    groupPendaftarForLomba(id),
  ]);
  const katMap = new Map(kats.map((k) => [k.id, k]));
  const sections = groups.sections;

  // For each section, build the full AdminGroup with enriched peserta data
  const initial: AdminGroupData = {} as AdminGroupData;
  for (const sec of sections) {
    const items = allRows
      .filter((r) => sec.peserta.some((p) => p.nama === r.nama && p.umur === r.umur && p.jenisKelamin === r.jenisKelamin))
      .map((r) => ({
        id: r.id,
        nomor: r.nomor,
        nama: r.nama,
        noWa: r.noWa,
        umur: r.umur,
        jenisKelamin: r.jenisKelamin,
        kategoriId: r.kategoriId,
        kategori: katMap.get(r.kategoriId)?.nama || "—",
        hadir: !!r.hadir,
      }));
    initial[sec.key as AdminGroupKey] = items;
  }

  // Pass eligible kategori (for Edit form dropdown) — slim shape
  const eligibleKategori = (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [])
    .map((kid) => {
      const k = katMap.get(kid);
      return k ? { id: k.id, nama: k.nama, min: k.min, max: k.max } : null;
    })
    .filter(Boolean) as Array<{ id: string; nama: string; min: number; max: number }>;

  return (
    <AdminShell
      title={`Peserta ${l.nama}`}
      breadcrumb={`Manajemen Peserta / ${l.nama}`}
      activeNav="/admin/peserta"
    >
      <PesertaClient
        lomba={{ id: l.id, nama: l.nama, emoji: l.emoji }}
        sections={sections}
        initial={initial}
        eligibleKategori={eligibleKategori}
      />
    </AdminShell>
  );
}
