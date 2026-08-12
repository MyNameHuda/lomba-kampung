// Internal helpers — shared by db/*.ts modules but NOT re-exported from
// the db barrel. Implementation details, not public API.
import { all, run, type DbRow, type DbValue } from "./client";

export const toCamel = <T>(row: DbRow | undefined): T | null => {
  if (!row) return null;
  const out: DbRow = {};
  for (const [k, v] of Object.entries(row)) {
    const camelKey = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    let val = v;
    // pg int parser already converts bigint→number via setTypeParser above,
    // but be defensive: if a smallint/int8 still leaks through as string
    // (e.g. JSON-stringified result), coerce.
    if (typeof val === "string" && /^-?\d+$/.test(val) && k !== "nomor" && k !== "no_wa") {
      val = Number(val);
    }
    if (camelKey === "kategoriEligible" || camelKey === "syarat") {
      if (typeof val === "string") {
        try { val = JSON.parse(val); } catch { val = []; }
      }
      if (!Array.isArray(val)) val = [];
    }
    if (
      camelKey === "hadir" ||
      camelKey === "autoAge" ||
      camelKey === "pendaftaranDibuka" ||
      camelKey === "faseEnabled"
    ) {
      val = !!val;
    }
    out[camelKey] = val;
  }
  return out as T;
};

export const toCamelAll = <T>(rows: DbRow[]): T[] =>
  rows.map((r) => toCamel<T>(r)!).filter(Boolean) as T[];

// Check if a column exists on a table. Postgres uses information_schema
// (not PRAGMA like SQLite).
export async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await all<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    table,
    column
  );
  return rows.length > 0;
}

// Idempotent ADD COLUMN. Uses ADD COLUMN IF NOT EXISTS (Postgres 9.6+).
//
// Memoized: repeated calls for the same (table, column) are a no-op in JS
// after the first successful call. This matters because callers like
// getLombaById() invoke 3-4 ensure*Column() helpers on every request, each
// of which was issuing real ALTER TABLE round-trips. With the cache, only
// the first invocation in a process pays the cost; subsequent ones are O(1).
// On Vercel serverless warm invocations this is essentially free.
const ensuredColumns = new Set<string>();
export async function ensureColumn(
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const key = `${table}.${column}`;
  if (ensuredColumns.has(key)) return;
  await run(
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`
  );
  ensuredColumns.add(key);
}

// DbValue is exported from client.ts; do NOT re-export here or Nuxt
// will warn about duplicate auto-imports.
