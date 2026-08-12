# Deploy Lomba Kampung ke Vercel + Neon Postgres

Panduan step-by-step deploy project ini ke Vercel (serverless) pake **Neon Postgres** free tier (Singapore region).

> **⚠️ PENTING — Default Admin Password**
>
> Script `server/utils/db/seed.ts` bakal pakai password `lomba123` sebagai
> default kalau `ADMIN_PASSWORD` env var **tidak di-set**. Ini hardcoded
> fallback di code — bukan placeholder. Selalu set `ADMIN_PASSWORD=<strong>`
> di Vercel environment variables **sebelum** run seed (lihat Step 3.1 & 4).
> Default `lomba123` cuma untuk first-time local dev kalau lu belum sempet
> set password.

## Prasyarat

- Akun Vercel (https://vercel.com/signup)
- Akun Neon (https://neon.tech) — bisa juga create via Vercel dashboard
  (Storage → Create Database → Postgres)
- Codebase udah di-push ke GitHub
- Local udah bisa connect ke Neon (cek `.env` → `NUXT_DATABASE_URL`)

## 1. Setup Neon Postgres

### 1.1 Buat project (kalau belum)

**Option A — Via Vercel (recommended, auto-wire env vars)**:
1. Vercel dashboard → Storage → Create Database → Postgres
2. Pilih region **Singapore (ap-southeast-1)** untuk latency optimal ke user
3. Vercel auto-create Neon project + set `POSTGRES_URL` env var

**Option B — Langsung di Neon.tech**:
1. Login ke https://console.neon.tech
2. "Create project" → region Singapore → Postgres 16
3. Copy **pooled connection string** dari dashboard (penting: yg
   `*-pooler.*` hostname, bukan direct endpoint)

### 1.2 Get connection string

Format connection string Neon:
```
postgresql://USER:PASS@ep-xxx-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require&channel_binding=require
```

**Catatan**:
- Hostname **wajib** include `-pooler` (ini pooled endpoint, buat serverless).
  Direct endpoint (tanpa `-pooler`) jangan dipake dari Vercel — bakal cepat
  hit connection limit.
- `?sslmode=require&channel_binding=require` — biarkan apa adanya.
- Password Neon format `npg_xxx` (alphanumeric + underscore), gak perlu
  percent-encode.
- Neon pooler **IPv4 by default** — gak perlu add-on kayak Supabase.

Test koneksi dari terminal local:
```bash
node -e "import('pg').then(pg => { const pool = new pg.default.Pool({ connectionString: 'postgresql://...', ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 10000 }); pool.query('SELECT 1 as ok').then(r => { console.log('OK:', r.rows); pool.end(); }).catch(e => { console.error('FAIL:', e.message); pool.end(); }); })"
```

## 2. Push code ke GitHub

```bash
cd "C:\Users\bangn\Documents\Kerja\lomba-new"
git init                  # kalau belum
git add .
git commit -m "feat: ready for Vercel + Neon deploy"
git remote add origin https://github.com/<user>/lomba-new.git
git push -u origin main
```

**Pastikan `.env` di-ignore** — password di .env ga boleh masuk git.
Cek `.gitignore`:
```
.env
.env.*
!.env.example
```

## 3. Setup Vercel project

### 3.1 Import repo

1. Login ke https://vercel.com/dashboard
2. "Add New..." → "Project"
3. Pilih repo `lomba-new` (atau nama repo lo)
4. Framework preset: **Nuxt.js** (auto-detect)
5. **Build & Development Settings** — biarkan default Nuxt detection:
   - Build Command: `nuxt build`
   - Output Directory: `.output`
   - Install Command: `npm install`
6. **Environment Variables** — tambahkan **4 ini** (untuk Production,
   Preview, Development — checklist semuanya):

| Key                       | Value                                                              |
|---------------------------|--------------------------------------------------------------------|
| `NUXT_DATABASE_URL`       | Pooled connection string dari Step 1.2 (wajib include `-pooler` hostname) |
| `NUXT_SESSION_PASSWORD`   | Hex 32+ char — generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NITRO_PRESET`            | `vercel`                                                           |
| `ADMIN_PASSWORD`          | **Strong password** untuk admin (dipake `db:seed` first time). WAJIB di-set, jangan pake default `lomba123`. |

7. Klik "Deploy" — first build bakal 1-2 menit. Kalau gagal, cek build
   log di dashboard.

### 3.2 Function timeout (opsional)

Default Vercel Hobby: 10s. Kalau ada route yang butuh lebih (mis.
backup export, seed dari cold start), tambah `vercel.json` di root:
```json
{
  "functions": {
    "api/**/*.ts": { "maxDuration": 30 }
  }
}
```
Hobby max 30s. Pro 60s.

## 4. Apply schema + seed ke Neon

Setelah deploy berhasil (atau sebelum, gak ngaruh), apply schema dan seed
data ke Neon. Bisa dari local — Neon pooler support IPv4 jadi langsung
connect dari Windows:

```bash
cd "C:\Users\bangn\Documents\Kerja\lomba-new"

# 1. Apply schema (idempotent — CREATE TABLE IF NOT EXISTS)
node --import tsx/esm server/utils/db/migrate.ts

# 2. Seed default data (5 kategori, 8 lomba + settings)
#    PENTING: ADMIN_PASSWORD di-pull dari .env lokal atau shell env.
#    Kalau gak di-set, fallback ke "lomba123" — JANGAN ini di production.
npm run db:seed
```

Atau test dulu koneksi dari local tanpa affecting DB:
```bash
node --import tsx/esm scripts/test-neon.mts
```

## 5. Verify deploy

1. Buka URL Vercel project (auto-generated: `https://lomba-new-<hash>.vercel.app`)
2. Homepage harus show 8 lomba dari Neon
3. Login admin (`/admin`) → pakai `ADMIN_PASSWORD` yang lo set di Step 3.1
4. **Setelah first login**: langsung ke `/admin/settings` → ganti password
   sekali lagi (defense in depth, biar password Vercel env gak jadi single
   point of failure)

## 6. Custom domain (opsional)

Vercel project → Settings → Domains → tambah domain lo (mis.
`lomba.kampungmerdeka.id`). Ikut instruksi DNS propagation.

## Troubleshooting

### "NUXT_SESSION_PASSWORD env var is required in production"

Pastikan env var di-set di Vercel dashboard untuk **Production**
environment (bukan cuma Preview/Development). Re-deploy setelah set.

### "password authentication failed for user 'neondb_owner'"

- Cek password di Neon dashboard → project → "Connection Details"
  → reset kalau perlu.
- Pastikan URL pake **pooled** endpoint (hostname include `-pooler`),
  bukan direct endpoint.
- Cek env var di Vercel udah ke-pickup — re-deploy setelah update env.

### "connection timeout" / "ECONNREFUSED"

- Region salah — pastikan URL pake `aws-0-ap-southeast-1` (Singapore)
  atau region Neon project lo.
- Pool URL salah — jangan pake direct endpoint (port 5432), selalu pake
  pooled endpoint (`-pooler` hostname, port 5432 juga tapi hostname-nya
  yg beda).

### Build sukses tapi API return 500

Buka Vercel → project → "Logs" tab. Most common: missing env var, or
pg.Pool init error. Cek juga "Functions" tab → "Logs" untuk runtime errors.

### Cold start lambat (~1-2s extra first request)

Normal di Neon free tier — compute auto-suspend setelah 5 menit idle,
first request setelah itu butuh wake up. Untuk high-traffic app,
upgrade ke Neon scale plan (no auto-suspend).

## Rollback

Kalau deploy gagal dan mau balik ke local dev:
1. Set `.env` lokal pake Neon pooled connection string
2. `npm run db:seed` untuk populate database kalau perlu
3. `npx nuxt dev` jalanin local server

## Maintenance

- **Backup**: endpoint `/api/admin/backup` export JSON semua data
  (settings + kategori + lomba + pendaftar). Simpan secara berkala.
- **Schema migration**: tambah `ensureXxxColumn()` di `server/utils/db/migrations.ts`
  (pakai `ADD COLUMN IF NOT EXISTS` — Postgres 9.6+). File `schema.sql`
  di-update untuk fresh installs.
- **Vercel logs**: https://vercel.com/dashboard → project → Logs tab.
  Free tier logs 1 jam retention. Upgrade untuk lebih.
- **Neon auto-suspend**: free tier sleep setelah 5 menit idle. First request
  berikutnya bakal ~1-2s lebih lambat. Bake ini ke user expectation
  untuk low-traffic events.

## Reference

- Vercel: https://vercel.com/docs
- Neon: https://neon.tech/docs
- node-postgres: https://node-postgres.com/
- Nuxt 3 + Vercel: https://nuxt.com/docs/getting-started/deployment
