import { readFileSync } from "node:fs";
import pg from "pg";

const envContent = readFileSync(".env", "utf8");
const urlMatch = envContent.match(/NUXT_DATABASE_URL=(.+)/);
if (!urlMatch) throw new Error("NUXT_DATABASE_URL not in .env");
const url = urlMatch[1].trim();

pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(23, (v) => (v === null ? null : Number(v)));

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });

const r = await pool.query("SELECT id, nama, min, max, auto_age, input_mode FROM kategori ORDER BY urutan");
console.table(r.rows);
await pool.end();
