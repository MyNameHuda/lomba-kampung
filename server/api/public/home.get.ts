// GET /api/public/home — data needed by the public home page (lomba list + kategori + settings + admin status).
import { defineEventHandler } from "h3";
import { isAuthenticated } from "~~/server/utils/auth";
import { getLomba } from "~~/server/utils/db/lomba";
import { getKategori } from "~~/server/utils/db/kategori";
import { getSettings } from "~~/server/utils/db/settings";
import { countPendaftarByLomba } from "~~/server/utils/db/pendaftar";

export default defineEventHandler(async (event) => {
  const [rows, kats, cfg, isAdmin] = await Promise.all([
    getLomba(true),
    getKategori(),
    getSettings(),
    isAuthenticated(event),
  ]);

  const countsArr = await Promise.all(rows.map((l) => countPendaftarByLomba(l.id, "disetujui")));
  const countByLomba = new Map(countsArr.map((c, i) => [rows[i].id, c]));

  const lomba = rows.map((l) => ({
    id: l.id,
    nama: l.nama,
    emoji: l.emoji,
    deskripsi: l.deskripsi,
    kategoriEligible: Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [],
    count: countByLomba.get(l.id) ?? 0,
    pendaftaranDibuka: l.pendaftaranDibuka,
    jadwalByKategori: l.jadwalByKategori || {},
  }));

  return {
    lomba,
    kategori: kats.map((k) => ({
      id: k.id,
      nama: k.nama,
      icon: k.icon,
      min: k.min,
      max: k.max,
      urutan: k.urutan,
      autoAge: k.autoAge,
      colorBg: k.colorBg,
      colorText: k.colorText,
      colorBorder: k.colorBorder,
    })),
    cfg: {
      appName: cfg?.appName || "Lomba Kampung",
      kampungName: cfg?.kampungName || "Kampung Kadu Jaya",
      tahunAktif: cfg?.tahunAktif || "HUT RI ke-81 (2026)",
    },
    isAdmin,
  };
});
