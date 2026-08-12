import { defineEventHandler, createError, setHeader } from "h3";
// GET /api/admin/peserta-excel
// Admin export: 1 sheet per lomba + 1 "Peserta" summary sheet.
// All lomba + pendaftar, with kualifikasi + juara columns.
import ExcelJS from "exceljs";
import { requireAuth } from "~~/server/utils/auth";
import { getLomba } from "~~/server/utils/db/lomba";
import { getKategori } from "~~/server/utils/db/kategori";
import { getPendaftar } from "~~/server/utils/db/pendaftar";
import { type Lomba, type Kategori, type Pendaftar } from "~~/server/utils/db/types";
import { toPesertaRow, sortRows, styleSheet, safeSheetName, LOMBA_SHEET_SORT, PESERTA_SHEET_SORT } from "~~/server/utils/excel-sort";
import type { PesertaRow } from "~~/server/utils/excel-sort";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  try {
    const [lombaAll, kats, allPendaftar] = await Promise.all([
      getLomba(true),
      getKategori(),
      getPendaftar(),
    ]);

    // Admin export filters to `disetujui` only — pending/ditolak are
    // managed exclusively via /admin/approval and never appear in the
    // exported Excel. Matches the admin UI filter (admin peserta pages +
    // Manajemen Lomba count).
    const pendaftar = allPendaftar.filter((p) => p.status === "disetujui");

    const katMap = new Map<string, Kategori>(kats.map((k) => [k.id, k]));
    const lombaMap = new Map<number, Lomba>(lombaAll.map((l) => [l.id, l]));

    const wb = new ExcelJS.Workbook();
    wb.creator = "Lomba Kampung Admin";
    wb.created = new Date();

    // =================== Summary "Peserta" sheet ===================
    const wsSummary = wb.addWorksheet("Peserta");
    const summaryRows: PesertaRow[] = pendaftar.map((p) => toPesertaRow(p, katMap, lombaMap));
    summaryRows.sort((a, b) => sortRows(a, b, PESERTA_SHEET_SORT));
    summaryRows.forEach((r, i) => (r.no = i + 1));
    wsSummary.columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Lomba", key: "namaLomba", width: 30 },
      { header: "Kategori", key: "kategori", width: 16 },
      { header: "Nama", key: "nama", width: 28 },
      { header: "JK", key: "jk", width: 12 },
      { header: "Umur", key: "umur", width: 8 },
      { header: "Kual", key: "kual", width: 10 },
      { header: "Semi", key: "semi", width: 10 },
      { header: "Juara", key: "juara", width: 10 },
    ];
    for (const r of summaryRows) {
      wsSummary.addRow({
        no: r.no, namaLomba: r.namaLomba, kategori: r.kategori,
        nama: r.nama, jk: r.jk, umur: r.umur,
        kual: r.kual, semi: r.semi, juara: r.juara,
      });
    }
    styleSheet(wsSummary);

    // =================== Per-lomba sheet ===================
    const taken = new Set<string>(["peserta"]); // already used by summary
    for (const l of lombaAll) {
      const rows = pendaftar
        .filter((p) => p.lombaId === l.id)
        .map((p) => toPesertaRow(p, katMap, lombaMap));
      rows.sort((a, b) => sortRows(a, b, LOMBA_SHEET_SORT));
      rows.forEach((r, i) => (r.no = i + 1));

      // safeSheetName already imported at the top
      const sheetName = safeSheetName(l.nama, taken);
      const ws = wb.addWorksheet(sheetName);
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
          no: r.no, kategori: r.kategori, nama: r.nama,
          jk: r.jk, umur: r.umur, kual: r.kual, semi: r.semi, juara: r.juara,
        });
      }
      styleSheet(ws);
    }

    const buf = await wb.xlsx.writeBuffer();
    setHeader(event, "Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    setHeader(
      event,
      "Content-Disposition",
      `attachment; filename="peserta-export-${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return buf;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal membuat Excel";
    throw createError({ statusCode: 500, statusMessage: msg });
  }
});
