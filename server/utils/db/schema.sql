-- Lomba Kampung schema — Supabase Postgres version.
-- Idempotent: safe to run on fresh DB or to migrate an existing one.
-- Note: SERIAL auto-converts to int4 (4-byte). For our scale (<<10k rows)
-- that's plenty. Migration to BIGSERIAL later is trivial if needed.

CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  app_name TEXT NOT NULL DEFAULT 'Lomba Kampung',
  kampung_name TEXT NOT NULL DEFAULT 'Kampung Kadu Jaya',
  tahun_aktif TEXT NOT NULL DEFAULT 'HUT RI ke-81 (2026)',
  admin_password_hash TEXT NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::bigint
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
  input_mode TEXT NOT NULL DEFAULT 'button',
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::bigint
);

CREATE TABLE IF NOT EXISTS lomba (
  id SERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🏆',
  deskripsi TEXT,
  syarat TEXT NOT NULL DEFAULT '[]',
  kategori_eligible TEXT NOT NULL DEFAULT '[]',
  pj_nama TEXT NOT NULL DEFAULT 'Panitia',
  pj_kontak TEXT,
  status TEXT NOT NULL DEFAULT 'aktif',
  -- Whether public registration is open. Independent of `status` (lomba
  -- lifecycle: draft/aktif/selesai). Default 1 (open) for new lomba.
  pendaftaran_dibuka INTEGER NOT NULL DEFAULT 1,
  urutan INTEGER NOT NULL DEFAULT 0,
  -- Stage system v3 — kualifikasi phase config.
  -- finalis_count: how many finalists per kategori advance (default 5, 1-50).
  -- phase: NULL = belum mulai, 'kualifikasi' = picking finalists, 'final' = picking Juara.
  -- fase_enabled: enables 3-phase (kual → semi → final). When 0, phase is unused.
  finalis_count INTEGER NOT NULL DEFAULT 5,
  fase_enabled INTEGER NOT NULL DEFAULT 0,
  phase TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::bigint
);

CREATE TABLE IF NOT EXISTS lomba_kategori (
  lomba_id INTEGER NOT NULL,
  kategori_id TEXT NOT NULL,
  pj_nama TEXT NOT NULL,
  pj_kontak TEXT,
  urutan INTEGER NOT NULL DEFAULT 0,
  -- PK includes `urutan` so a single (lomba, kategori) combo can have multiple PJs.
  PRIMARY KEY (lomba_id, kategori_id, urutan),
  FOREIGN KEY (lomba_id) REFERENCES lomba(id) ON DELETE CASCADE,
  FOREIGN KEY (kategori_id) REFERENCES kategori(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lomba_kategori_lomba ON lomba_kategori(lomba_id);
CREATE INDEX IF NOT EXISTS idx_lomba_kategori_kat ON lomba_kategori(kategori_id);

CREATE TABLE IF NOT EXISTS lomba_jadwal (
  lomba_id INTEGER NOT NULL,
  kategori_id TEXT NOT NULL,
  tanggal BIGINT,
  jam TEXT,
  PRIMARY KEY (lomba_id, kategori_id),
  FOREIGN KEY (lomba_id) REFERENCES lomba(id) ON DELETE CASCADE,
  FOREIGN KEY (kategori_id) REFERENCES kategori(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pendaftar (
  id SERIAL PRIMARY KEY,
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
  -- Per (lomba, kategori) only one Juara per rank allowed (enforced in app code).
  juara_rank INTEGER,
  -- Stage system v4: tri-state finalist marker. NULL = not decided, 1 = masuk
  -- final, 0 = gugur kualifikasi.
  is_finalist INTEGER,
  -- Stage system v4: tri-state semi-finalist marker. NULL = not decided.
  is_semi_finalist INTEGER,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::bigint,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::bigint
);

CREATE INDEX IF NOT EXISTS idx_pendaftar_lomba ON pendaftar(lomba_id);
CREATE INDEX IF NOT EXISTS idx_pendaftar_status ON pendaftar(status);
CREATE INDEX IF NOT EXISTS idx_lomba_status ON lomba(status);
