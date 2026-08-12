// Nuxt 3 config — port of Next.js 14 config. Differences vs Next:
// - File-based routing under /pages (was /app in Next App Router)
// - API routes under /server/api (was /app/api in Next)
// - Server utilities under /server/utils are auto-imported
// - Tailwind via @nuxtjs/tailwindcss module (was manual PostCSS in Next)
// - `useSession` from h3 replaces iron-session (both use sealed cookies)
import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",

  // Dev server
  devServer: { port: 3000, host: "0.0.0.0" },

  // Disable Nuxt DevTools floating button (only affects `nuxt dev`).
  // Production builds never include it; this just hides the badge in local dev.
  // Re-enable temporarily for debugging: devtools: { enabled: true }
  devtools: { enabled: false },

  // Tailwind module
  modules: ["@nuxtjs/tailwindcss"],

  // CSS entry — matches Next's app/globals.css
  css: ["~/assets/css/main.css"],

  // App-level metadata
  app: {
    head: {
      title: "Lomba Kampung",
      htmlAttrs: { lang: "id" },
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=5" },
        { name: "description", content: "Manajemen Perlombaan 17 Agustus Tingkat Kampung" },
      ],
      link: [
        { rel: "icon", type: "image/webp", href: "/logo.webp" },
        { rel: "apple-touch-icon", href: "/logo.webp" },
        {
          rel: "stylesheet",
          href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
        },
        // Preconnect ke Neon DB pooler — browser mulai TCP/TLS handshake
        // sebelum page selesai load. Saves ~50-150ms RTT untuk first request
        // ke DB. Penting karena free-tier Neon bisa 1-2s cold start.
        {
          rel: "preconnect",
          href: "https://ep-misty-dawn-azpaztun-pooler.c-3.ap-southeast-1.aws.neon.tech",
          crossorigin: "",
        },
        {
          rel: "dns-prefetch",
          href: "https://ep-misty-dawn-azpaztun-pooler.c-3.ap-southeast-1.aws.neon.tech",
        },
      ],
    },
  },

  // Runtime config — public + private
  // Public keys are exposed to client; private only to server.
  // The app reads these via process.env.NUXT_* directly (see server/utils/db/client.ts
  // and server/utils/auth.ts) so the values here are mainly for Nuxt's own
  // env-mapping. Keep the keys present so `nuxt prepare` doesn't complain.
  runtimeConfig: {
    // Server-only — sourced from NUXT_* env vars
    sessionPassword: "", // NUXT_SESSION_PASSWORD — min 32 chars (required in prod)
    databaseUrl: "", // NUXT_DATABASE_URL — Supabase pooler (port 6543) for Vercel
    public: {
      appName: "Lomba Kampung",
    },
  },

  // Vercel deployment:
  //   - Set NITRO_PRESET=vercel in Vercel env (or run `nuxt build` locally
  //     with the vercel preset to generate .vercel/output).
  //   - Add to Vercel project env: NUXT_DATABASE_URL, NUXT_SESSION_PASSWORD.
  //   - pg.Pool uses max=1 per Vercel instance to stay under Supabase
  //     free plan's 15-conn pooler limit.
  //
  // (nitro config — defaults are fine; uncomment to tweak)
  // nitro: { preset: "vercel" },

  // TypeScript strict mode (matches Next TS config)
  typescript: {
    strict: true,
    typeCheck: false, // skip in build for speed; run `vue-tsc --noEmit` for full check
  },

  // Vite: tweak for Windows path quirks
  vite: {
    define: { __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false" },
  },

  // Backward-compat redirect: /lomba/:id/daftar -> /lomba/daftar/:id
  // Implemented in server/middleware/old-daftar-redirect.ts because the
  // routeRules function form doesn't auto-substitute :id in Nitro
  // (Location header becomes "/" instead of the substituted path).
  // The middleware also handles the old "/lomba/:id/daftar/sukes" typo.
});
