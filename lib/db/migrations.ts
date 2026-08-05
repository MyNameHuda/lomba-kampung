// Self-healing migrations — safe to call on every DB access.
// Each migration is idempotent: no-op once the schema is in target state.
import { all, getClient } from "./client";
import { ensureColumn } from "./internal";

// Self-healing: ensure the kategori table has the color columns.
export async function ensureKategoriColorColumns(): Promise<void> {
  await ensureColumn("kategori", "color_bg", "TEXT NOT NULL DEFAULT '#FEF3C7'");
  await ensureColumn("kategori", "color_text", "TEXT NOT NULL DEFAULT '#92400E'");
  await ensureColumn("kategori", "color_border", "TEXT NOT NULL DEFAULT '#FDE68A'");
}

// Self-healing: ensure pendaftar has juara_rank column for stage system.
// NULL = not a Juara; 1, 2, 3 = Juara rank within (lomba, kategori).
// Per (lomba, kategori) only one Juara 1 / 2 / 3 is allowed (enforced in app code).
export async function ensureJuaraColumn(): Promise<void> {
  await ensureColumn("pendaftar", "juara_rank", "INTEGER");
}

// Self-healing: ensure lomba has kualifikasi phase columns (v3 stage system).
// - finalis_count: how many finalists per kategori (default 5, range 1-50)
// - phase: 'kualifikasi' | 'final' | NULL
//   NULL = lomba belum mulai kualifikasi (default for new lomba, also legacy v2 mode)
export async function ensureKualifikasiColumns(): Promise<void> {
  await ensureColumn("lomba", "finalis_count", "INTEGER NOT NULL DEFAULT 5");
  await ensureColumn("lomba", "phase", "TEXT");
}

// Self-healing: ensure lomba_kategori supports multiple PJs per (lomba, kategori).
// Old PK: (lomba_id, kategori_id) — only 1 PJ allowed per combo.
// New PK: (lomba_id, kategori_id, urutan) — multiple PJs allowed, ordered by `urutan`.
// SQLite can't DROP CONSTRAINT, so we detect old schema via PRAGMA and recreate the table.
export async function ensurePjMultiSupport(): Promise<void> {
  // Look at the auto-indexes on lomba_kategori (PK creates one).
  // If any of them includes the 'urutan' column, the new schema is already in place.
  const autoIndexes = await all<{ name: string; sql: string | null }>(
    `SELECT name, sql FROM sqlite_master
     WHERE type = 'index' AND tbl_name = 'lomba_kategori' AND name LIKE 'sqlite_autoindex_%'`
  );
  for (const idx of autoIndexes) {
    if (idx.sql && idx.sql.includes('urutan')) return; // already migrated
  }
  // Migrate: recreate table with new PK, copy data, drop old.
  // Each existing row keeps its urutan — they were already unique globally.
  // Run all statements in one `batch()` so it's atomic (Turso HTTP requires batch,
  // not multi-statement execute — that returns SQL_MANY_STATEMENTS error).
  await getClient().batch(
    [
      `CREATE TABLE IF NOT EXISTS lomba_kategori_new (
         lomba_id INTEGER NOT NULL,
         kategori_id TEXT NOT NULL,
         pj_nama TEXT NOT NULL,
         pj_kontak TEXT,
         urutan INTEGER NOT NULL DEFAULT 0,
         PRIMARY KEY (lomba_id, kategori_id, urutan),
         FOREIGN KEY (lomba_id) REFERENCES lomba(id) ON DELETE CASCADE,
         FOREIGN KEY (kategori_id) REFERENCES kategori(id) ON DELETE CASCADE
       )`,
      `INSERT OR IGNORE INTO lomba_kategori_new (lomba_id, kategori_id, pj_nama, pj_kontak, urutan)
         SELECT lomba_id, kategori_id, pj_nama, COALESCE(pj_kontak, ''), urutan FROM lomba_kategori`,
      `DROP TABLE IF EXISTS lomba_kategori`,
      `ALTER TABLE lomba_kategori_new RENAME TO lomba_kategori`,
      `CREATE INDEX IF NOT EXISTS idx_lomba_kategori_lomba ON lomba_kategori(lomba_id)`,
      `CREATE INDEX IF NOT EXISTS idx_lomba_kategori_kat ON lomba_kategori(kategori_id)`,
    ],
    "write"
  );
}
