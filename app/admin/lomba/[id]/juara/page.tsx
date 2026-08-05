// Juara picker page for stage system MVP.
// Admin selects Juara 1/2/3 per kategori. Once all kategori have
// at least Juara 1 + Juara 2, admin can "Selesaikan Lomba".
import AdminShell from "@/components/admin-shell";
import JuaraClient, { type PendaftarWithJuara } from "./juara-client";
import {
  getLombaById,
  getPendaftarByLomba,
  getKategori,
  getJuaraByLomba,
  getJuaraReadiness,
  type JuaraSlim,
} from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function JuaraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lombaId = Number(id);
  if (isNaN(lombaId)) notFound();
  const l = await getLombaById(lombaId);
  if (!l) notFound();

  // Parallelize: pendaftar, kategori, juara, readiness are all independent
  const [pendaftar, kats, juaraMap, readiness] = await Promise.all([
    getPendaftarByLomba(lombaId, "disetujui"),
    getKategori(),
    getJuaraByLomba(lombaId),
    getJuaraReadiness(lombaId),
  ]);
  const katMap = new Map(kats.map((k) => [k.id, k]));

  // Build a quick lookup: pendaftarId → juaraRank (for fast client access)
  const juaraById = new Map<number, 1 | 2 | 3>();
  for (const arr of Object.values(juaraMap)) {
    for (const j of arr) juaraById.set(j.pendaftarId, j.juaraRank);
  }

  // Build per-kategori sections with pendaftar (sorted by umur ASC) + juara
  // Only include kategori that are eligible for this lomba
  const sections = (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [])
    .map((kid) => {
      const kat = katMap.get(kid);
      if (!kat) return null;
      const inKategori = pendaftar
        .filter((p) => p.kategoriId === kid)
        // Sort by umur ASC, then by nomor as tiebreaker (stable display)
        .sort((a, b) => a.umur - b.umur || a.nomor.localeCompare(b.nomor))
        .map<PendaftarWithJuara>((p) => ({
          id: p.id,
          nomor: p.nomor,
          nama: p.nama,
          umur: p.umur,
          jenisKelamin: p.jenisKelamin,
          juaraRank: juaraById.get(p.id) ?? null,
        }));
      return {
        kategoriId: kid,
        kategoriNama: kat.nama,
        kategoriIcon: kat.icon,
        kategoriColorBg: kat.colorBg,
        kategoriColorText: kat.colorText,
        kategoriColorBorder: kat.colorBorder,
        ageRange: kat.max >= 999 ? `${kat.min}+ tahun` : `${kat.min}–${kat.max} tahun`,
        pendaftar: inKategori,
      };
    })
    .filter(Boolean) as Array<{
    kategoriId: string;
    kategoriNama: string;
    kategoriIcon: string;
    kategoriColorBg: string;
    kategoriColorText: string;
    kategoriColorBorder: string;
    ageRange: string;
    pendaftar: PendaftarWithJuara[];
  }>;

  return (
    <AdminShell
      title={`Juara — ${l.nama}`}
      breadcrumb={`Manajemen Lomba / ${l.nama} / Juara`}
      activeNav="/admin/lomba"
    >
      <JuaraClient
        lomba={{
          id: l.id,
          nama: l.nama,
          emoji: l.emoji,
          status: l.status,
        }}
        sections={sections}
        readiness={readiness}
      />
    </AdminShell>
  );
}
