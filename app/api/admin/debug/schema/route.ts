// Debug endpoint to check current schema state
// POST /api/admin/debug/schema → returns PRAGMA table_info for all tables
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { all } from "@/lib/db/client";
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
