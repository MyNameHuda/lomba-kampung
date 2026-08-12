import { defineEventHandler, createError, getRouterParam, setHeader } from "h3";
// GET /api/admin/peserta-excel/[lombaId]
// Admin-only per-lomba export. Reuses the public Excel layout, but:
//   - requireAuth (admin session)
//   - filter to `disetujui` only — pending/ditolak are managed exclusively
//     via /admin/approval and never appear in the exported Excel.
//     (Matches the admin UI filter for peserta pages and Manajemen Lomba
//     count; matches /api/admin/peserta-excel for the all-lomba summary.)
import ExcelJS from "exceljs";
import { requireAuth } from "~~/server/utils/auth";
import { getLombaById } from "~~/server/utils/db/lomba";
import { getKategori } from "~~/server/utils/db/kategori";
import { getPendaftarByLomba } from "~~/server/utils/db/pendaftar";
import { type Kategori, type Lomba } from "~~/server/utils/db/types";
import { toPesertaRow, sortRows, styleSheet, LOMBA_SHEET_SORT } from "~~/server/utils/excel-sort";
import type { PesertaRow } from "~~/server/utils/excel-sort";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const id = Number(getRouterParam(event, "lombaId"));
  if (!Number.isFinite(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "lombaId tidak valid" });
  }
  try {
    const lomba = await getLombaById(id);
    if (!lomba) {
      throw createError({ statusCode: 404, statusMessage: "Lomba tidak ditemukan" });
    }
    const [kats, pendaftar] = await Promise.all([
      getKategori(),
      getPendaftarByLomba(id, "disetujui"),
    ]);

    const katMap = new Map<string, Kategori>(kats.map((k) => [k.id, k]));
    const lombaMap = new Map<number, Lomba>([[lomba.id, lomba]]);

    const wb = new ExcelJS.Workbook();
    wb.creator = "Lomba Kampung Admin";
    wb.created = new Date();

    const rows: PesertaRow[] = pendaftar.map((p) => toPesertaRow(p, katMap, lombaMap));
    rows.sort((a, b) => sortRows(a, b, LOMBA_SHEET_SORT));
    rows.forEach((r, i) => (r.no = i + 1));

    const ws = wb.addWorksheet(lomba.nama.slice(0, 28));
    ws.columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Kategori", key: "kategori", width: 16 },
      { header: "Nama", key: "nama", width: 28 },
      { header: "JK", key: "jk", width: 12 },
      { header: "Umur", key: "umur", width: 8 },
      { header: "Kual", key: "kual", width: 10 },
      { header: "Semi", key: "semi", width: 10 },
      { header: "Juara", key: "juara", width: 10 },
    ];
    for (const r of rows) {
      ws.addRow({
        no: r.no,
        kategori: r.kategori,
        nama: r.nama,
        jk: r.jk,
        umur: r.umur,
        kual: r.kual,
        semi: r.semi,
        juara: r.juara,
      });
    }
    styleSheet(ws);

    const buf = await wb.xlsx.writeBuffer();
    setHeader(event, "Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    setHeader(
      event,
      "Content-Disposition",
      `attachment; filename="${lomba.nama.replace(/[^a-zA-Z0-9]+/g, "-")}-peserta.xlsx"`
    );
    return buf;
  } catch (e) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    const msg = e instanceof Error ? e.message : "Gagal membuat Excel";
    throw createError({ statusCode: 500, statusMessage: msg });
  }
});
