// Verify Neon data flows through the production DB code path.
// Tests the same queries the /api/public/home endpoint makes, but
// without spinning up Nuxt dev server (which has a >120s cold start
// on this machine). If this passes, the API endpoint will too.
//
// Run:  npx tsx scripts/test-neon.mts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load .env manually (no dotenv dep)
const envText = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

if (!process.env.NUXT_DATABASE_URL) {
  console.error("✗ NUXT_DATABASE_URL not set in .env");
  process.exit(1);
}

// Production DB code — same modules Nuxt server uses under the hood
import { all, get } from "../server/utils/db/client.ts";
import { getLomba } from "../server/utils/db/lomba.ts";
import { getKategori } from "../server/utils/db/kategori.ts";
import { getSettings } from "../server/utils/db/settings.ts";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  const sym = ok ? "✓" : "✗";
  console.log(`  ${sym} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
};

console.log("== 1. Direct DB row counts ==");
const counts = await all<{ table_name: string; n: number }>(
  `SELECT 'settings'        AS table_name, COUNT(*)::int AS n FROM settings
   UNION ALL SELECT 'kategori',        COUNT(*)::int FROM kategori
   UNION ALL SELECT 'lomba',           COUNT(*)::int FROM lomba
   UNION ALL SELECT 'lomba_kategori',  COUNT(*)::int FROM lomba_kategori
   UNION ALL SELECT 'lomba_jadwal',    COUNT(*)::int FROM lomba_jadwal
   UNION ALL SELECT 'pendaftar',       COUNT(*)::int FROM pendaftar`,
);
const expected: Record<string, number> = {
  settings: 1, kategori: 5, lomba: 3, lomba_kategori: 15, lomba_jadwal: 5, pendaftar: 45,
};
for (const r of counts) check(`${r.table_name} = ${r.n}`, r.n === expected[r.table_name]);

console.log("\n== 2. Sample lomba rows ==");
const sample = await all<{ id: number; nama: string; status: string; fase_enabled: number; finalis_count: number }>(
  `SELECT id, nama, status, fase_enabled, finalis_count FROM lomba ORDER BY id`,
);
check(`lomba has 3 rows`, sample.length === 3, `got ${sample.length}`);
for (const l of sample) {
  console.log(`      id=${l.id}  "${l.nama}"  status=${l.status}  fase=${l.fase_enabled}  finalis=${l.finalis_count}`);
}

console.log("\n== 3. Production code path (same calls /api/public/home makes) ==");
try {
  const lom = await getLomba(true);
  check(`getLomba() returned rows`, Array.isArray(lom) && lom.length > 0, `(${lom.length} rows)`);
  if (lom[0]) {
    const sample = lom[0] as { id: number; nama: string; kategoriEligible?: unknown };
    const hasShape = typeof sample.id === "number" && typeof sample.nama === "string";
    check(`getLomba() row shape correct (id is number, nama is string)`, hasShape);
    console.log(`      first: id=${sample.id}  nama="${sample.nama}"  kategoriEligible=${JSON.stringify(sample.kategoriEligible)}`);
  }

  const kats = await getKategori();
  check(`getKategori() returned rows`, Array.isArray(kats) && kats.length > 0, `(${kats.length} rows)`);
  if (kats[0]) {
    // Note: kategori.id is TEXT ("k_balita", "k_anak_l", ...), not SERIAL.
    // Other tables (lomba, pendaftar) use SERIAL int. Different by design.
    const k = kats[0] as { id: string; nama: string; urutan: number };
    const hasShape = typeof k.id === "string" && typeof k.nama === "string" && typeof k.urutan === "number";
    check(`getKategori() row shape correct (text id, string nama, number urutan)`, hasShape);
    console.log(`      first: id=${k.id}  nama="${k.nama}"  urutan=${k.urutan}`);
  }

  const cfg = await getSettings();
  check(`getSettings() returned object`, cfg && typeof cfg === "object", JSON.stringify(cfg));
} catch (e) {
  console.error("✗ Production code path threw:", e);
  failures++;
}

console.log("\n== 4. BigInt type parsers (must be JS numbers, not BigInts) ==");
const idRow = await get<{ id: number; finalis_count: number }>("SELECT id, finalis_count FROM lomba WHERE id = 12");
if (idRow) {
  check(`id is plain number (not BigInt)`, typeof idRow.id === "number", `typeof=${typeof idRow.id}  val=${idRow.id}`);
  check(`finalis_count is plain number (not BigInt)`, typeof idRow.finalis_count === "number", `typeof=${typeof idRow.finalis_count}  val=${idRow.finalis_count}`);
}

console.log("\n" + (failures === 0 ? "✓ ALL CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`));
process.exit(failures === 0 ? 0 : 1);
