import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getLomba, getPendaftar, getKategori } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import type { Pendaftar } from "@/lib/db/types";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [lombaList, pendaftar, kats] = await Promise.all([
    getLomba(true),
    getPendaftar(),
    getKategori(),
  ]);
  const katMap = new Map(kats.map((k) => [k.id, k]));
  const lombaMap = new Map(lombaList.map((l) => [l.id, l]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Lomba Kampung";
  wb.created = new Date();

  // =================== Sheet 1: Lomba ===================
  const wsLomba = wb.addWorksheet("Lomba", { views: [{ state: "frozen", ySplit: 1 }] });
  wsLomba.columns = [
    { header: "ID", key: "id", width: 6 },
    { header: "Nama", key: "nama", width: 32 },
    { header: "Emoji", key: "emoji", width: 8 },
    { header: "Deskripsi", key: "deskripsi", width: 40 },
    { header: "Status", key: "status", width: 10 },
    { header: "Urutan", key: "urutan", width: 8 },
    { header: "Kategori Eligible", key: "kategoriEligible", width: 30 },
    { header: "Syarat", key: "syarat", width: 30 },
    { header: "PJ per Kategori", key: "pj", width: 50 },
  ];
  for (const l of lombaList) {
    const pjLines = Object.entries(l.pjByKategori || {}).map(([katId, pjList]) => {
      const kat = katMap.get(katId);
      const names = (pjList || []).map((p) => (p.kontak ? `${p.nama} (${p.kontak})` : p.nama)).join(", ");
      return `${kat?.nama || katId}: ${names}`;
    });
    wsLomba.addRow({
      id: l.id,
      nama: l.nama,
      emoji: l.emoji,
      deskripsi: l.deskripsi || "",
      status: l.status,
      urutan: l.urutan,
      kategoriEligible: (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [])
        .map((k) => katMap.get(k)?.nama)
        .filter(Boolean)
        .join("; "),
      syarat: (l.syarat || []).join("; "),
      pj: pjLines.join(" | ") || "—",
    });
  }

  // =================== Peserta-derived sheets ===================
  // Column shape reused across Peserta, Gugur Kualifikasi, Finalis, Gugur Final
  type Row = {
    nomor: string;
    nama: string;
    noWa: string;
    jk: string;
    kategori: string;
    umur: number;
    lomba: string;
    status: string;
    finalist: string;
    juara: string;
    sumber: string;
    tanggal: string;
  };
  const pesertaColumns: Array<{ header: string; key: keyof Row; width: number }> = [
    { header: "Nomor", key: "nomor", width: 14 },
    { header: "Nama", key: "nama", width: 28 },
    { header: "No WA", key: "noWa", width: 16 },
    { header: "Jenis Kelamin", key: "jk", width: 14 },
    { header: "Kategori", key: "kategori", width: 14 },
    { header: "Umur", key: "umur", width: 7 },
    { header: "Lomba", key: "lomba", width: 28 },
    { header: "Status", key: "status", width: 12 },
    { header: "Finalist", key: "finalist", width: 11 },
    { header: "Juara", key: "juara", width: 11 },
    { header: "Sumber", key: "sumber", width: 10 },
    { header: "Tanggal Daftar", key: "tanggal", width: 22 },
  ];

  function toRow(p: Pendaftar): Row {
    const l = lombaMap.get(p.lombaId);
    return {
      nomor: p.nomor,
      nama: p.nama,
      noWa: p.noWa || "",
      jk: p.jenisKelamin === "L" ? "Laki-laki" : "Perempuan",
      kategori: katMap.get(p.kategoriId)?.nama || p.kategoriId,
      umur: p.umur,
      lomba: l?.nama || "",
      status: p.status,
      finalist: p.isFinalist === 1 ? "Lolos" : p.isFinalist === 0 ? "Gugur" : "Pending",
      juara: p.juaraRank ? `Juara ${p.juaraRank}` : "",
      sumber: p.sumber,
      tanggal: new Date(p.createdAt * 1000).toISOString(),
    };
  }

  function addPesertaSheet(name: string, filter: (p: Pendaftar) => boolean) {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = pesertaColumns;
    for (const p of pendaftar) {
      if (filter(p)) ws.addRow(toRow(p));
    }
  }

  // Sheet 2: Peserta (semua)
  addPesertaSheet("Peserta", () => true);

  // Sheet 3: Gugur Kualifikasi — is_finalist=0 (admin klik Gugur saat kualifikasi)
  addPesertaSheet("Gugur Kualifikasi", (p) => p.isFinalist === 0);

  // Sheet 4: Finalis — lolos kualifikasi (is_finalist=1), termasuk yang jadi Juara
  addPesertaSheet("Finalis", (p) => p.isFinalist === 1);

  // Sheet 5: Gugur Final — finalist tapi gak jadi Juara (is_finalist=1, juara_rank NULL)
  addPesertaSheet("Gugur Final", (p) => p.isFinalist === 1 && p.juaraRank === null);

  // Sheet 6: Juara — Juara 1/2/3 per (lomba, kategori)
  const wsJuara = wb.addWorksheet("Juara", { views: [{ state: "frozen", ySplit: 1 }] });
  wsJuara.columns = [
    { header: "Rank", key: "rank", width: 8 },
    { header: "Nomor", key: "nomor", width: 14 },
    { header: "Nama", key: "nama", width: 28 },
    { header: "Jenis Kelamin", key: "jk", width: 14 },
    { header: "Kategori", key: "kategori", width: 14 },
    { header: "Umur", key: "umur", width: 7 },
    { header: "Lomba", key: "lomba", width: 28 },
    { header: "Tanggal Daftar", key: "tanggal", width: 22 },
  ];
  for (const p of pendaftar) {
    if (p.juaraRank !== null) {
      const l = lombaMap.get(p.lombaId);
      wsJuara.addRow({
        rank: p.juaraRank,
        nomor: p.nomor,
        nama: p.nama,
        jk: p.jenisKelamin === "L" ? "Laki-laki" : "Perempuan",
        kategori: katMap.get(p.kategoriId)?.nama || p.kategoriId,
        umur: p.umur,
        lomba: l?.nama || "",
        tanggal: new Date(p.createdAt * 1000).toISOString(),
      });
    }
  }

  // =================== Style header rows ===================
  const allSheets = [wsLomba, ...wb.worksheets.filter((w) => w.name !== "Lomba")];
  for (const ws of allSheets) {
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE11D1D" } };
    header.alignment = { vertical: "middle", horizontal: "left" };
    header.height = 22;
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const body = new Uint8Array(buffer as ArrayBuffer);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lomba-export-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
