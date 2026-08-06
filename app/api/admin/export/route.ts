import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getLomba, getPendaftar, getKategori } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

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

  const wb = new ExcelJS.Workbook();
  wb.creator = "Lomba Kampung";
  wb.created = new Date();

  // =================== Sheet 1: Lomba ===================
  const wsLomba = wb.addWorksheet("Lomba", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
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

  // =================== Sheet 2: Peserta ===================
  const wsPeserta = wb.addWorksheet("Peserta", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  wsPeserta.columns = [
    { header: "Nomor", key: "nomor", width: 14 },
    { header: "Nama", key: "nama", width: 28 },
    { header: "No WA", key: "noWa", width: 16 },
    { header: "Jenis Kelamin", key: "jk", width: 14 },
    { header: "Kategori", key: "kategori", width: 14 },
    { header: "Umur", key: "umur", width: 7 },
    { header: "Lomba", key: "lomba", width: 28 },
    { header: "Status", key: "status", width: 12 },
    { header: "Hadir", key: "hadir", width: 8 },
    { header: "Sumber", key: "sumber", width: 10 },
    { header: "Tanggal Daftar", key: "tanggal", width: 22 },
  ];
  for (const p of pendaftar) {
    const l = lombaList.find((ll) => ll.id === p.lombaId);
    wsPeserta.addRow({
      nomor: p.nomor,
      nama: p.nama,
      noWa: p.noWa || "",
      jk: p.jenisKelamin === "L" ? "Laki-laki" : "Perempuan",
      kategori: katMap.get(p.kategoriId)?.nama || p.kategoriId,
      umur: p.umur,
      lomba: l?.nama || "",
      status: p.status,
      hadir: p.hadir ? "Ya" : "Tidak",
      sumber: p.sumber,
      tanggal: new Date(p.createdAt * 1000).toISOString(),
    });
  }

  // =================== Sheet 3: Kategori ===================
  const wsKat = wb.addWorksheet("Kategori", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  wsKat.columns = [
    { header: "ID", key: "id", width: 12 },
    { header: "Nama", key: "nama", width: 24 },
    { header: "Umur Min", key: "min", width: 10 },
    { header: "Umur Max", key: "max", width: 10 },
    { header: "Urutan", key: "urutan", width: 8 },
    { header: "Icon", key: "icon", width: 12 },
  ];
  for (const k of kats) {
    wsKat.addRow({
      id: k.id,
      nama: k.nama,
      min: k.min,
      max: k.max,
      urutan: k.urutan,
      icon: k.icon,
    });
  }

  // =================== Style header rows ===================
  for (const ws of [wsLomba, wsPeserta, wsKat]) {
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE11D1D" }, // lomba red/pink
    };
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
  // ArrayBuffer → Uint8Array for NextResponse body (works on Node runtime)
  const body = new Uint8Array(buffer as ArrayBuffer);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lomba-export-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
