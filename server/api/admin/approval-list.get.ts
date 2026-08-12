// GET /api/admin/approval-list — pendaftar grouped + lomba/kategori for filter
import { defineEventHandler } from "h3";
import { requireAuth } from "~~/server/utils/auth";
import { getPendaftar } from "~~/server/utils/db/pendaftar";
import { getLomba } from "~~/server/utils/db/lomba";
import { getKategori } from "~~/server/utils/db/kategori";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const [all, lombaAll, kats] = await Promise.all([getPendaftar(), getLomba(true), getKategori()]);
  const katMap = new Map(kats.map((k) => [k.id, k]));
  const lombaMap = new Map(lombaAll.map((l) => [l.id, l]));
  // Approval queue is only for PENDING pendaftar — once approved/rejected,
  // they should fall out of the queue so admin doesn't re-approve them by
  // accident. Filter at the API boundary so the page never has to.
  const items = all
    .filter((p) => p.status === "pending")
    .map((p) => {
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
