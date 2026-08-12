// One-off test: verify countPendaftarByLombaBatch returns correct shape.
import "dotenv/config";
import pg from "pg";

pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(23, (v) => (v === null ? null : Number(v)));

const url = process.env.NUXT_DATABASE_URL;
if (!url) {
  console.error("NUXT_DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

// 1. Get all lomba ids
const all = await pool.query<{ id: number; nama: string }>("SELECT id, nama FROM lomba ORDER BY id");
console.log(`Found ${all.rows.length} lomba`);

// 2. Run the batched query (mimicking our function)
const ids = all.rows.map((r) => r.id);
const t0 = performance.now();
const res = await pool.query<{ lomba_id: number; c: number }>(
  "SELECT lomba_id, COUNT(*) as c FROM pendaftar WHERE lomba_id = ANY($1) AND status = $2 GROUP BY lomba_id",
  [[ids], "disetujui"]
);
const t1 = performance.now();
console.log(`Batched query took ${(t1 - t0).toFixed(0)}ms`);
console.log(`Result: ${res.rows.length} rows with counts`);
const map = new Map<number, number>();
for (const r of res.rows) map.set(Number(r.lomba_id), Number(r.c));

// 3. Compare with N+1 (sequential)
const t2 = performance.now();
const counts: number[] = [];
for (const id of ids) {
  const r = await pool.query<{ c: number }>(
    "SELECT COUNT(*) as c FROM pendaftar WHERE lomba_id = $1 AND status = $2",
    [id, "disetujui"]
  );
  counts.push(Number(r.rows[0]?.c ?? 0));
}
const t3 = performance.now();
console.log(`N+1 query took ${(t3 - t2).toFixed(0)}ms`);

console.log(`\nSpeedup: ${((t3 - t2) / (t1 - t0)).toFixed(1)}x faster`);

// Verify counts match
let mismatches = 0;
for (let i = 0; i < ids.length; i++) {
  const batched = map.get(ids[i]) ?? 0;
  const n_plus_1 = counts[i];
  if (batched !== n_plus_1) {
    console.log(`MISMATCH for id=${ids[i]}: batched=${batched}, n+1=${n_plus_1}`);
    mismatches++;
  }
}
console.log(`Mismatches: ${mismatches}`);

await pool.end();
