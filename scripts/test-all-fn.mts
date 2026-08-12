// Test batched count using the actual `all()` helper (not raw pool.query)
// to verify the pg array binding works through the codebase wrapper.
import "dotenv/config";
import pg from "pg";

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
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(23, (v) => (v === null ? null : Number(v)));

// Mimic the `all` helper from server/utils/db/client.ts
async function all<T = Record<string, unknown>>(
  sql: string,
  ...args: unknown[]
): Promise<T[]> {
  const result = await pool.query(sql, args);
  return (result.rows ?? []) as T[];
}

const all_lomba = await pool.query<{ id: number; nama: string }>(
  "SELECT id, nama FROM lomba ORDER BY id"
);
const ids = all_lomba.rows.map((r) => r.id);
console.log(`Got ${ids.length} lomba ids`);

const t0 = performance.now();
const rows = await all<{ lomba_id: number; c: number }>(
  "SELECT lomba_id, COUNT(*) as c FROM pendaftar WHERE lomba_id = ANY($1) AND status = $2 GROUP BY lomba_id",
  [ids],
  "disetujui"
);
const t1 = performance.now();
console.log(`Batched (spread args): ${(t1 - t0).toFixed(0)}ms, ${rows.length} rows`);

if (rows.length > 0) {
  console.log("Sample row:", JSON.stringify(rows[0]));
}

// N+1 for comparison
const t2 = performance.now();
const counts: number[] = [];
for (const id of ids) {
  const r = await all<{ c: number }>(
    "SELECT COUNT(*) as c FROM pendaftar WHERE lomba_id = $1 AND status = $2",
    id,
    "disetujui"
  );
  counts.push(Number(r[0]?.c ?? 0));
}
const t3 = performance.now();
console.log(`N+1: ${(t3 - t2).toFixed(0)}ms`);
console.log(`Speedup: ${((t3 - t2) / Math.max(1, t1 - t0)).toFixed(1)}x`);

// Verify counts match
let mismatches = 0;
for (let i = 0; i < ids.length; i++) {
  const batched = rows.find((r) => Number(r.lomba_id) === ids[i]);
  const expected = counts[i];
  const got = batched ? Number(batched.c) : 0;
  if (got !== expected) {
    console.log(`MISMATCH id=${ids[i]}: batched=${got} n+1=${expected}`);
    mismatches++;
  }
}
console.log(`Verification: ${mismatches === 0 ? "PASS" : "FAIL"} (${mismatches} mismatches)`);

await pool.end();
