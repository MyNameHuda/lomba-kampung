# Lomba Kampung (Nuxt 3 port)

Web app buat ngatur lomba 17 Agustus (HUT RI) di skala kampung. **Vue 3 / Nuxt 3 port** dari versi Next.js 14 — fitur, schema DB, dan behavior identik 1:1.

## Stack migrasi (Next.js 14 → Nuxt 3)

| Layer | Next.js 14 (lomba-app) | Nuxt 3 (lomba-new) |
| --- | --- | --- |
| Framework | Next.js 14 App Router | Nuxt 3 (file-based routing) |
| UI runtime | React 18 | Vue 3 (Composition API + `<script setup>`) |
| Styling | Tailwind 3 + globals.css | Tailwind 3 + main.css (identik) |
| Database | libSQL/Turso | Postgres 16 / Neon (migrated 2026-08-12) |
| Auth | iron-session | `useSession` H3 (sealed cookie) |
| Validation | Zod | Zod |
| Excel | ExcelJS | ExcelJS |
| Build tool | Webpack/Turbopack | Vite + Nitro |

## Fitur (port lengkap)

- **Manajemen lomba** — CRUD lomba, kategori usia dinamis, PJ multi-orang per kategori.
- **Pendaftaran publik** — form 3-step, no login, no captcha. Generate nomor peserta auto-increment per tahun.
- **Approval queue** — admin approve/reject pendaftar, bulk actions, client-side filter.
- **Stage system v4** — Kualifikasi per-kategori (Loloskan/Gugur) → Final (Juara 1/2/3) → Selesai.
- **3-fase flow opt-in** — Kualifikasi → Semi Final → Final.
- **Backup & export** — download JSON seluruh data, restore via reset.
- **Excel export** — multi-sheet per lomba + summary sheet "Peserta".
- **Mobile-first** — 414px jadi baseline, touch target 44px min.

## Struktur project

```
lomba-new/
├── app.vue                    # Root component
├── error.vue                  # Error page
├── nuxt.config.ts             # Nuxt config
├── tailwind.config.ts
├── postcss.config.mjs
├── assets/css/main.css        # Tailwind + globals (paralel dgn Next)
├── public/                    # Static assets (logo, bg images)
├── components/                # Auto-imported Vue components
│   ├── AdminShell.vue
│   ├── AdminLoadingChrome.vue
│   ├── DownloadExcelButton.vue
│   ├── KatTag.vue
│   ├── NotifyProvider.vue
│   └── Skeleton.vue
├── composables/
│   └── useNotify.ts
├── middleware/
│   └── admin.global.ts        # Route guard for /admin/*
├── pages/                     # File-based routing
│   ├── index.vue              # Public home
│   ├── lomba/[id]/            # Public lomba detail
│   │   ├── index.vue
│   │   └── daftar/            # Daftar form 3-step
│   │       ├── index.vue
│   │       └── sukses.vue
│   └── admin/
│       ├── login.vue
│       ├── index.vue          # Dashboard
│       ├── lomba/             # CRUD lomba + Juara
│       ├── approval.vue
│       ├── peserta/           # Daftar peserta
│       ├── input-manual.vue
│       └── pengaturan.vue
├── server/
│   ├── api/                   # H3 API routes
│   │   ├── health.get.ts
│   │   ├── pendaftar/index.post.ts        # Public register
│   │   └── admin/             # Admin endpoints (incl. peserta-excel.get.ts + peserta-excel/[lombaId].get.ts)
│   ├── middleware/
│   │   └── 00.session.ts      # Init sealed cookie session
│   └── utils/
│       ├── auth.ts            # getSession, isAuthenticated, hashPassword
│       └── db/                # DB layer (semua sama dgn Next)
├── utils/                     # Shared client+server
│   ├── format.ts
│   ├── constants.ts
│   ├── types.ts
│   └── excel-sort.ts
├── docs/
│   └── STAGE_SYSTEM.md
└── tests/                     # E2E tests (revisit after port done)
```

## Setup local

```bash
# Prasyarat: Node.js 22+
node --version

# Install deps
npm install

# Setup env
cp .env.example .env
# Edit .env: set NUXT_SESSION_PASSWORD (random 32+ char)

# Seed local DB (auto-creates ./lomba.db)
npm run db:seed

# Dev server
npm run dev
# → http://localhost:3000
```

## Deploy ke Vercel + Neon

Lihat **[DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md)** untuk step-by-step lengkap.

Quick reference env vars di Vercel:
```bash
NUXT_DATABASE_URL=postgresql://...neon.tech/...?sslmode=require&channel_binding=require
NUXT_SESSION_PASSWORD=<random 32+ char hex>
NITRO_PRESET=vercel
ADMIN_PASSWORD=<strong password untuk first seed — WAJIB di-set>
```

## Scripts

| Script              | Fungsi                                              |
|---------------------|-----------------------------------------------------|
| `npm run dev`       | Dev server (Vite)                                   |
| `npm run build`     | Production build (Nitro)                            |
| `npm run start`     | Run production build                                |
| `npm run db:push`   | Apply schema ke DB target                           |
| `npm run db:seed`   | Seed default kategori + 8 contoh lomba              |

## Security

- `NUXT_SESSION_PASSWORD` wajib random 32+ char di production (auto-throw on boot).
- Cookie: `httpOnly`, `secure` (production), `sameSite: lax`.
- Zod validation di semua POST endpoint.
- `isAuthenticated()` guard di semua `/server/api/admin/*` route.
- Default admin password `lomba123` — **WAJIB di-set** `ADMIN_PASSWORD` env var sebelum seed, atau diganti setelah first login. Lihat [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) § "PENTING — Default Admin Password".
- Password hashing: SHA256+static salt (prototype only; TODO: bcrypt/argon2).

## License

MIT — bebas dipakai untuk lomba kampung manapun. Merdeka.
