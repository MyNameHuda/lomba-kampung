// Shared Excel helpers — used by:
//   - /api/admin/peserta-excel (admin: all lomba, summary + 1 sheet/lomba)
//   - /api/admin/peserta-excel/[lombaId] (admin: single-lomba, 1 sheet)
//
// Both admin endpoints filter to `disetujui` only — pending/ditolak are
// managed via /admin/approval and never appear in the Excel.
//
// Server-only (lives in server/utils/ — auto-imported into server context).
// Vue/Nuxt port of lib/excel-sort.ts. Kept the row shape + sort weights
// + Excel styling identical so both admin exports always match.
import ExcelJS from "exceljs";
import type { Lomba, Pendaftar } from "./db/types";

export const KUAL_SORT: Record<string, number> = { Gugur: 0, Lolos: 1, "": 2 };
export const JUARA_SORT: Record<string, number> = {
  "Juara 1": 0,
  "Juara 2": 1,
  "Juara 3": 2,
  "": 3,
};

export type PesertaRow = {
  no: number;
  namaLomba: string;
  kategori: string;
  nama: string;
  jk: string;
  umur: number;
  kual: string;
  kualSort: number;
  semi: string;
  semiSort: number;
  juara: string;
  juaraSort: number;
};

export function toPesertaRow(
  p: Pendaftar,
  katMap: Map<string, { nama: string }>,
  lombaMap: Map<number, Lomba>
): PesertaRow {
  const l = lombaMap.get(p.lombaId);
  const kat = katMap.get(p.kategoriId);
  const kual = p.isFinalist === 1 ? "Lolos" : p.isFinalist === 0 ? "Gugur" : "";

  const kualLolos = p.isFinalist === 1;
  const semi = !kualLolos
    ? ""
    : p.isSemiFinalist === 1
      ? "Lolos"
      : p.isSemiFinalist === 0
        ? "Gugur"
        : "";

  const semiLolos = kualLolos && p.isSemiFinalist === 1;
  const legacyJuara = p.isFinalist === null && p.juaraRank !== null;
  const juara =
    semiLolos || legacyJuara
      ? p.juaraRank === 1 ? "Juara 1"
        : p.juaraRank === 2 ? "Juara 2"
        : p.juaraRank === 3 ? "Juara 3"
        : ""
      : "";

  return {
    no: 0,
    namaLomba: l?.nama || "",
    kategori: kat?.nama || p.kategoriId,
    nama: p.nama,
    jk: p.jenisKelamin === "L" ? "Laki-laki" : "Perempuan",
    umur: p.umur,
    kual,
    kualSort: KUAL_SORT[kual],
    semi,
    semiSort: KUAL_SORT[semi],
    juara,
    juaraSort: JUARA_SORT[juara],
  };
}

export function sortRows(a: PesertaRow, b: PesertaRow, keys: ReadonlyArray<keyof PesertaRow>): number {
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    if (typeof av === "number" && typeof bv === "number") {
      if (av !== bv) return av - bv;
    } else {
      const c = String(av).localeCompare(String(bv), "id", { numeric: true });
      if (c !== 0) return c;
    }
  }
  return 0;
}

export const LOMBA_SHEET_SORT: ReadonlyArray<keyof PesertaRow> = [
  "kategori", "jk", "umur", "kualSort", "semiSort", "juaraSort", "nama",
];
export const PESERTA_SHEET_SORT: ReadonlyArray<keyof PesertaRow> = [
  "namaLomba", "kategori", "jk", "umur", "kualSort", "semiSort", "juaraSort", "nama",
];

export function safeSheetName(raw: string, taken: Set<string>): string {
  const FORBIDDEN = /[\[\]:*?/\\]/g;
  let s = raw.replace(FORBIDDEN, "").trim() || "Sheet";
  s = s.replace(FORBIDDEN, "").trim() || "Sheet";
  if (s.length > 31) s = s.slice(0, 31).replace(FORBIDDEN, "").trim() || "Sheet";
  let candidate = s;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    const suffix = `.${n}`;
    candidate = (s.slice(0, Math.max(1, 31 - suffix.length)) + suffix)
      .replace(FORBIDDEN, "")
      .trim();
    n++;
  }
  if (!candidate) candidate = `Sheet${taken.size + 1}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

export function styleSheet(ws: ExcelJS.Worksheet) {
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
