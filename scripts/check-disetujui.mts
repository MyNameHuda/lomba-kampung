import { readFileSync } from "node:fs";
import pg from "pg";

const envContent = readFileSync(".env", "utf8");
const urlMatch = envContent.match(/NUXT_DATABASE_URL=(.+)/);
if (!urlMatch) throw new Error("NUXT_DATABASE_URL not in .env");
const url = urlMatch[1].trim();

pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(23, (v) => (v === null ? null : Number(v)));

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });

// Lomba with their actual count of 'disetujui' pendaftar
const r = await pool.query(`
  SELECT l.id, l.nama, l.status, l.pendaftaran_dibuka,
    COUNT(p.id) FILTER (WHERE p.status = 'disetujui') as count_disetujui,
    COUNT(p.id) FILTER (WHERE p.status = 'pending') as count_pending,
    COUNT(p.id) FILTER (WHERE p.status = 'ditolak') as count_ditolak
  FROM lomba l
  LEFT JOIN pendaftar p ON p.lomba_id = l.id
  WHERE l.status = 'aktif'
  GROUP BY l.id
  ORDER BY l.id
`);

console.log("Lomba with breakdown of pendaftar status:");
for (const row of r.rows) {
  const flag = row.count_disetujui === 0 ? " ← 0 disetujui" : "";
  console.log(`  id=${row.id} ${row.nama} (status=${row.status}, daftar=${row.pendaftaran_dibuka}): disetujui=${row.count_disetujui}, pending=${row.count_pending}, ditolak=${row.count_ditolak}${flag}`);
}
await pool.end();
