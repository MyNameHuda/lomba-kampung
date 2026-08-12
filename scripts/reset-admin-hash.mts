import { readFileSync } from "node:fs";
import pg from "pg";

const envContent = readFileSync(".env", "utf8");
const urlMatch = envContent.match(/NUXT_DATABASE_URL=(.+)/);
if (!urlMatch) throw new Error("NUXT_DATABASE_URL not in .env");
const url = urlMatch[1].trim();

pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(23, (v) => (v === null ? null : Number(v)));

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });

const NEW_HASH = "sha256$fee02055d9c2300967c5978431452f488edf423ca0ee8a2331e655381cc00997";

const r = await pool.query("UPDATE settings SET admin_password_hash = $1 RETURNING admin_password_hash", [NEW_HASH]);
console.log("Updated hash:", r.rows[0].admin_password_hash);
await pool.end();
