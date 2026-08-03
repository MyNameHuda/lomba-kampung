# 🇮🇩 Lomba Kampung

Web app manajemen lomba 17 Agustus (HUT RI) untuk skala kampung. Mobile-first, ringan, gratis sepenuhnya, tanpa jadwal/kuota.

**Stack:** Next.js 14 · TypeScript · Tailwind · libSQL (Turso) · iron-session · Zod

---

## ✨ Fitur

- 🏆 **Manajemen lomba** — CRUD lomba, kategori usia, dan Penanggung Jawab (PJ) per kategori
- 📝 **Pendaftaran publik** — form 3-step mobile-friendly, tanpa login
- ✅ **Approval queue** — admin approve/reject pendaftar yang masuk
- 📋 **Daftar peserta** — lihat per lomba, tandai hadir, grouped by usia (Balita / Anak L/P / Dewasa)
- 🏷️ **Kategori dinamis** — tambah/edit/hapus kategori usia, urutan fleksibel
- 💾 **Backup & export** — download JSON seluruh data, restore via reset
- 📱 **Mobile-first** — dioptimasi untuk HP low-end warga kampung

---

## 🚀 Deploy (Vercel + Turso) — GRATIS, NO DOCKER

Path ini yang paling recommended. **Total biaya: $0/bulan** selamanya (selama di bawah Vercel + Turso free tier limits).

### Arsitektur

- **Vercel** — hosting Next.js (free tier: 100GB bandwidth, unlimited requests untuk hobby)
- **Turso** — managed libSQL database (free tier: 9GB storage, 1B row reads/bulan, 500 region)
- **GitHub** — source code + auto-deploy on push

### Step 1: Setup Turso (5 menit)

