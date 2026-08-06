# Lomba Kampung

Web app buat ngatur lomba 17 Agustus (HUT RI) di skala kampung. Mobile-first,
gratis total di Vercel + Turso free tier, no jadwal, no kuota, password-only
admin.

Live demo: <https://lomba-app.vercel.app>

## Fitur

- **Manajemen lomba** — CRUD lomba, kategori usia dinamis (Balita / Anak L/P /
  Dewasa di-derive dari master `kategori` table), PJ multi-orang per kategori.
- **Pendaftaran publik** — form 3-step, no login, no captcha. Generate nomor
  peserta auto-increment per tahun.
- **Approval queue** — admin approve/reject pendaftar, bulk actions,
  client-side filter.
- **Stage system v4** — Kualifikasi per-kategori (Loloskan/Gugur) → Final
  (Juara 1/2/3) → Selesai. Lihat [`docs/STAGE_SYSTEM.md`](docs/STAGE_SYSTEM.md)
  buat detail lengkap.
- **Backup & export** — download JSON seluruh data, restore via reset.
- **Mobile-first** — dioptimasi untuk HP low-end warga kampung (viewport
  414px jadi baseline).

## Stack

| Layer        | Tool                                |
|--------------|-------------------------------------|
| Framework    | Next.js 14 (App Router) + Turbopack |
| Language     | TypeScript 5.6                      |
| Styling      | Tailwind 3.4 + custom CSS           |
| Database     | libSQL (Turso prod, SQLite local)   |
| Auth         | iron-session (encrypted cookie)     |
| Validation   | Zod 3.23                            |

Kenapa stack ini: semuanya free tier generous, zero Docker, deploy push-to-deploy
lewat Vercel. Detail di bawah.

## Deploy ke Vercel + Turso

Total biaya $0/bulan selama di bawah free tier (Vercel hobby, Turso 9GB).

### 1. Setup Turso

Turso CLI gampang di-install di macOS/Linux. Di Windows, cara termudah
pakai WSL atau langsung via web console di <https://app.turso.tech>.

```bash
# Login
turso auth login

# Create database (region terdekat, mis. Tokyo)
turso db create lomba-kampung --location aws-ap-northeast-1

# Ambil connection URL
turso db show lomba-kampung --url
# → libsql://lomba-kampung-<your-org>.turso.io

# Create auth token
turso db tokens create lomba-kampung
```

Simpan dua nilai itu — masuk ke Vercel di step 4.

### 2. Push schema + seed ke Turso

Clone repo ini dulu, terus apply schema ke Turso:

```bash
git clone https://github.com/MyNameHuda/lomba-kampung.git
cd lomba-kampung
npm install

export DATABASE_URL="libsql://lomba-kampung-<your-org>.turso.io"
export DATABASE_AUTH_TOKEN="<token-dari-step-1>"

npm run db:push    # apply schema.sql
npm run db:seed    # insert default kategori + 8 contoh lomba
```

### 3. Push ke GitHub

Buat repo baru di GitHub (atau fork yang ini), terus:

```bash
git remote set-url origin git@github.com:<username>/lomba-kampung.git
git push -u origin main
```

### 4. Deploy ke Vercel

1. Buka <https://vercel.com/new>
2. Import repo GitHub
3. **Environment Variables** (wajib):
   - `SESSION_PASSWORD` — generate dengan
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
     App throws on boot kalau missing atau < 32 char di production.
   - `DATABASE_URL` — `libsql://...` dari step 1
   - `DATABASE_AUTH_TOKEN` — token dari step 1
4. Klik **Deploy**

URL production bakal muncul dalam ~60 detik.

### 5. Ganti admin password

Default password `lomba123`. Setelah deploy, login di
`/admin/login`, terus **Pengaturan → Ubah Password**.

## Local development

```bash
# Prasyarat: Node.js 22.5+
node --version

# Setup
cp .env.example .env.local
# Edit .env.local: set SESSION_PASSWORD (random 32+ char)

# Local DB (SQLite file ./lomba.db) di-seed otomatis
npm run db:seed

# Dev server
npm run dev
# → http://localhost:3000
```

Untuk test koneksi ke Turso production, set `DATABASE_URL` + `DATABASE_AUTH_TOKEN`
di `.env.local` terus run `npm run dev` lagi.

## Scripts

| Script              | Fungsi                                              |
|---------------------|-----------------------------------------------------|
| `npm run dev`       | Dev server (Turbopack)                              |
| `npm run build`     | Production build                                    |
| `npm run start`     | Run production build                                |
| `npm run db:push`   | Apply `schema.sql` ke DB target                     |
| `npm run db:seed`   | Seed default kategori + 8 contoh lomba              |
| `npm run db:reset`  | Hapus local DB + seed ulang (dev only)              |

