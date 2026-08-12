// One-off helper to rename the village in live Neon settings.
// Run with: node --import tsx/esm scripts/rename-kampung.mts
import "dotenv/config";
import pg from "pg";

const NEW_NAME = "Kampung Kadu Jaya";

async function main() {
  const url = process.env.NUXT_DATABASE_URL;
  if (!url) {
    console.error("NUXT_DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
  pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
  pg.types.setTypeParser(23, (v) => (v === null ? null : Number(v)));

  try {
    const before = await pool.query<{ id: number; app_name: string; kampung_name: string }>(
      "SELECT id, app_name, kampung_name FROM settings WHERE id = 1"
    );
    if (before.rows.length === 0) {
      console.error("No settings row found (id=1). Run db:seed first.");
      process.exit(1);
    }
    console.log("BEFORE:", JSON.stringify(before.rows[0]));

    const r = await pool.query<{ id: number; app_name: string; kampung_name: string }>(
      "UPDATE settings SET kampung_name = $1 WHERE id = 1 RETURNING id, app_name, kampung_name",
      [NEW_NAME]
    );
    console.log("AFTER: ", JSON.stringify(r.rows[0]));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
