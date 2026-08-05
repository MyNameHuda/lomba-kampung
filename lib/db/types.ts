// Domain types — single source of truth for all DB entity shapes.
// Other modules import these for type safety; no runtime exports here.

export type Settings = {
  id: number;
  appName: string;
  kampungName: string;
  tahunAktif: string;
  adminPasswordHash: string;
  updatedAt: number;
};

export type Kategori = {
  id: string;
  nama: string;
  icon: string;
  min: number;
  max: number;
  urutan: number;
  autoAge: boolean;
  colorBg: string;
  colorText: string;
  colorBorder: string;
  createdAt: number;
};

export type LombaStatus = "draft" | "aktif" | "selesai";
export type PendaftarStatus = "pending" | "disetujui" | "ditolak";
export type SumberPendaftaran = "publik" | "manual";
export type JenisKelamin = "L" | "P";

export type Pj = { nama: string; kontak: string | null };

export type Lomba = {
  id: number;
  nama: string;
  emoji: string;
  deskripsi: string | null;
  syarat: string[];
  kategoriEligible: string[];
  status: LombaStatus;
  urutan: number;
  createdAt: number;
  // PJ per eligible kategori (keyed by kategoriId). Each kategori has 1+ PJs
  // — the array is the list of penanggung jawab assigned to that kategori.
  // Empty array if lomba has no eligible kategori yet.
  pjByKategori: Record<string, Pj[]>;
};

export type LombaKategoriInput = {
  kategoriId: string;
  pjNama: string;
  pjKontak: string | null;
};

export type Pendaftar = {
  id: number;
  nomor: string;
  nama: string;
  noWa: string | null;
  jenisKelamin: JenisKelamin;
  kategoriId: string;
  umur: number;
  lombaId: number;
  status: PendaftarStatus;
  alasanTolak: string | null;
  sumber: SumberPendaftaran;
  hadir: boolean;
  // Juara 1/2/3 within (lomba, kategori). NULL = not picked.
  // Enforced: at most 1 Juara per rank per (lomba, kategori).
  juaraRank: 1 | 2 | 3 | null;
  createdAt: number;
  updatedAt: number;
};

// Public display grouping (Balita / Anak L / Anak P / Dewasa) — derived
// from master `kategori` table (single source of truth). Range and title
// auto-derived from kategori rows; section assignment based on `min` field.
export type DisplaySectionKey = "balita" | "anakL" | "anakP" | "dewasa";
export type DisplaySection = {
  key: DisplaySectionKey;
  title: string;
  rangeLabel: string; // e.g. "0–4 tahun", "5–17 tahun", "18+ tahun"
  peserta: Array<{ nama: string; umur: number; jenisKelamin: JenisKelamin }>;
};
