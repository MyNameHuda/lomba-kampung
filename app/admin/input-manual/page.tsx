import AdminShell from "@/components/admin-shell";
import InputManualClient from "./input-manual-client";
import { getLomba, getKategori, getPendaftar } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InputManualPage() {
  // Parallelize: all 3 independent DB calls
  const [lomList, kats, allPendaftar] = await Promise.all([
    getLomba(true),
    getKategori(),
    getPendaftar(),
  ]);

  // Build a lookup of lomba by id so the client can enrich each peserta
  // (lombaEmoji, lombaNama) without re-fetching.
  const lombaById = new Map(lomList.map((l) => [l.id, l]));

  // Shape slim per-pendaftar rows for the CRUD list. Exclude `ditolak`
  // because declined pendaftar are no longer in the active registration
  // flow (same convention as countPendaftarByLomba).
  const pesertaByLomba: Record<number, Array<{
    id: number;
    nomor: string;
    nama: string;
    noWa: string | null;
    umur: number;
    jenisKelamin: "L" | "P";
    kategoriId: string;
    kategori: string;
    hadir: boolean;
    sumber: "publik" | "manual";
    createdAt: number;
  }>> = {};

  for (const p of allPendaftar) {
    if (p.status === "ditolak") continue;
    const l = lombaById.get(p.lombaId);
    const kat = kats.find((k) => k.id === p.kategoriId);
    if (!pesertaByLomba[p.lombaId]) pesertaByLomba[p.lombaId] = [];
    pesertaByLomba[p.lombaId].push({
      id: p.id,
      nomor: p.nomor,
      nama: p.nama,
      noWa: p.noWa,
      umur: p.umur,
      jenisKelamin: p.jenisKelamin,
      kategoriId: p.kategoriId,
      // Use the DB kategori name (not the static KATEGORI_PUBLIC_NAME map)
      // so user-added kategori display their real label, not the raw id.
      kategori: kat?.nama ?? p.kategoriId,
      hadir: !!p.hadir,
      sumber: p.sumber,
      createdAt: p.createdAt,
    });
  }

  return (
    <AdminShell title="Input Peserta Manual" breadcrumb="Input Manual" activeNav="/admin/input-manual">
      <InputManualClient
        lombaList={lomList}
        kats={kats}
        pesertaByLomba={pesertaByLomba}
      />
    </AdminShell>
  );
}
