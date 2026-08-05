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

export type LombaPhase = "kualifikasi" | "final";

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
  // Stage system v3 — kualifikasi phase config (DEPRECATED in v4).
  // Kept for backward compat with existing 6 lomba. Not used in v4 logic
  // (finalis count is now decided per-pendaftar via is_finalist).
  finalisCount: number;
  // Stage system v3 — global lomba phase (DEPRECATED in v4).
  // v4 uses per-kategori kualifikasi_tutup_at (see Lomba.kategoriTutupAt)
  // for granular Tutup. Kept for backward compat only.
  phase: LombaPhase | null;
  // PJ per eligible kategori (keyed by kategoriId). Each kategori has 1+ PJs
  // — the array is the list of penanggung jawab assigned to that kategori.
  // Empty array if lomba has no eligible kategori yet.
  pjByKategori: Record<string, Pj[]>;
  // Stage system v4 — per-kategori Tutup state.
  // Keyed by kategoriId. null = kualifikasi ongoing (admin can still click
  // Loloskan/Gugur). non-null timestamp = Tutup clicked; finalist state
  // locked; admin now picks Juara 1/2/3.
  kategoriTutupAt: Record<string, number | null>;
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
  // Stage system v4 — finalist state for kualifikasi (separate from juaraRank).
  // - isFinalist: tri-state
  //     1 = lolos (advance to final, eligible for Juara 1/2/3)
  //     0 = gugur (eliminated, cannot become Juara)
  //     null = belum diproses (pending admin decision)
  //   Replaces v3's reuse of juara_rank for kualifikasi slot.
  // - juaraRank: Juara 1/2/3 within (lomba, kategori), set in final phase only.
  //   At most 1 Juara per rank per (lomba, kategori). NULL = not picked yet.
  isFinalist: 0 | 1 | null;
  juaraRank: 1 | 2 | 3 | null;
  createdAt: number;
  updatedAt: number;
};

// Per-kategori state inside a lomba (lomba_kategori table).
// v4 adds kualifikasiTutupAt — independent Tutup per kategori.
export type LombaKategori = {
  lombaId: number;
  kategoriId: string;
  pjNama: string;
  pjKontak: string | null;
  urutan: number;
  // Stage system v4 — per-kategori kualifikasi Tutup timestamp.
  // null = kualifikasi ongoing for this (lomba, kategori). Admin can still
  //   click Loloskan/Gugur.
  // non-null = admin clicked Tutup Kualifikasi for this kategori. Finalist
  //   state is locked. Admin now picks Juara 1/2/3 from finalists.
  kualifikasiTutupAt: number | null;
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
