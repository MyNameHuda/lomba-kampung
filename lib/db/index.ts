// Barrel re-export — single import point for all DB modules.
// All callers do `import { ... } from "@/lib/db"` and get everything they need.
// New modules added here as the schema evolves.

// Client + low-level helpers (rarely imported directly)
export { getClient } from "./client";

// Types
export type {
  Settings,
  Kategori,
  Lomba,
  LombaStatus,
  LombaKategoriInput,
  Pj,
  Pendaftar,
  PendaftarStatus,
  SumberPendaftaran,
  JenisKelamin,
  DisplaySection,
  DisplaySectionKey,
} from "./types";

// Migrations (idempotent — safe to call repeatedly)
export { ensureKategoriColorColumns, ensurePjMultiSupport, ensureJuaraColumn, ensureKualifikasiColumns, ensureKualifikasiV4Columns } from "./migrations";

// Settings
export { getSettings, updateSettings, updateAdminPassword } from "./settings";

// Kategori
export { getKategori, upsertKategori, deleteKategori } from "./kategori";

// Lomba
export {
  getLomba,
  getLombaById,
  getLombaWithCount,
  createLomba,
  updateLomba,
  deleteLomba,
  setLombaKategori,
  getJuaraReadiness,
  markLombaSelesai,
  tutupKualifikasiKategori,
  bukaKualifikasiKategori,
  parseLombaKategoriTutup,
  type JuaraReadiness,
} from "./lomba";

// Pendaftar
export {
  getPendaftar,
  getPendaftarByLomba,
  getPendaftarByNomor,
  getPendaftarById,
  createPendaftar,
  updatePendaftar,
  deletePendaftar,
  bulkDeletePendaftar,
  countLombaAktif,
  countPendaftarByStatus,
  countAllPendaftar,
  countPendaftarHadir,
  countPendaftarByLomba,
  groupPendaftarForLomba,
  setJuaraRank,
  clearJuaraRank,
  getJuaraByLomba,
  countJuaraByKategori,
  setFinalist,
  getKualifikasiStatusByKategori,
  getLombaKualifikasiStatus,
  type JuaraSlim,
  type KualifikasiKategoriStatus,
} from "./pendaftar";

// Backup / reset
export { exportAllData, resetAllData } from "./backup";
