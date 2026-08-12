// Apply schema.sql to remote Supabase Postgres without seeding.
// Run with: node --import tsx/esm server/utils/db/migrate.ts
//
// Env vars:
//   NUXT_DATABASE_URL   e.g. postgresql://postgres.xxx:pass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
//
// Idempotent: schema.sql uses CREATE TABLE IF NOT EXISTS.

import path from "node:path";
import fs from "node:fs";
import pg from "pg";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readSchema(): string {
  const schemaPath = path.join(__dirname, "schema.sql");
  return fs.readFileSync(schemaPath, "utf8");
}

async function main() {
  const url = process.env.NUXT_DATABASE_URL;
  if (!url) {
    console.error("NUXT_DATABASE_URL is required");
    process.exit(1);
  }
  if (!url.startsWith("postgres")) {
    console.error(`Expected postgres:// or postgresql:// URL, got: ${url.slice(0, 30)}...`);
    process.exit(1);
  }

  console.log(`→ Connecting to: ${url.replace(/:[^:@]+@/, ":***@")}`);
  const pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    const schema = readSchema();
    // schema.sql has multiple statements separated by semicolons. pg's
    // `query` runs one statement at a time. Use the underlying client to
    // send the full multi-statement script.
    const client = await pool.connect();
    try {
      await client.query(schema);
      console.log("✓ Schema applied (CREATE TABLE IF NOT EXISTS)");
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("Migrate failed:", e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
