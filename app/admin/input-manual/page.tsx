import AdminShell from "@/components/admin-shell";
import InputManualClient from "./input-manual-client";
import { getLomba, getKategori, getPendaftar } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Display-collapse key for k_anak_l + k_anak_p so the "same kategori"
// match treats them as one bucket. Mirrors the client-side
// ANAK_COLLAPSED_ID used by the picker — duplicated here because the
// client constant is module-private.
const ANAK_COLLAPSED_ID = "_anak_collapsed";
const displayKatId = (id: string) =>
  id === "k_anak_l" || id === "k_anak_p" ? ANAK_COLLAPSED_ID : id;

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

  // Count of "disetujui" pendaftar per lomba (used for the source
  // picker + the per-lomba peserta list builder below).
  const countByLomba: Record<number, number> = {};
  for (const p of allPendaftar) {
    if (p.status === "ditolak") continue;
    countByLomba[p.lombaId] = (countByLomba[p.lombaId] ?? 0) + 1;
  }

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

  // Pre-compute eligible source lomba for every lomba. "Eligible" =
  // another lomba that shares at least one display-kategori (with
  // k_anak_l + k_anak_p collapsed) AND has at least 1 active peserta.
  // The client uses this for the "Salin dari Lomba Lain" picker.
  //
  // Pre-computing on the server (instead of in the client) keeps the
  // client bundle smaller and avoids re-deriving on every render.
  const sourceByLomba: Record<number, Array<{
    id: number;
    nama: string;
    emoji: string;
    count: number;
    sharedKategori: string[]; // display-kategori ids that overlap
  }>> = {};

  for (const target of lomList) {
    const targetKeys = new Set(target.kategoriEligible.map(displayKatId));
    const sources: Array<{ id: number; nama: string; emoji: string; count: number; sharedKategori: string[] }> = [];
    for (const candidate of lomList) {
      if (candidate.id === target.id) continue;
      const cKeys = candidate.kategoriEligible.map(displayKatId);
      const shared = cKeys.filter((k) => targetKeys.has(k));
      if (shared.length === 0) continue;
      const count = countByLomba[candidate.id] ?? 0;
      if (count === 0) continue;
      sources.push({
        id: candidate.id,
        nama: candidate.nama,
        emoji: candidate.emoji,
        count,
        sharedKategori: shared,
      });
    }
    // Sort by count DESC so the most-populated source comes first
    // (admin's most likely choice).
    sources.sort((a, b) => b.count - a.count || a.nama.localeCompare(b.nama, "id"));
    sourceByLomba[target.id] = sources;
  }

  return (
    <AdminShell title="Input Peserta Manual" breadcrumb="Input Manual" activeNav="/admin/input-manual">
      <InputManualClient
        lombaList={lomList}
        kats={kats}
        pesertaByLomba={pesertaByLomba}
        sourceByLomba={sourceByLomba}
      />
    </AdminShell>
  );
}
