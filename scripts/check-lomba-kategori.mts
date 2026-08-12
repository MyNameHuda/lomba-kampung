import { readFileSync } from "node:fs";
import pg from "pg";

const envContent = readFileSync(".env", "utf8");
const urlMatch = envContent.match(/NUXT_DATABASE_URL=(.+)/);
if (!urlMatch) throw new Error("NUXT_DATABASE_URL not in .env");
const url = urlMatch[1].trim();

pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(23, (v) => (v === null ? null : Number(v)));

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });

const r = await pool.query(`
  SELECT l.id, l.nama, l.status, l.pendaftaran_dibuka, l.kategori_eligible
  FROM lomba l
  WHERE l.kategori_eligible::text LIKE '%k_dewasa_p%' OR l.kategori_eligible::text LIKE '%k_umum%'
  ORDER BY l.id
`);
console.log("Lomba yang punya Ibu-Ibu atau Umum:");
for (const row of r.rows) {
  console.log(`  id=${row.id} ${row.nama} status=${row.status} buka=${row.pendaftaran_dibuka} eligible=${JSON.stringify(row.kategori_eligible)}`);
}
await pool.end();
