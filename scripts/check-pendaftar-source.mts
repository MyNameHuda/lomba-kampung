import { readFileSync } from "node:fs";
import pg from "pg";

const envContent = readFileSync(".env", "utf8");
const urlMatch = envContent.match(/NUXT_DATABASE_URL=(.+)/);
if (!urlMatch) throw new Error("NUXT_DATABASE_URL not in .env");
const url = urlMatch[1].trim();

pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(23, (v) => (v === null ? null : Number(v)));

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });

// Count pendaftar by (sumber, status) for each lomba
const r = await pool.query(`
  SELECT lomba_id, sumber, status, COUNT(*) as c
  FROM pendaftar
  GROUP BY lomba_id, sumber, status
  HAVING COUNT(*) > 0
  ORDER BY lomba_id, sumber, status
`);

console.log("Breakdown of pendaftar by lomba + sumber + status:");
const byLomba: Record<number, any> = {};
for (const row of r.rows) {
  if (!byLomba[row.lomba_id]) byLomba[row.lomba_id] = { publik: {}, manual: {} };
  byLomba[row.lomba_id][row.sumber] = byLomba[row.lomba_id][row.sumber] || {};
  byLomba[row.lomba_id][row.sumber][row.status] = Number(row.c);
}

for (const [lombaId, sources] of Object.entries(byLomba)) {
  console.log(`  Lomba ${lombaId}:`);
  console.log(`    publik:  ${JSON.stringify(sources.publik || {})}`);
  console.log(`    manual:  ${JSON.stringify(sources.manual || {})}`);
}

console.log("\nSummary:");
const totalPublikDisetujui = await pool.query(`SELECT COUNT(*) as c FROM pendaftar WHERE sumber='publik' AND status='disetujui'`);
const totalManualDisetujui = await pool.query(`SELECT COUNT(*) as c FROM pendaftar WHERE sumber='manual' AND status='disetujui'`);
const totalPublikPending = await pool.query(`SELECT COUNT(*) as c FROM pendaftar WHERE sumber='publik' AND status='pending'`);
console.log(`  publik disetujui: ${totalPublikDisetujui.rows[0].c}`);
console.log(`  manual disetujui: ${totalManualDisetujui.rows[0].c}`);
console.log(`  publik pending: ${totalPublikPending.rows[0].c}`);

await pool.end();
