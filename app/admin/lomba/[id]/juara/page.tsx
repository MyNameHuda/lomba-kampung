// Juara picker page for stage system v4.
// Admin flow (per-kategori, independent):
//  1. Default (kualifikasi phase, per kategori):
//     - Each tab = 1 kategori
//     - Admin clicks Loloskan/Gugur per pendaftar
//     - Admin clicks "Tutup Kualifikasi" per kategori (locks is_finalist, enables Juara picker)
//  2. Final phase (per kategori, after Tutup):
//     - Admin picks Juara 1/2/3 from finalists
//     - Admin can "Buka Kualifikasi" to re-edit finalists (only if no Juara picked)
//  3. Selesai (lomba-level): all eligible kategori have Juara 1+2
//  4. status='selesai' → view-only display
import AdminShell from "@/components/admin-shell";
import JuaraClient, { type PendaftarWithJuara } from "./juara-client";
import {
  getLombaById,
  getPendaftarByLomba,
  getKategori,
  getJuaraByLomba,
  getJuaraReadiness,
  getLombaKualifikasiStatus,
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

  // Parallelize: pendaftar, kategori, juara, readiness, kualifikasi status
  const [pendaftar, kats, juaraMap, readiness, kualStatus] = await Promise.all([
    getPendaftarByLomba(lombaId, "disetujui"),
    getKategori(),
    getJuaraByLomba(lombaId),
    getJuaraReadiness(lombaId),
    getLombaKualifikasiStatus(
      lombaId,
      Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [],
      l.kategoriTutupAt || {}
    ),
  ]);
  const katMap = new Map(kats.map((k) => [k.id, k]));

  // Build a quick lookup: pendaftarId → Juara rank
  const juaraById = new Map<number, number>();
  for (const arr of Object.values(juaraMap)) {
    for (const j of arr) juaraById.set(j.pendaftarId, j.juaraRank);
  }

  // Build per-kategori sections with pendaftar (sorted by umur ASC) + Juara
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
          isFinalist: p.isFinalist,
          juaraRank: (juaraById.get(p.id) as 1 | 2 | 3 | undefined) ?? null,
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
        kualStatus: kualStatus.perKategori[kid] || { lolos: 0, gugur: 0, pending: 0, total: 0, readyToTutup: false },
        tutupAt: l.kategoriTutupAt?.[kid] ?? null,
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
    kualStatus: { lolos: number; gugur: number; pending: number; total: number; readyToTutup: boolean };
    tutupAt: number | null;
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

