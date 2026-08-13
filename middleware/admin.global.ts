// Global route middleware — runs on every navigation.
// Protects /admin/* routes (except /admin/login).
// Nuxt 3 port of Next.js middleware.ts.
//
// CRITICAL: use `useRequestFetch()` instead of bare `$fetch` here.
// - On SSR, bare `$fetch` (from ofetch) cannot resolve a relative URL
//   like "/api/admin/check-session" because there is no base URL on the
//   server-side fetch. That throws "Failed to parse URL".
// - `useRequestFetch()` returns a $fetch instance bound to the current
//   request: it resolves the base URL on the server AND auto-forwards
//   the incoming request's cookies (so check-session sees the user's
//   session cookie). On the client it's the regular $fetch.
//
// Explicit imports for vue-tsc typecheck (auto-imports are runtime-only).
import { defineNuxtRouteMiddleware, navigateTo, useRequestFetch } from "#imports";

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith("/admin")) return;
  if (to.path === "/admin/login") return;

  try {
    const fetchWithCookies = useRequestFetch();
    const res = await fetchWithCookies<{ isAdmin: boolean }>("/api/admin/check-session", {
      method: "GET",
      credentials: "include",
    });
    if (!res?.isAdmin) {
      return navigateTo("/admin/login");
    }
  } catch {
    return navigateTo("/admin/login");
  }
});