// Plain Node.js seed script using pg (node-postgres). Postgres port.
// Connects to NUXT_DATABASE_URL (Supabase pooler URL, port 6543).
// Run with: node --import tsx/esm server/utils/db/seed.ts
//
// Env vars:
//   NUXT_DATABASE_URL   postgresql://postgres.xxx:pass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
//   ADMIN_PASSWORD      default seed password (default: lomba123)
//
// Idempotent: only inserts if tables are empty.

import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function simpleHash(password: string): string {
  return "sha256$" + crypto.createHash("sha256").update(password + "lomba_salt_2026").digest("hex");
}

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

  // Coerce bigint to number for COUNT(*) values.
  pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
  pg.types.setTypeParser(23, (v) => (v === null ? null : Number(v)));

  try {
    // 1. Apply schema (idempotent CREATE TABLE IF NOT EXISTS)
    const schema = readSchema();
    const client = await pool.connect();
    try {
      await client.query(schema);
      console.log("✓ Schema applied (CREATE TABLE IF NOT EXISTS)");
    } finally {
      client.release();
    }

    // 2. Seed settings if empty
    const { rows: settingsRows } = await pool.query<{ c: number }>("SELECT COUNT(*) as c FROM settings");
    if (Number(settingsRows[0]?.c ?? 0) === 0) {
      const password = process.env.ADMIN_PASSWORD || "lomba123";
      const hash = simpleHash(password);
      await pool.query(
        `INSERT INTO settings (app_name, kampung_name, tahun_aktif, admin_password_hash)
         VALUES ($1, $2, $3, $4)`,
        ["Lomba Kampung", "Kampung Kadu Jaya", "HUT RI ke-81 (2026)", hash]
      );
      console.log(`✓ Settings seeded (admin password: ${password})`);
    } else {
      console.log("✓ Settings already exist, skipping");
    }

    // 3. Seed kategori if empty
    const { rows: katRows } = await pool.query<{ c: number }>("SELECT COUNT(*) as c FROM kategori");
    if (Number(katRows[0]?.c ?? 0) === 0) {
      const kats: Array<[string, string, string, number, number, number, number, string, string, string]> = [
        ["k_balita",   "Balita",              "fa-baby",         0,   4,   0, 0, "#FFE0E0", "#9D1010", "#F18181"],
        ["k_anak_l",   "Anak (Laki-laki)",    "fa-child",        5,  11,   1, 0, "#E11D1D", "#9D1010", "#9D1010"],
        ["k_anak_p",   "Anak (Perempuan)",    "fa-child-dress",  5,  11,   2, 0, "#FCE0E0", "#9D1010", "#F18181"],
        ["k_remaja",   "Remaja",              "fa-user",        12,  17,   3, 0, "#FFFFFF", "#6B7280", "#D1D5DB"],
        ["k_dewasa_p", "Ibu-Ibu",             "fa-user-tie",    18, 999,   4, 1, "#FFFFFF", "#9D1010", "#E11D1D"],
      ];
      for (const k of kats) {
        await pool.query(
          `INSERT INTO kategori (id, nama, icon, min, max, urutan, auto_age, color_bg, color_text, color_border)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          k
        );
      }
      console.log("✓ 5 kategori seeded (Balita, Anak L/P, Remaja, Ibu-Ibu)");
    } else {
      await pool.query("UPDATE kategori SET auto_age = 1 WHERE id = 'k_dewasa_p'");
      console.log("✓ Kategori already exist, ensured k_dewasa_p auto_age=1");
    }

    // 4. Seed lomba if empty
    const { rows: lombaRows } = await pool.query<{ c: number }>("SELECT COUNT(*) as c FROM lomba");
    if (Number(lombaRows[0]?.c ?? 0) === 0) {
      const S = (items: unknown) => JSON.stringify(items);
      const allKat = S(["k_anak_l", "k_anak_p", "k_remaja", "k_dewasa_p"]);
      const dr = S(["k_remaja", "k_dewasa_p"]);
      const dw = S(["k_dewasa_p"]);
      const ak = S(["k_anak_l", "k_anak_p"]);

      type Seed = {
        nama: string; emoji: string; deskripsi: string | null;
        syarat: string[]; kat: string; pj: string; kontak: string;
        status: string; urutan: number;
        pjList: Array<{ kat: string; nama: string; kontak: string }>;
      };

      const seeds: Seed[] = [
        { nama: "Makan Kerupuk", emoji: "🍪", deskripsi: "Lomba klasik 17 Agustus", syarat: ["Peserta berusia minimal 5 tahun","Kerupuk disediakan panitia","Tidak boleh menyentuh kerupuk dengan tangan","Paling cepat menghabiskan kerupuk = pemenang"], kat: allKat, pj: "Bu Siti (Ketua PKK)", kontak: "0812-3456-7890", status: "aktif", urutan: 1, pjList: [{ kat: "k_anak_l", nama: "Bu Yuni (Pos Pelayanan Anak)", kontak: "0812-1111-0001" }, { kat: "k_anak_p", nama: "Bu Yuni (Pos Pelayanan Anak)", kontak: "0812-1111-0001" }, { kat: "k_remaja", nama: "Mas Rio (Karang Taruna)", kontak: "0812-1111-0002" }, { kat: "k_dewasa_p", nama: "Pak H. Bowo (RT 02)", kontak: "0812-1111-0003" }] },
        { nama: "Balap Karung", emoji: "🏃", deskripsi: null, syarat: ["Peserta berusia 12 tahun ke atas","Karung disediakan panitia","Pakai helm pengaman","Lari sampai finish, paling cepat = pemenang"], kat: dr, pj: "Pak RT 03", kontak: "0813-1111-2222", status: "aktif", urutan: 2, pjList: [{ kat: "k_remaja", nama: "Pak Asep (RT 03)", kontak: "0813-2222-0001" }, { kat: "k_dewasa_p", nama: "Pak Udin (RT 04)", kontak: "0813-2222-0002" }] },
        { nama: "Tarik Tambang", emoji: "🪢", deskripsi: "Beregu 5 orang", syarat: ["Beregu 5 orang (campur bebas)","Saling kompak","Tarik tambang sungguhan","Strategi lebih penting dari kekuatan"], kat: dw, pj: "Pak H. Sudirman", kontak: "0814-3333-4444", status: "aktif", urutan: 3, pjList: [{ kat: "k_dewasa_p", nama: "Pak H. Sudirman", kontak: "0814-3333-4444" }] },
        { nama: "Panjat Pinang", emoji: "🌴", deskripsi: "Beregu 6 orang bapak-bapak", syarat: ["Beregu 6 orang bapak-bapak","Boleh pakai strategi apapun","Hadiah di puncak pinang","Berlari & basah-basahan"], kat: dw, pj: "Pak Lurah", kontak: "0815-5555-6666", status: "aktif", urutan: 4, pjList: [{ kat: "k_dewasa_p", nama: "Pak Lurah", kontak: "0815-5555-6666" }] },
        { nama: "Estafet Air", emoji: "💧", deskripsi: "Beregu 4 anak-anak", syarat: ["Beregu 4 orang anak-anak","Bawa air pakai gelas di sendok","Tidak boleh tumpah","Paling cepat sampai finish = pemenang"], kat: ak, pj: "Bu Aminah", kontak: "0816-7777-8888", status: "aktif", urutan: 5, pjList: [{ kat: "k_anak_l", nama: "Bu Aminah", kontak: "0816-7777-8888" }, { kat: "k_anak_p", nama: "Bu Aminah", kontak: "0816-7777-8888" }] },
        { nama: "Penyanyi Solo (Lagu Nasional)", emoji: "🎤", deskripsi: null, syarat: ["Bawakan 1 lagu nasional pilihan","Durasi max 5 menit","Bawa sendiri backing track (HP)","Vokal & ekspresi dinilai"], kat: allKat, pj: "Pak RW", kontak: "0817-9999-0000", status: "aktif", urutan: 6, pjList: [{ kat: "k_anak_l", nama: "Kak Nisa (Guru TK)", kontak: "0817-9999-0001" }, { kat: "k_anak_p", nama: "Kak Nisa (Guru TK)", kontak: "0817-9999-0001" }, { kat: "k_remaja", nama: "Pak RW", kontak: "0817-9999-0002" }, { kat: "k_dewasa_p", nama: "Ibu PKK", kontak: "0817-9999-0003" }] },
        { nama: "Rebutan Kursi", emoji: "🪑", deskripsi: "Khusus anak-anak", syarat: ["Usia 5-11 tahun","Jumlah kursi = jumlah peserta - 1","Musik berhenti = langsung duduk","Yang berhasil duduki kursi = pemenang"], kat: ak, pj: "Ibu PKK", kontak: "0818-1111-3333", status: "aktif", urutan: 7, pjList: [{ kat: "k_anak_l", nama: "Ibu PKK", kontak: "0818-1111-3333" }, { kat: "k_anak_p", nama: "Ibu PKK", kontak: "0818-1111-3333" }] },
        { nama: "Pindahkan Kelereng dengan Sendok", emoji: "🥚", deskripsi: null, syarat: ["Bawa kelereng dari titik A ke B","Hanya boleh pakai sendok","Tangan tidak boleh menyentuh kelereng","Paling cepat = pemenang"], kat: ak, pj: "Bunda RT", kontak: "0819-2222-4444", status: "aktif", urutan: 8, pjList: [{ kat: "k_anak_l", nama: "Bunda RT", kontak: "0819-2222-4444" }, { kat: "k_anak_p", nama: "Bunda RT", kontak: "0819-2222-4444" }] },
      ];

      for (const s of seeds) {
        const insertRes = await pool.query<{ id: number }>(
          `INSERT INTO lomba (nama, emoji, deskripsi, syarat, kategori_eligible, pj_nama, pj_kontak, status, urutan)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [s.nama, s.emoji, s.deskripsi, S(s.syarat), s.kat, s.pj, s.kontak, s.status, s.urutan]
        );
        const lombaId = Number(insertRes.rows[0]?.id);
        let idx = 0;
        for (const pj of s.pjList) {
          await pool.query(
            `INSERT INTO lomba_kategori (lomba_id, kategori_id, pj_nama, pj_kontak, urutan)
             VALUES ($1, $2, $3, $4, $5)`,
            [lombaId, pj.kat, pj.nama, pj.kontak, idx]
          );
          idx++;
        }
      }
      console.log(`✓ ${seeds.length} lomba seeded with per-kategori PJ`);
    } else {
      const { rows: lksRows } = await pool.query<{ c: number }>("SELECT COUNT(*) as c FROM lomba_kategori");
      if (Number(lksRows[0]?.c ?? 0) === 0) {
        const { rows: allLomba } = await pool.query<{ id: number; pj_nama: string; pj_kontak: string | null; kategori_eligible: string }>(
          "SELECT id, pj_nama, pj_kontak, kategori_eligible FROM lomba"
        );
        let migrated = 0;
        for (const l of allLomba) {
          let kats: string[] = [];
          try { kats = JSON.parse(l.kategori_eligible); } catch { kats = []; }
          let idx = 0;
          for (const kid of kats) {
            await pool.query(
              `INSERT INTO lomba_kategori (lomba_id, kategori_id, pj_nama, pj_kontak, urutan)
               VALUES ($1, $2, $3, $4, $5)`,
              [l.id, kid, l.pj_nama, l.pj_kontak, idx]
            );
            idx++;
            migrated++;
          }
        }
        console.log(`✓ Migrated: populated lomba_kategori for existing lomba (${migrated} rows)`);
      } else {
        console.log("✓ lomba_kategori already populated");
      }
    }

    console.log("✓ Seed complete.");
  } catch (e) {
    console.error("Seed failed:", e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
