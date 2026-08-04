// Internal helpers — shared by db/*.ts modules but NOT re-exported from
// lib/db/index.ts. These are implementation details, not public API.
import { all } from "./client";
import type { DbRow } from "./client";

// =================== Row mapping ===================
// Convert snake_case DB row to camelCase object.
// Special handling for fields that are JSON-encoded in the DB (syarat,
// kategoriEligible) and integer-as-boolean (hadir, autoAge).
export const toCamel = <T>(row: DbRow | undefined): T | null => {
  if (!row) return null;
  const out: DbRow = {};
  for (const [k, v] of Object.entries(row)) {
    const camelKey = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    let val = v;
    if (typeof val === "bigint") val = Number(val);
    if (camelKey === "kategoriEligible" || camelKey === "syarat") {
      if (typeof val === "string") {
        try { val = JSON.parse(val); } catch { val = []; }
      }
      if (!Array.isArray(val)) val = [];
    }
    if (camelKey === "hadir" || camelKey === "autoAge") {
      val = !!val;
    }
    out[camelKey] = val;
  }
  return out as T;
};

export const toCamelAll = <T>(rows: DbRow[]): T[] => rows.map((r) => toCamel<T>(r)!).filter(Boolean) as T[];

// =================== Migration helpers ===================
// Idempotent migration helper for adding new columns to existing tables.
// SQLite has no "ADD COLUMN IF NOT EXISTS", so we check PRAGMA table_info first.
export async function ensureColumn(table: string, column: string, definition: string): Promise<void> {
  const cols = await all<{ name: string }>(`PRAGMA table_info(${table})`);
  if (cols.some((c) => c.name === column)) return;
  const { run } = await import("./client");
  await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
