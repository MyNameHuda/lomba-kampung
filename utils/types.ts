// Shared client+server types — used across multiple components.
// Slim shapes derived from DB types for props passed to <script setup>.
//
// DB entity types live in server/utils/db/types.ts (server-only — they're
// internal to the data layer). This file re-exports the slim shapes that
// both the API responses and the Vue components consume.

export type KategoriSlim = {
  id: string;
  nama: string;
  icon?: string;
  min?: number;
  max?: number;
  urutan?: number;
  autoAge?: boolean;
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
  count?: number;
  pendaftaranDibuka?: boolean;
  faseEnabled?: boolean;
  jadwalByKategori?: Record<
    string,
    { kategoriId: string; tanggal: number | null; jam: string | null }
  >;
};

export type Pj = { nama: string; kontak: string | null };
export type PjByKategori = Record<string, Pj[]>;
