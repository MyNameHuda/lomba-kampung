// Plain Node.js seed script using @libsql/client
// Works for both local file (file:./lomba.db) and Turso remote (libsql://...)
// Run with: node lib/db/seed.cjs
//
// Env vars (with defaults for local dev):
//   DATABASE_URL          e.g. file:./lomba.db  OR  libsql://xxx.turso.io
//   DATABASE_AUTH_TOKEN   required for remote; ignored for local file
//   ADMIN_PASSWORD        default seed password (default: lomba123)

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { createClient } = require("@libsql/client");

function simpleHash(password) {
  return "sha256$" + crypto.createHash("sha256").update(password + "lomba_salt_2026").digest("hex");
}

function readSchema() {
  const schemaPath = path.join(__dirname, "schema.sql");
  return fs.readFileSync(schemaPath, "utf8");
}

async function main() {
  const url = process.env.DATABASE_URL || "file:./lomba.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  // Resolve file: URLs relative to the project root, not this script's dir
  const resolvedUrl = url.startsWith("file:") && !path.isAbsolute(url.replace(/^file:/, ""))
    ? `file:${path.join(process.cwd(), url.replace(/^file:/, ""))}`
    : url;

  console.log(`→ Connecting to: ${resolvedUrl.startsWith("file:") ? "local SQLite" : "Turso remote"}`);

  const client = createClient({ url: resolvedUrl, authToken });

  // Apply schema (idempotent) — executeMultiple handles multi-statement SQL in one transaction
  const schema = readSchema();
  await client.executeMultiple(schema);
  console.log("✓ Schema applied (CREATE TABLE IF NOT EXISTS)");

  // Seed settings (only if no settings row exists)
  const settingsCount = await client.execute("SELECT COUNT(*) as c FROM settings");
  if (Number(settingsCount.rows[0].c) === 0) {
    const password = process.env.ADMIN_PASSWORD || "lomba123";
    const hash = simpleHash(password);
    await client.execute({
      sql: "INSERT INTO settings (app_name, kampung_name, tahun_aktif, admin_password_hash) VALUES (?, ?, ?, ?)",
      args: ["Lomba Kampung", "Kampung Merdeka", "HUT RI ke-81 (2026)", hash],
    });
    console.log(`✓ Settings seeded (admin password: ${password})`);
  } else {
    console.log("✓ Settings already exist, skipping");
  }

  // Seed kategori
  const katCount = await client.execute("SELECT COUNT(*) as c FROM kategori");
  if (Number(katCount.rows[0].c) === 0) {
    const kats = [
      ["k_anak", "Anak", "fa-child", 5, 11, 1, 0],
      ["k_remaja", "Remaja", "fa-user", 12, 17, 2, 0],
      ["k_dewasa", "Dewasa", "fa-user-tie", 18, 999, 3, 1],
    ];
    for (const k of kats) {
      await client.execute({
        sql: "INSERT INTO kategori (id, nama, icon, min, max, urutan, auto_age) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: k,
      });
    }
    console.log("✓ 3 kategori seeded (Anak, Remaja, Dewasa) — Dewasa auto_age & no upper limit");
  } else {
    // Idempotent: ensure Dewasa has auto_age=1
    await client.execute("UPDATE kategori SET auto_age = 1 WHERE id = 'k_dewasa'");
    console.log("✓ Kategori already exist, ensured Dewasa auto_age=1");
  }

  // Seed lomba
  const lombaCount = await client.execute("SELECT COUNT(*) as c FROM lomba");
  if (Number(lombaCount.rows[0].c) === 0) {
    const S = (items) => JSON.stringify(items);
    const allKat = S(["k_anak", "k_remaja", "k_dewasa"]);
    const dr = S(["k_remaja", "k_dewasa"]);
    const dw = S(["k_dewasa"]);
    const ak = S(["k_anak"]);

    // Per-kategori PJ pairs. Makan Kerupuk shows 3 PJ berbeda per kategori.
    const seeds = [
      {
        nama: "Makan Kerupuk", emoji: "🍪", deskripsi: "Lomba klasik 17 Agustus",
        syarat: ["Peserta berusia minimal 5 tahun","Kerupuk disediakan panitia","Tidak boleh menyentuh kerupuk dengan tangan","Paling cepat menghabiskan kerupuk = pemenang"],
        kat: allKat, pj: "Bu Siti (Ketua PKK)", kontak: "0812-3456-7890", status: "aktif", urutan: 1,
        pjList: [
          { kat: "k_anak",    nama: "Bu Yuni (Pos Pelayanan Anak)",   kontak: "0812-1111-0001" },
          { kat: "k_remaja",  nama: "Mas Rio (Karang Taruna)",         kontak: "0812-1111-0002" },
          { kat: "k_dewasa",  nama: "Pak H. Bowo (RT 02)",             kontak: "0812-1111-0003" },
        ],
      },
      {
        nama: "Balap Karung", emoji: "🏃", deskripsi: null,
        syarat: ["Peserta berusia 12 tahun ke atas","Karung disediakan panitia","Pakai helm pengaman","Lari sampai finish, paling cepat = pemenang"],
        kat: dr, pj: "Pak RT 03", kontak: "0813-1111-2222", status: "aktif", urutan: 2,
        pjList: [
          { kat: "k_remaja", nama: "Pak Asep (RT 03)",     kontak: "0813-2222-0001" },
          { kat: "k_dewasa", nama: "Pak Udin (RT 04)",     kontak: "0813-2222-0002" },
        ],
      },
      {
        nama: "Tarik Tambang", emoji: "🪢", deskripsi: "Beregu 5 orang",
        syarat: ["Beregu 5 orang (campur bebas)","Saling kompak","Tarik tambang sungguhan","Strategi lebih penting dari kekuatan"],
        kat: dw, pj: "Pak H. Sudirman", kontak: "0814-3333-4444", status: "aktif", urutan: 3,
        pjList: [
          { kat: "k_dewasa", nama: "Pak H. Sudirman", kontak: "0814-3333-4444" },
        ],
      },
      {
        nama: "Panjat Pinang", emoji: "🌴", deskripsi: "Beregu 6 orang bapak-bapak",
        syarat: ["Beregu 6 orang bapak-bapak","Boleh pakai strategi apapun","Hadiah di puncak pinang","Berlari & basah-basahan"],
        kat: dw, pj: "Pak Lurah", kontak: "0815-5555-6666", status: "aktif", urutan: 4,
        pjList: [
          { kat: "k_dewasa", nama: "Pak Lurah", kontak: "0815-5555-6666" },
        ],
      },
      {
        nama: "Estafet Air", emoji: "💧", deskripsi: "Beregu 4 anak-anak",
        syarat: ["Beregu 4 orang anak-anak","Bawa air pakai gelas di sendok","Tidak boleh tumpah","Paling cepat sampai finish = pemenang"],
        kat: ak, pj: "Bu Aminah", kontak: "0816-7777-8888", status: "aktif", urutan: 5,
        pjList: [
          { kat: "k_anak", nama: "Bu Aminah", kontak: "0816-7777-8888" },
        ],
      },
      {
        nama: "Penyanyi Solo (Lagu Nasional)", emoji: "🎤", deskripsi: null,
        syarat: ["Bawakan 1 lagu nasional pilihan","Durasi max 5 menit","Bawa sendiri backing track (HP)","Vokal & ekspresi dinilai"],
        kat: allKat, pj: "Pak RW", kontak: "0817-9999-0000", status: "aktif", urutan: 6,
        pjList: [
          { kat: "k_anak",   nama: "Kak Nisa (Guru TK)",   kontak: "0817-9999-0001" },
          { kat: "k_remaja", nama: "Pak RW",                kontak: "0817-9999-0002" },
          { kat: "k_dewasa", nama: "Ibu PKK",              kontak: "0817-9999-0003" },
        ],
      },
      {
        nama: "Rebutan Kursi", emoji: "🪑", deskripsi: "Khusus anak-anak",
        syarat: ["Usia 5-11 tahun","Jumlah kursi = jumlah peserta - 1","Musik berhenti = langsung duduk","Yang berhasil duduki kursi = pemenang"],
        kat: ak, pj: "Ibu PKK", kontak: "0818-1111-3333", status: "aktif", urutan: 7,
        pjList: [
          { kat: "k_anak", nama: "Ibu PKK", kontak: "0818-1111-3333" },
        ],
      },
      {
        nama: "Pindahkan Kelereng dengan Sendok", emoji: "🥚", deskripsi: null,
        syarat: ["Bawa kelereng dari titik A ke B","Hanya boleh pakai sendok","Tangan tidak boleh menyentuh kelereng","Paling cepat = pemenang"],
        kat: ak, pj: "Bunda RT", kontak: "0819-2222-4444", status: "aktif", urutan: 8,
        pjList: [
          { kat: "k_anak", nama: "Bunda RT", kontak: "0819-2222-4444" },
        ],
      },
    ];

    for (const s of seeds) {
      const result = await client.execute({
        sql: "INSERT INTO lomba (nama, emoji, deskripsi, syarat, kategori_eligible, pj_nama, pj_kontak, status, urutan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [s.nama, s.emoji, s.deskripsi, S(s.syarat), s.kat, s.pj, s.kontak, s.status, s.urutan],
      });
      const lombaId = Number(result.lastInsertRowid);
      let idx = 0;
      for (const pj of s.pjList) {
        await client.execute({
          sql: "INSERT INTO lomba_kategori (lomba_id, kategori_id, pj_nama, pj_kontak, urutan) VALUES (?, ?, ?, ?, ?)",
          args: [lombaId, pj.kat, pj.nama, pj.kontak, idx],
        });
        idx++;
      }
    }

    console.log(`✓ ${seeds.length} lomba seeded with per-kategori PJ`);
  } else {
    // Migrate existing lomba: populate lomba_kategori from pj_nama for each eligible kategori
    const lksCount = await client.execute("SELECT COUNT(*) as c FROM lomba_kategori");
    if (Number(lksCount.rows[0].c) === 0) {
      const allLomba = await client.execute("SELECT id, pj_nama, pj_kontak, kategori_eligible FROM lomba");
      let migrated = 0;
      for (const l of allLomba.rows) {
        let kats = [];
        try { kats = JSON.parse(l.kategori_eligible); } catch { kats = []; }
        let idx = 0;
        for (const kid of kats) {
          await client.execute({
            sql: "INSERT INTO lomba_kategori (lomba_id, kategori_id, pj_nama, pj_kontak, urutan) VALUES (?, ?, ?, ?, ?)",
            args: [l.id, kid, l.pj_nama, l.pj_kontak, idx],
          });
          idx++;
          migrated++;
        }
      }
      console.log(`✓ Migrated: populated lomba_kategori for existing lomba (${migrated} rows)`);
    } else {
      console.log("✓ lomba_kategori already populated");
    }
  }

  console.log("✓ Seed complete. DB at:", resolvedUrl);
  client.close();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