`db:push` pakai `executeMultiple()` jadi aman untuk multi-statement
`CREATE TABLE IF NOT EXISTS` di Turso HTTP.

## Testing

`test-v4-system.cjs` adalah E2E test untuk stage system v4. 28 assertions
yang cover full flow: schema → Loloskan/Gugur → Tutup Kualifikasi → Juara
picking → Selesaikan → public page.

```bash
# Butuh dev server jalan di :3000 atau target BASE di-set ke prod
node test-v4-system.cjs
```

Test ini jalan dari API + Puppeteer (Chrome). Output PASS/FAIL count di
akhir.

## Stage system v4 (ringkas)

Detail lengkap + migration history di [`docs/STAGE_SYSTEM.md`](docs/STAGE_SYSTEM.md).
TL;DR:

- **Finalist** state: `pendaftar.is_finalist` (tri-state: null=pending, 1=lolos,
  0=gugur). Gugur reversible.
- **Tutup Kualifikasi** per-kategori (independen). Disimpan sebagai JSON di
  kolom `lomba.phase` (kolom lama dari v3, gak butuh ALTER baru).
- **Juara 1/2/3** dari finalists, require kategori Tutup dulu.
- **Selesaikan Lomba** (status → 'selesai') require Juara 1+2 per eligible
  kategori.
- **Public page** punya 5 badge variant: Coming Soon, Sedang Berlangsung,
  Tahap Kualifikasi, Tahap Final / Juara Terpilih, Selesai.

Kenapa JSON di kolom existing bukan ALTER kolom baru: ada libSQL HTTP
schema-cache race di Vercel Lambda yang bikin UPDATE ke kolom baru kadang
gagal. Pattern JSON-in-existing-column menghindari itu total.

## Struktur project

```
app/                  # Next.js App Router
  page.tsx            # Public home (lomba list)
  lomba/[id]/         # Public lomba detail + daftar form
  admin/              # Admin dashboard (login required)
    lomba/            # CRUD lomba + Juara page
    approval/         # Approval queue
    peserta/          # Daftar peserta grouped
    pengaturan/       # Settings tabs
    input-manual/     # Manual pendaftar entry
  api/
    admin/            # Admin-only endpoints (auth + Zod)
    pendaftar/        # Public pendaftar POST
components/           # Shared React components
lib/
  auth.ts             # iron-session helpers
  db/                 # Database layer (libSQL)
    migrations.ts     # Self-healing migrations
    schema.sql        # Source of truth for schema
    seed.cjs          # Initial data seeder
    migrate.cjs       # db:push script
  types.ts            # Client-side slim types
  format.ts           # Date / string formatters
  constants.ts        # Icons, colors
docs/                 # Long-form docs (STAGE_SYSTEM.md)
public/               # Static assets (logo, hero bg)
test-v4-system.cjs    # Canonical E2E test
```

## Security

- `SESSION_PASSWORD` wajib random 32+ char di production (app validates on boot).
- Cookie: `httpOnly`, `secure` (auto di production), `sameSite: lax`.
- Zod validation di semua POST endpoint.
- `isAuthenticated()` guard di semua `/api/admin/*` route.
- Default admin password `lomba123` — **WAJIB diganti** setelah first login.
- Password hashing saat ini SHA256+static salt. Untuk lomba kecil udah cukup,
  tapi kalau mau lebih proper migrate ke bcrypt/argon2 (lihat TODO di
  `lib/auth.ts`).

## Troubleshooting

**`URL_INVALID: The URL './lomba.db' is not in a valid format`**
Local `DATABASE_URL` harus absolute atau `file:` prefix. App auto-resolve
dari `./lomba.db` ke `file:<cwd>/lomba.db`. Kalau masih error, pakai
absolute: `DATABASE_URL=file:C:/path/to/lomba.db`.

**Health check returns 503**
Cek `DATABASE_URL` + `DATABASE_AUTH_TOKEN` di Vercel env. Token bisa expire,
regenerate via `turso db tokens create lomba-kampung`.

**Schema gak ke-apply di Turso**
`client.execute()` di libSQL cuma execute statement pertama. Pakai
`executeMultiple()` atau split manual. `db:push` udah handle ini.

**Login admin gagal setelah deploy**
`SESSION_PASSWORD` di Vercel harus sama dengan yang dipake waktu seed. Kalau
ganti env var, logout + login ulang.

## License

MIT — bebas dipakai untuk lomba kampung manapun. Merdeka.
