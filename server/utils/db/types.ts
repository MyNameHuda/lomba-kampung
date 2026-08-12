// Domain types — single source of truth for all DB entity shapes.
// Server-only (lives in server/utils/db/). Vue components consume the
// slim shapes from ~/utils/types.ts instead.

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
  inputMode: "button" | "field";
  colorBg: string;
  colorText: string;
  colorBorder: string;
  createdAt: number;
};

type LombaStatus = "draft" | "aktif" | "selesai";
export type PendaftarStatus = "pending" | "disetujui" | "ditolak";
type SumberPendaftaran = "publik" | "manual";
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
  pendaftaranDibuka: boolean;
  faseEnabled: boolean;
  finalisCount: number;
  phase: string | null;
  pjByKategori: Record<string, Pj[]>;
  kategoriTutupAt: {
    kual: Record<string, number | null>;
    semi: Record<string, number | null>;
  };
  jadwalByKategori: Record<string, {
    kategoriId: string;
    tanggal: number | null;
    jam: string | null;
  }>;
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
  jenisKelamin: JenisKelamin;
  kategoriId: string;
  umur: number;
  lombaId: number;
  status: PendaftarStatus;
  alasanTolak: string | null;
  sumber: SumberPendaftaran;
  hadir: boolean;
  isFinalist: 0 | 1 | null;
  isSemiFinalist: 0 | 1 | null;
  juaraRank: 1 | 2 | 3 | null;
  createdAt: number;
  updatedAt: number;
};

type DisplaySectionKey = "balita" | "anakL" | "anakP" | "dewasa";
export type DisplaySection = {
  key: DisplaySectionKey;
  title: string;
  rangeLabel: string;
  peserta: Array<{ nama: string; umur: number; jenisKelamin: JenisKelamin; kategoriId: string }>;
};
