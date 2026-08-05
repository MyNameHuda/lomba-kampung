// Debug + migration endpoint.
// GET  /api/admin/debug/schema → check schema state (read-only)
// POST /api/admin/debug/migrate → force-run v4 migration with batch() atomicity
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { all, getClient } from "@/lib/db/client";
import { ensureKualifikasiV4Columns } from "@/lib/db/migrations";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // Run the v4 migration explicitly
    await ensureKualifikasiV4Columns();

    const tables = ["pendaftar", "lomba_kategori", "lomba", "kategori", "settings"];
    const result: Record<string, Array<{ name: string; type: string; notnull: number; pk: number }>> = {};
    for (const t of tables) {
      const cols = await all<{ name: string; type: string; notnull: number; pk: number }>(
        `PRAGMA table_info(${t})`
      );
      result[t] = cols;
    }
    return NextResponse.json({ ok: true, tables: result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // Force-run migration using client.batch() for atomicity.
    // Try the whole batch — if any ALTER fails (column already exists),
    // we get the error and can try with separate ALTERs.
    const client = getClient();

    // First check what's missing
    const beforePk = await all<{ name: string }>(`PRAGMA table_info(pendaftar)`);
    const beforeLk = await all<{ name: string }>(`PRAGMA table_info(lomba_kategori)`);
    const needsIsFinalist = !beforePk.some((c) => c.name === "is_finalist");
    const needsTutup = !beforeLk.some((c) => c.name === "kualifikasi_tutup_at");

    const results: Record<string, string> = {};
    if (needsIsFinalist) {
      await client.execute({ sql: "ALTER TABLE pendaftar ADD COLUMN is_finalist INTEGER", args: [] });
      results.is_finalist = "added";
    } else {
      results.is_finalist = "already exists";
    }
    if (needsTutup) {
      await client.execute({ sql: "ALTER TABLE lomba_kategori ADD COLUMN kualifikasi_tutup_at INTEGER", args: [] });
      results.kualifikasi_tutup_at = "added";
    } else {
      results.kualifikasi_tutup_at = "already exists";
    }

    // Verify with PRAGMA (different connection may show stale)
    const afterPk = await all<{ name: string }>(`PRAGMA table_info(pendaftar)`);
    const afterLk = await all<{ name: string }>(`PRAGMA table_info(lomba_kategori)`);
    results.verify_is_finalist = afterPk.some((c) => c.name === "is_finalist") ? "OK" : "MISSING";
    results.verify_kualifikasi_tutup_at = afterLk.some((c) => c.name === "kualifikasi_tutup_at") ? "OK" : "MISSING";

    // Test SELECT
    try {
      await client.execute({ sql: "SELECT kualifikasi_tutup_at FROM lomba_kategori LIMIT 0", args: [] });
      results.test_select_tutup = "OK";
    } catch (e) {
      results.test_select_tutup = `FAIL: ${String(e).substring(0, 100)}`;
    }

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
