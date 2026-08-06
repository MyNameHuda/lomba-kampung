-- Lomba Kampung schema
-- Idempotent: safe to run on fresh DB or to migrate an existing one.
-- All Turso + SQLite compatible.

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name TEXT NOT NULL DEFAULT 'Lomba Kampung',
  kampung_name TEXT NOT NULL DEFAULT 'Kampung Merdeka',
  tahun_aktif TEXT NOT NULL DEFAULT 'HUT RI ke-81 (2026)',
  admin_password_hash TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS kategori (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'fa-user',
  min INTEGER NOT NULL,
  max INTEGER NOT NULL,
  urutan INTEGER NOT NULL DEFAULT 0,
  auto_age INTEGER NOT NULL DEFAULT 0,
  color_bg TEXT NOT NULL DEFAULT '#FEF3C7',
  color_text TEXT NOT NULL DEFAULT '#92400E',
  color_border TEXT NOT NULL DEFAULT '#FDE68A',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS lomba (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🏆',
  deskripsi TEXT,
  syarat TEXT NOT NULL DEFAULT '[]',
  kategori_eligible TEXT NOT NULL DEFAULT '[]',
  pj_nama TEXT NOT NULL DEFAULT 'Panitia',
  pj_kontak TEXT,
  status TEXT NOT NULL DEFAULT 'aktif',
  urutan INTEGER NOT NULL DEFAULT 0,
  -- Stage system v3 — kualifikasi phase config.
  -- finalis_count: how many finalists per kategori advance from kualifikasi to
  -- final (default 5, range 1-50). Set per lomba at create/edit.
  -- phase: NULL = belum mulai kualifikasi, 'kualifikasi' = picking finalists,
  -- 'final' = picking Juara 1/2/3 from finalists.
  -- Existing installs are migrated by `ensureKualifikasiColumns()` in lib/db/index.ts.
  finalis_count INTEGER NOT NULL DEFAULT 5,
  phase TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS lomba_kategori (
  lomba_id INTEGER NOT NULL,
  kategori_id TEXT NOT NULL,
  pj_nama TEXT NOT NULL,
  pj_kontak TEXT,
  urutan INTEGER NOT NULL DEFAULT 0,
  -- PK includes `urutan` so a single (lomba, kategori) combo can have multiple PJs.
  -- Existing installs are migrated by `ensurePjMultiSupport()` in lib/db/index.ts.
  PRIMARY KEY (lomba_id, kategori_id, urutan),
  FOREIGN KEY (lomba_id) REFERENCES lomba(id) ON DELETE CASCADE,
  FOREIGN KEY (kategori_id) REFERENCES kategori(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lomba_kategori_lomba ON lomba_kategori(lomba_id);
CREATE INDEX IF NOT EXISTS idx_lomba_kategori_kat ON lomba_kategori(kategori_id);

-- Per-(lomba, kategori) execution date. One row per eligible combo. NULL tanggal
-- means "belum dijadwalkan". Tanggal is unix seconds (start of day in app's TZ).
-- Multi-PJ per kategori share the same date (because this is per-kategori, not per-PJ).
CREATE TABLE IF NOT EXISTS lomba_jadwal (
  lomba_id INTEGER NOT NULL,
  kategori_id TEXT NOT NULL,
  tanggal INTEGER,
  jam TEXT,
  PRIMARY KEY (lomba_id, kategori_id),
  FOREIGN KEY (lomba_id) REFERENCES lomba(id) ON DELETE CASCADE,
  FOREIGN KEY (kategori_id) REFERENCES kategori(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pendaftar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor TEXT NOT NULL,
  nama TEXT NOT NULL,
  no_wa TEXT,
  jenis_kelamin TEXT NOT NULL,
  kategori_id TEXT NOT NULL,
  umur INTEGER NOT NULL,
  lomba_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  alasan_tolak TEXT,
  sumber TEXT NOT NULL DEFAULT 'publik',
  hadir INTEGER NOT NULL DEFAULT 0,
  -- Juara 1/2/3 within (lomba, kategori). NULL = not picked.
  -- Per (lomba, kategori) only one Juara per rank allowed (enforced in app code
  -- by setJuaraRank un-picking existing Juara with same rank first).
  -- Existing installs are migrated by `ensureJuaraColumn()` in lib/db/index.ts.
  juara_rank INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_pendaftar_lomba ON pendaftar(lomba_id);
CREATE INDEX IF NOT EXISTS idx_pendaftar_status ON pendaftar(status);
CREATE INDEX IF NOT EXISTS idx_lomba_status ON lomba(status);
