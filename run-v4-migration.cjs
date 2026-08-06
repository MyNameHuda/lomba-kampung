// One-time v4 migration runner.
// Connects directly to Turso from local machine and runs the ALTER TABLE
// statements outside the Vercel Lambda context. This bypasses the libSQL
// HTTP schema cache race that prevents the migration from working in
// Vercel serverless functions.
//
// Run with: node run-v4-migration.cjs
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@libsql/client");

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("ERROR: DATABASE_URL and DATABASE_AUTH_TOKEN must be set in .env.local");
  process.exit(1);
}

console.log(`Connecting to: ${url.replace(/:[^:@]+@/, ":***@")}`);

(async () => {
  const client = createClient({ url, authToken });

  console.log("\n[1/4] Checking current schema...");
  const before = await client.execute("PRAGMA table_info(lomba_kategori)");
  const beforeCols = before.rows.map((r) => r.name);
  const hasTutup = beforeCols.includes("kualifikasi_tutup_at");
  console.log(`  lomba_kategori columns: ${beforeCols.join(", ")}`);
  console.log(`  kualifikasi_tutup_at: ${hasTutup ? "EXISTS" : "MISSING"}`);

  const before2 = await client.execute("PRAGMA table_info(pendaftar)");
  const before2Cols = before2.rows.map((r) => r.name);
  const hasFinalist = before2Cols.includes("is_finalist");
  console.log(`  pendaftar columns: ${before2Cols.join(", ")}`);
  console.log(`  is_finalist: ${hasFinalist ? "EXISTS" : "MISSING"}`);

  console.log("\n[2/4] Running migrations...");
  if (!hasFinalist) {
    console.log("  ALTER TABLE pendaftar ADD COLUMN is_finalist INTEGER");
    await client.execute("ALTER TABLE pendaftar ADD COLUMN is_finalist INTEGER");
    console.log("  ✓ done");
  } else {
    console.log("  is_finalist already exists, skipping");
  }

  if (!hasTutup) {
    console.log("  ALTER TABLE lomba_kategori ADD COLUMN kualifikasi_tutup_at INTEGER");
    await client.execute("ALTER TABLE lomba_kategori ADD COLUMN kualifikasi_tutup_at INTEGER");
    console.log("  ✓ done");
  } else {
    console.log("  kualifikasi_tutup_at already exists, skipping");
  }

  console.log("\n[3/4] Verifying schema with PRAGMA...");
  const after = await client.execute("PRAGMA table_info(lomba_kategori)");
  const afterCols = after.rows.map((r) => r.name);
  console.log(`  lomba_kategori columns: ${afterCols.join(", ")}`);
  if (!afterCols.includes("kualifikasi_tutup_at")) {
    console.error("  ✗ FAILED: kualifikasi_tutup_at not in columns");
    process.exit(1);
  }

  const after2 = await client.execute("PRAGMA table_info(pendaftar)");
  const after2Cols = after2.rows.map((r) => r.name);
  console.log(`  pendaftar columns: ${after2Cols.join(", ")}`);
  if (!after2Cols.includes("is_finalist")) {
    console.error("  ✗ FAILED: is_finalist not in columns");
    process.exit(1);
  }

  console.log("\n[4/4] Test SELECT with new columns...");
  try {
    const test1 = await client.execute("SELECT kualifikasi_tutup_at FROM lomba_kategori LIMIT 1");
    console.log(`  ✓ SELECT kualifikasi_tutup_at works (${test1.rows.length} rows)`);
  } catch (e) {
    console.error(`  ✗ SELECT kualifikasi_tutup_at FAILED: ${e.message}`);
    process.exit(1);
  }
  try {
    const test2 = await client.execute("SELECT is_finalist FROM pendaftar LIMIT 1");
    console.log(`  ✓ SELECT is_finalist works (${test2.rows.length} rows)`);
  } catch (e) {
    console.error(`  ✗ SELECT is_finalist FAILED: ${e.message}`);
    process.exit(1);
  }

  console.log("\n✅ Migration complete! Vercel Lambdas should now see the new columns.");
  console.log("   Trigger a fresh deploy (or wait for next cold start) and retry the v4 E2E test.");
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
