// Shared client-side types — used across multiple components.
// Slim shapes derived from DB types for props passed to Client Components.

// =================== Slim domain types ===================
// Pass only what Client Components need — don't ship full DB rows over
// the server/client boundary when 5 fields suffice.

export type KategoriSlim = {
  id: string;
  nama: string;
  icon?: string;
  min?: number;
  max?: number;
  urutan?: number;
  autoAge?: boolean;
  // Per-kategori color palette (DB-driven, admin-editable)
  colorBg?: string;
  colorText?: string;
  colorBorder?: string;
};

export type LombaSlim = {
  id: number;
  nama: string;
  emoji: string;
  deskripsi?: string | null;
  kategoriEligible: string[];
  // Optional: only present when the page also passes pendaftar counts
  count?: number;
  // Whether public registration is open. Always present from server.
  // Admin can toggle off; admin input-manual always works regardless.
  pendaftaranDibuka?: boolean;
  // Per-kategori execution date (jadwal). Server-side loaded from
  // `lomba_jadwal` table via loadJadwalBulk. Absent key = no jadwal set.
  jadwalByKategori?: Record<string, {
    kategoriId: string;
    tanggal: number | null;
    jam: string | null;
  }>;
};

export type PesertaSlim = {
  id: number;
  nomor: string;
  nama: string;
  noWa: string | null;
  umur: number;
  jenisKelamin: "L" | "P";
  kategoriId: string;
  kategori: string;
  hadir: boolean;
};

// Used for the Edit form dropdown in /admin/peserta/[lombaId]
export type EligibleKategori = { id: string; nama: string; min: number; max: number };

// PJ entry (one item in the per-kategori PJ list)
export type Pj = { nama: string; kontak: string | null };

// Map of kategoriId → PJs (e.g. k_balita → 2 PJs)
export type PjByKategori = Record<string, Pj[]>;

// =================== UI config ===================
// Display section keys (matches the GROUP BY in pendaftar.ts)
export type AdminGroupKey = "balita" | "anakL" | "anakP" | "dewasa";

export type AdminGroupData = Record<AdminGroupKey, PesertaSlim[]>;

export type AdminSection = {
  key: AdminGroupKey;
  title: string;
  rangeLabel: string;
};

// Pj input shape (matches the API request body)
export type PjInput = { kategoriId: string; pjNama: string; pjKontak: string | null };
