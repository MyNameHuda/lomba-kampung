// Test batched juara summary query — mirrors getJuaraSummaryBatch logic.
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

// Get all lomba with kategori_eligible
const lombaRes = await pool.query<{ id: number; nama: string; kategori_eligible: string[] }>(
  "SELECT id, nama, kategori_eligible FROM lomba ORDER BY id"
);
console.log(`Found ${lombaRes.rows.length} lomba`);

const lombaList = lombaRes.rows.map((r) => ({
  id: r.id,
  kategoriEligible: r.kategori_eligible,
}));

// Batched query
const t0 = performance.now();
const juaras = await pool.query<{ lomba_id: number; kategori_id: string; juara_rank: number; c: number }>(
  `SELECT lomba_id, kategori_id, juara_rank, COUNT(*) as c
   FROM pendaftar
   WHERE juara_rank IS NOT NULL
   GROUP BY lomba_id, kategori_id, juara_rank`
);
const t1 = performance.now();
console.log(`Batched juara query: ${(t1 - t0).toFixed(0)}ms, ${juaras.rows.length} rows`);

// Pivot
const pivot = new Map<string, { ju1: number; ju2: number; ju3: number }>();
const summary: Record<number, { totalJuara: number; allReady: boolean }> = {};
for (const l of lombaList) summary[l.id] = { totalJuara: 0, allReady: true };

for (const r of juaras.rows) {
  const key = `${r.lomba_id}|${r.kategori_id}`;
  let cell = pivot.get(key);
  if (!cell) {
    cell = { ju1: 0, ju2: 0, ju3: 0 };
    pivot.set(key, cell);
  }
  const rank = Number(r.juara_rank);
  if (rank === 1) cell.ju1 = Number(r.c);
  else if (rank === 2) cell.ju2 = Number(r.c);
  else if (rank === 3) cell.ju3 = Number(r.c);
  summary[Number(r.lomba_id)].totalJuara += Number(r.c);
}

for (const l of lombaList) {
  const eligible = Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [];
  for (const katId of eligible) {
    const cell = pivot.get(`${l.id}|${katId}`);
    if (!cell || cell.ju1 < 1 || cell.ju2 < 1) {
      summary[l.id].allReady = false;
      break;
    }
  }
}

console.log("\nSummary (first 5):");
for (const l of lombaList.slice(0, 5)) {
  const s = summary[l.id];
  console.log(`  Lomba ${l.id} "${lombaRes.rows.find((r) => r.id === l.id)?.nama}": totalJuara=${s.totalJuara}, allReady=${s.allReady}`);
}

// N+1 comparison
const t2 = performance.now();
let nPlus1Count = 0;
for (const l of lombaList) {
  for (const katId of l.kategoriEligible ?? []) {
    await pool.query(
      "SELECT COUNT(*) FROM pendaftar WHERE lomba_id = $1 AND kategori_id = $2 AND juara_rank IS NOT NULL",
      [l.id, katId]
    );
    nPlus1Count++;
  }
}
const t3 = performance.now();
console.log(`\nN+1 (${nPlus1Count} queries): ${(t3 - t2).toFixed(0)}ms`);
console.log(`Speedup: ${((t3 - t2) / Math.max(1, t1 - t0)).toFixed(1)}x`);

await pool.end();
