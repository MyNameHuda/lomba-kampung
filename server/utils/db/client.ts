// Supabase Postgres client + thin query helpers.
// Uses node-postgres (pg) with the Transaction pooler URL (port 6543)
// for Vercel serverless compatibility.
//
// Why pg.Pool with max=1:
// - Vercel serverless creates a new function instance per cold start.
//   Each instance gets its own pool. With max=1 we cap concurrent queries
//   per instance to 1, which combined with the Supabase pooler (15 conns
//   for free plan) means we can serve ~15 concurrent instances safely.
// - The pooler queues excess connections at the Postgres side, so bursts
//   don't crash anything — they just queue briefly.
import pg from "pg";

const { Pool, types } = pg;

// pg returns int8 (bigint) for BIGSERIAL / INTEGER columns. The old libSQL
// client returned JS number. Convert bigint to number so all downstream
// code (lastInsertRowid, COUNT(*), juara_rank, etc.) keeps working
// without .toString() casts everywhere.
types.setTypeParser(20, (v: string | null) => (v === null ? null : Number(v))); // int8/bigint
types.setTypeParser(21, (v: string | null) => (v === null ? null : Number(v))); // int2/smallint
types.setTypeParser(23, (v: string | null) => (v === null ? null : Number(v))); // int4/integer

type GlobalWithDb = typeof globalThis & { __pgPool?: pg.Pool };
const globalForDb = globalThis as GlobalWithDb;

function getDbUrl(): string {
  return (process.env.NUXT_DATABASE_URL || "").trim();
}

function makePool(): pg.Pool {
  const url = getDbUrl();
  if (!url) {
    throw new Error(
      "NUXT_DATABASE_URL is not set. " +
        "Set it in .env to your Supabase Transaction pooler URL (port 6543)."
    );
  }
  return new Pool({
    connectionString: url,
    max: 1, // see file header for rationale
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Supabase pooler requires SSL. rejectUnauthorized:false accepts the
    // Supabase cert without needing the cert chain shipped with Node.
    ssl: { rejectUnauthorized: false },
  });
}

export function getPool(): pg.Pool {
  // In dev, cache the pool across HMR reloads so we don't leak connections.
  // In production (Vercel), module instance lives for the function's lifetime
  // — also fine.
  if (!globalForDb.__pgPool) globalForDb.__pgPool = makePool();
  return globalForDb.__pgPool;
}

export type DbRow = Record<string, unknown>;
export type DbValue = string | number | boolean | null | Date | Buffer | object;

export async function all<T = DbRow>(sql: string, ...args: DbValue[]): Promise<T[]> {
  const result = await getPool().query(sql, args);
  return (result.rows ?? []) as T[];
}

export async function get<T = DbRow>(sql: string, ...args: DbValue[]): Promise<T | undefined> {
  const result = await getPool().query(sql, args);
  return (result.rows?.[0] as T | undefined);
}

export async function run(
  sql: string,
  ...args: DbValue[]
): Promise<{ lastInsertRowid: number; changes: number }> {
  const result = await getPool().query(sql, args);
  return {
    // pg doesn't expose lastInsertRowid the same way libSQL did. For our use
    // case (single-row INSERTs into tables with SERIAL PK), we use the
    // RETURNING clause in the query. If the caller didn't add RETURNING,
    // fall back to rowCount as a sentinel (=0 means caller should use RETURNING).
    lastInsertRowid:
      result.rows && result.rows[0] && typeof (result.rows[0] as DbRow).id === "number"
        ? ((result.rows[0] as DbRow).id as number)
        : 0,
    changes: result.rowCount ?? 0,
  };
}

// Helper for callers that need RETURNING id without changing their call site.
// Usage: const id = await returningId<{id:number}>("INSERT ... RETURNING id", arg1, arg2);
export async function returningId<T extends { id: number }>(
  sql: string,
  ...args: DbValue[]
): Promise<number> {
  const result = await getPool().query<T>(sql, args);
  return Number(result.rows[0]?.id ?? 0);
}

// Transaction helper — runs a function inside BEGIN/COMMIT. Used for batched
// updates (e.g. lomba_kategori write, finalis reset).
export async function tx<T>(fn: (q: { query: typeof all } & {
  one: <U = DbRow>(sql: string, ...args: DbValue[]) => Promise<U | undefined>;
}) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const wrapper = {
      query: async <U = DbRow>(sql: string, ...args: DbValue[]): Promise<U[]> => {
        const r = await client.query(sql, args);
        return (r.rows ?? []) as U[];
      },
      one: async <U = DbRow>(sql: string, ...args: DbValue[]): Promise<U | undefined> => {
        const r = await client.query(sql, args);
        return r.rows?.[0] as U | undefined;
      },
    };
    const result = await fn(wrapper);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
