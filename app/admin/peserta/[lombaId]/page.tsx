import AdminShell from "@/components/admin-shell";
import PesertaClient, { type AdminGroupKey, type AdminGroupData } from "./peserta-client";
import { getLombaById, getPendaftarByLomba, getKategori, groupPendaftarForLomba } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PesertaDetailPage({ params }: { params: Promise<{ lombaId: string }> }) {
  const { lombaId } = await params;
  const id = Number(lombaId);
  if (isNaN(id)) notFound();
  const l = await getLombaById(id);
  if (!l) notFound();

  // Get all approved peserta with full data
  const allRows = await getPendaftarByLomba(id, "disetujui");
  const kats = await getKategori();
  const katMap = new Map(kats.map((k) => [k.id, k]));

  // Get the section info (key, title, rangeLabel) from groupPendaftarForLomba
  const groups = await groupPendaftarForLomba(id);
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

  return (
    <AdminShell
      title={`Peserta ${l.nama}`}
      breadcrumb={`Manajemen Peserta / ${l.nama}`}
      activeNav="/admin/peserta"
    >
      <PesertaClient lomba={{ id: l.id, nama: l.nama, emoji: l.emoji }} sections={sections} initial={initial} />
    </AdminShell>
  );
}
