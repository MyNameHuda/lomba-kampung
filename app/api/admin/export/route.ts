import { NextResponse } from "next/server";
import { getLomba, getPendaftar, getKategori } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

// Simple Excel-compatible CSV export (UTF-8 with BOM, comma-separated, RFC 4180 quoting)
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h])).join(","));
  }
  return lines.join("\r\n");
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lomList = await getLomba(true);
  const pendaftar = await getPendaftar();
  const kats = await getKategori();
  const katMap = new Map(kats.map((k) => [k.id, k]));

  const lombaRows = lomList.map((l) => {
    // Build PJ list per kategori — multiple PJs per kategori allowed.
    // Format: "Kategori: PJ1 (kontak), PJ2 (kontak)"
    const pjLines = Object.entries(l.pjByKategori || {}).map(([katId, pjList]) => {
      const kat = katMap.get(katId);
      const names = (pjList || []).map((p) => p.kontak ? `${p.nama} (${p.kontak})` : p.nama).join(", ");
      return `${kat?.nama || katId}: ${names}`;
    });
    return {
      ID: l.id,
      Nama: l.nama,
      Emoji: l.emoji,
      Deskripsi: l.deskripsi || "",
      "PJ per Kategori": pjLines.join(" | ") || "—",
      Status: l.status,
      Urutan: l.urutan,
      "Kategori Eligible": (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : []).map((k) => katMap.get(k)?.nama).filter(Boolean).join("; "),
      "Syarat": (l.syarat || []).join("; "),
    };
  });

  const pesertaRows = pendaftar.map((p) => {
    const l = lomList.find((ll) => ll.id === p.lombaId);
    return {
      Nomor: p.nomor,
      Nama: p.nama,
      "No WA": p.noWa || "",
      "Jenis Kelamin": p.jenisKelamin === "L" ? "Laki-laki" : "Perempuan",
      Kategori: katMap.get(p.kategoriId)?.nama || p.kategoriId,
      Umur: p.umur,
      Lomba: l?.nama || "",
      Status: p.status,
      Hadir: p.hadir ? "Ya" : "Tidak",
      Sumber: p.sumber,
      "Tanggal Daftar": new Date(p.createdAt * 1000).toISOString(),
    };
  });

  // CSV with UTF-8 BOM for Excel
  const bom = "\uFEFF";
  const csv = bom + toCsv(lombaRows) + "\r\n\r\n--- PESERTA ---\r\n\r\n" + toCsv(pesertaRows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lomba-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
