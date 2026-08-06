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
  // Stage system v3 — kualifikasi phase config (DEPRECATED in v4).
  // Kept for backward compat with existing 6 lomba. Not used in v4 logic
  // (finalis count is now decided per-pendaftar via is_finalist).
  finalisCount: number;
  // Stage system v4 — JSON-encoded per-kategori Tutup state stored in
  // lomba.phase column (TEXT). Schema: `{ "k_anak": 1750000000, "k_remaja": null }`.
  //
  // Why a JSON column instead of a new column on lomba_kategori? Because
  // the libSQL HTTP client in Vercel Lambda has a per-connection schema
  // cache that does NOT refresh after ALTER. So any ALTER'd column on an
  // existing table would race — some Lambdas see the column, others don't.
  // By using the existing lomba.phase column (added in v3, fully replicated
  // to all replicas), we get writes that always succeed.
  //
  // Parsed via `parseLombaKategoriTutup()`. Empty string or null = empty map.
  // Keyed by kategoriId. null = kualifikasi ongoing; non-null = Tutup at that
  // timestamp; absent key = kualifikasi ongoing.
  phase: string | null;
  // PJ per eligible kategori (keyed by kategoriId). Each kategori has 1+ PJs
  // — the array is the list of penanggung jawab assigned to that kategori.
  // Empty array if lomba has no eligible kategori yet.
  pjByKategori: Record<string, Pj[]>;
  // Stage system v4 — per-kategori Tutup state, derived from lomba.phase JSON.
  // Keyed by kategoriId. null/absent = kualifikasi ongoing; non-null = Tutup
  // timestamp. Populated by `attachKategoriTutup` in lib/db/lomba.ts.
  kategoriTutupAt: Record<string, number | null>;
  // Jadwal pelaksanaan (per-kategori execution date). Populated by
  // `attachJadwal` in lib/db/lomba.ts from `lomba_jadwal` table.
  // Absent key = no jadwal set for that kategori.
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

// Per-kategori Tutup state was previously tracked via a kualifikasi_tutup_at
// column on lomba_kategori (added in v4 schema). That column had a
// libSQL HTTP schema-cache race that made updates intermittently fail on
// some Lambda instances. We now store this state as a JSON object in
// lomba.phase instead — see Lomba.phase above for the rationale.

// Jadwal pelaksanaan (execution schedule) per (lomba, kategori).
// Stored in `lomba_jadwal` table — composite PK (lomba_id, kategori_id).
// Tanggal is unix seconds (start of day in app's timezone). jam is HH:MM string.
export type JadwalPelaksanaan = {
  lombaId: number;
  kategoriId: string;
  tanggal: number | null; // unix seconds, start of day
  jam: string | null;      // "HH:MM" or null
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