Install Turso CLI (Windows pakai WSL atau download dari [turso.tech/cli](https://turso.tech/cli)):

```bash
# Login
turso auth login

# Create database
turso db create lomba-kampung

# Get connection URL
turso db show lomba-kampung --url
# Output: libsql://lomba-kampung-<your-org>.turso.io

# Create auth token
turso db tokens create lomba-kampung
# Output: eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

Simpan URL dan token — ini akan dimasukkan ke Vercel.

### Step 2: Push schema + seed ke Turso

Sekali ini aja (pertama kali deploy), untuk populate database di Turso:

```bash
# Set env ke Turso (bukan local)
export DATABASE_URL="libsql://lomba-kampung-<your-org>.turso.io"
export DATABASE_AUTH_TOKEN="<token-dari-step-1>"

# Apply schema (CREATE TABLE IF NOT EXISTS)
npm run db:push

# Seed default data (kategori + 8 contoh lomba)
npm run db:seed
```

### Step 3: Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create lomba-kampung --public --source=. --remote=origin --push
```

Atau push ke repo yang sudah ada:
```bash
git remote add origin git@github.com:<username>/lomba-kampung.git
git push -u origin main
```

### Step 4: Deploy ke Vercel (3 menit)

1. Buka [vercel.com/new](https://vercel.com/new)
2. **Import** repo GitHub `lomba-kampung`
3. **Environment Variables** — tambahkan 3 ini:
   - `SESSION_PASSWORD` → generate dengan `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (paste hasilnya, JANGAN pakai default)
   - `DATABASE_URL` → `libsql://...` dari Step 1
   - `DATABASE_AUTH_TOKEN` → token dari Step 1
4. Klik **Deploy**

Vercel akan build + deploy dalam ~60 detik. URL production akan muncul (mis. `lomba-kampung.vercel.app`).

### Step 5: Ganti admin password

Default admin password adalah `lomba123`. Setelah deploy:
1. Buka `https://<your-app>.vercel.app/admin/login`
2. Login dengan `lomba123`
3. Buka **Pengaturan → Ubah Password**
4. Ganti ke password yang kuat

### Step 6 (opsional): Custom domain

Di Vercel → Project → Settings → Domains, tambahkan domain kamu (mis. `lomba.kampungku.id`). Free SSL otomatis.

---

## 💻 Local Development

### Prasyarat

- **Node.js 22.5+** (untuk libSQL & Next.js 14.2+)
- **Git**

### Setup

```bash
# Clone & install
git clone <repo-url> lomba-kampung
cd lomba-kampung
npm install

# Copy env
cp .env.example .env.local
# Edit .env.local: set SESSION_PASSWORD (min 32 char random)

# Seed local DB (file:./lomba.db)
npm run db:seed

# Run dev server (Turbopack, 5-10× faster compile)
npm run dev
```

Buka `http://localhost:3000`. Login admin: `/admin/login` → password `lomba123`.

### Scripts

| Script              | Fungsi                                                |
|---------------------|-------------------------------------------------------|
| `npm run dev`       | Dev server dengan Turbopack (fast refresh)            |
| `npm run build`     | Production build                                      |
| `npm run start`     | Run production build (set NODE_ENV=production dulu)   |
| `npm run db:seed`   | Seed kategori + 8 contoh lomba ke local/Turso DB      |
| `npm run db:push`   | Apply schema.sql ke Turso (untuk migration)           |
| `npm run db:reset`  | Hapus local DB + seed ulang (dev only)                |

### Switching antara local & Turso

```bash
# Local (default — uses ./lomba.db)
unset DATABASE_URL
unset DATABASE_AUTH_TOKEN
npm run dev

# Turso (untuk test dengan production data)
export DATABASE_URL="libsql://..."
export DATABASE_AUTH_TOKEN="..."
npm run dev
```

---

## 🗃️ Schema

Lihat `lib/db/schema.sql` (5 tabel: `settings`, `kategori`, `lomba`, `lomba_kategori`, `pendaftar`).

**Display grouping** (Balita / Anak L / Anak P / Dewasa) di-derive otomatis dari master `kategori` table — single source of truth. Section classification:
- `balita` — kategori dengan `min < 5`
- `anak` — `5 <= min < 18`, di-split L/P
- `dewasa` — `min >= 18` (no upper limit)

**Sort rules:**
- Dewasa: by `created_at` ASC (urutan daftar)
- Balita/Anak: by `umur` ASC, lalu `created_at` tiebreaker

---

## 🔒 Security Checklist (Production)

- [x] `SESSION_PASSWORD` ≥ 32 char random (wajib di production, app throws on boot jika tidak)
- [x] `secure` cookie flag otomatis aktif saat `NODE_ENV=production`
- [x] `httpOnly` cookie (tidak bisa diakses dari JS)
- [x] `sameSite: lax` (CSRF protection)
- [x] Zod validation di semua POST endpoints
- [x] Admin auth check (`isAuthenticated()`) di semua `/api/admin/*` routes
- [ ] **WAJIB:** Ganti default admin password `lomba123` setelah first login
- [ ] **OPSIONAL:** Migrate SHA256 → bcrypt/argon2 untuk password hashing (saat ini SHA256+static salt cukup untuk lomba kecil, tapi bcrypt lebih proper)

---

## 🛠️ Troubleshooting

### Build error: "URL_INVALID: The URL './lomba.db' is not in a valid format"

Local `DATABASE_URL` harus absolute path atau pakai `file:` prefix dengan absolute path. App sudah auto-resolve dari `./lomba.db` → `file:<cwd>/lomba.db`. Kalau masih error, pakai absolute:
```
DATABASE_URL=file:C:/Users/.../lomba.db
```

### Health check returns 503

Cek `DATABASE_URL` + `DATABASE_AUTH_TOKEN` di Vercel env vars. Pastikan token masih aktif di Turso (`turso db tokens list`).

### Schema tidak ter-apply di Turso

`client.execute()` di libSQL cuma execute statement pertama. Pakai `executeMultiple()` atau split manual. Script `db:push` sudah pakai `executeMultiple()` — jadi aman.

### Login admin gagal setelah deploy

Pastikan `SESSION_PASSWORD` di Vercel sama dengan yang dipakai di local. Kalau ganti password env, harus logout + login ulang.

---

## 📦 Tech Stack Details

| Layer        | Tool                              | Kenapa?                                        |
|--------------|-----------------------------------|------------------------------------------------|
| Framework    | Next.js 14 (App Router)           | SSR + Edge-ready, file-based routing           |
| Language     | TypeScript 5.6                    | Type safety, IDE intellisense                  |
| Styling      | Tailwind 3.4 + custom CSS         | Mobile-first, fast iteration                   |
| Database     | @libsql/client + Turso            | SQLite-compatible, free managed, edge-replicas |
| Auth         | iron-session                      | Stateless, encrypted cookie, no JWT overhead   |
| Validation   | Zod 3.23                          | Runtime + compile-time schema validation       |
| Build        | Turbopack (dev) + Webpack (prod)  | 5-10× faster dev compile                       |

---

## 📄 License

MIT — bebas dipakai untuk lomba kampung manapun. Merdeka! 🇮🇩
