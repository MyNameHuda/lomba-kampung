// GET /api/admin/approval-list — pending pendaftar only (filtered in SQL, not JS)
import { defineEventHandler } from "h3";
import { requireAuth } from "~~/server/utils/auth";
import { getPendaftarByStatus } from "~~/server/utils/db/pendaftar";
import { getLomba } from "~~/server/utils/db/lomba";
import { getKategori } from "~~/server/utils/db/kategori";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  // Filter `status = 'pending'` at SQL level — was loading ALL pendaftar rows
  // and filtering in JS. With many disetujui rows, the old code wasted bandwidth
  // + JSON serialization time on rows we'd throw away.
  const [pending, lombaAll, kats] = await Promise.all([
    getPendaftarByStatus("pending"),
    getLomba(true),
    getKategori(),
  ]);
  const katMap = new Map(kats.map((k) => [k.id, k]));
  const lombaMap = new Map(lombaAll.map((l) => [l.id, l]));
  const items = pending.map((p) => {
    const l = lombaMap.get(p.lombaId);
    const k = katMap.get(p.kategoriId);
    return {
      id: p.id, nomor: p.nomor, nama: p.nama,
      status: p.status as "pending" | "disetujui" | "ditolak",
      lombaId: p.lombaId,
      lombaNama: l?.nama || "",
      lombaEmoji: l?.emoji || "",
      kategoriNama: k?.nama || p.kategoriId,
      kategoriColor: k?.colorBorder || "#E5E7EB",
      jenisKelamin: p.jenisKelamin, umur: p.umur,
      createdAt: p.createdAt,
    };
  });
  return {
    items,
    kats: kats.map((k) => ({ id: k.id, nama: k.nama, colorBorder: k.colorBorder })),
    lomba: lombaAll.map((l) => ({ id: l.id, nama: l.nama, emoji: l.emoji })),
  };
});
