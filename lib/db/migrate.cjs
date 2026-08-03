// Apply schema to remote DB without seeding.
// Useful for: applying schema changes to Turso production DB.
// Run with: node lib/db/migrate.cjs
//
// Env vars:
//   DATABASE_URL          e.g. libsql://xxx.turso.io  (required for prod)
//   DATABASE_AUTH_TOKEN   Turso auth token (required for prod)

const path = require("path");
const fs = require("fs");
const { createClient } = require("@libsql/client");

function readSchema() {
  const schemaPath = path.join(__dirname, "schema.sql");
  return fs.readFileSync(schemaPath, "utf8");
}

async function main() {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  console.log(`→ Connecting to: ${url.startsWith("file:") ? "local SQLite" : "Turso remote"}`);
  const client = createClient({ url, authToken });
  const schema = readSchema();
  await client.executeMultiple(schema);
  console.log("✓ Schema applied (CREATE TABLE IF NOT EXISTS)");
  client.close();
}

main().catch((e) => {
  console.error("Migrate failed:", e);
  process.exit(1);
});
