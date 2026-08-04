// libSQL/Turso client + thin query helpers.
// @libsql/client works with both local SQLite file (file:./lomba.db) and
// Turso remote (libsql://... + auth token). Same query API as node:sqlite
// but the client is async (HTTP-based for remote, native binding for local).
import { createClient, type Client, type InValue } from "@libsql/client";
import path from "node:path";

// =================== Client ===================
type GlobalWithDb = typeof globalThis & { __libsqlClient?: Client };
const globalForDb = globalThis as GlobalWithDb;

/**
 * Resolve a libSQL URL.
 *  - `libsql://...` and `https://...`  → returned as-is (Turso / remote)
 *  - `file:./relative`                  → resolved to absolute path against cwd
 *  - `file:./relative` (Windows)        → normalized with backslashes
 *  - bare path                          → wrapped as `file:`
 *  - default                            → `file:<cwd>/lomba.db`
 */
function resolveDbUrl(rawUrl: string | undefined): string {
  if (!rawUrl) {
    return `file:${path.join(process.cwd(), "lomba.db")}`;
  }
  // Strip BOM + any other invisible whitespace that Vercel/PowerShell might inject
  const url = rawUrl.replace(/^[\uFEFF\u200B-\u200D\u2060\u00A0\s]+/, "").trim();
  if (url.startsWith("libsql://") || url.startsWith("https://") || rawUrl === ":memory:") {
    return url;
  }
  if (url.startsWith("file:")) {
    const rest = url.slice("file:".length);
    // Already absolute (file:/abs or file:///abs)
    if (rest.startsWith("/") || rest.startsWith("\\")) {
      return `file:${rest}`;
    }
    // Relative — resolve against cwd
    const abs = path.resolve(process.cwd(), rest);
    return `file:${abs}`;
  }
  // Bare path
  return `file:${path.resolve(process.cwd(), url)}`;
}

export function getClient(): Client {
  if (globalForDb.__libsqlClient) return globalForDb.__libsqlClient;
  const url = resolveDbUrl(process.env.DATABASE_URL);
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  // Cache the client in dev to survive hot reloads; in production it's a single instance per Lambda.
  if (process.env.NODE_ENV !== "production") globalForDb.__libsqlClient = client;
  return client;
}

// =================== Query helpers ===================
// Thin async wrappers around client.execute so call sites read naturally.
// `args` accepts undefined, null, string, number, bigint, boolean, Uint8Array.
export type DbRow = Record<string, unknown>;
export type DbValue = InValue;

export async function all<T = DbRow>(sql: string, ...args: DbValue[]): Promise<T[]> {
  const result = await getClient().execute({ sql, args });
  return (result.rows ?? []) as T[];
}

export async function get<T = DbRow>(sql: string, ...args: DbValue[]): Promise<T | undefined> {
  const result = await getClient().execute({ sql, args });
  const row = result.rows?.[0];
  return row as T | undefined;
}

export async function run(sql: string, ...args: DbValue[]): Promise<{ lastInsertRowid: number | bigint; changes: number }> {
  const result = await getClient().execute({ sql, args });
  return {
    lastInsertRowid: result.lastInsertRowid ?? 0n,
    changes: result.rowsAffected ?? 0,
  };
}
