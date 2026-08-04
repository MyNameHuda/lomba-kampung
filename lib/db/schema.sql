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
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS lomba_kategori (
  lomba_id INTEGER NOT NULL,
  kategori_id TEXT NOT NULL,
  pj_nama TEXT NOT NULL,
  pj_kontak TEXT,
  urutan INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (lomba_id, kategori_id),
  FOREIGN KEY (lomba_id) REFERENCES lomba(id) ON DELETE CASCADE,
  FOREIGN KEY (kategori_id) REFERENCES kategori(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lomba_kategori_lomba ON lomba_kategori(lomba_id);
CREATE INDEX IF NOT EXISTS idx_lomba_kategori_kat ON lomba_kategori(kategori_id);

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
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_pendaftar_lomba ON pendaftar(lomba_id);
CREATE INDEX IF NOT EXISTS idx_pendaftar_status ON pendaftar(status);
CREATE INDEX IF NOT EXISTS idx_lomba_status ON lomba(status);
