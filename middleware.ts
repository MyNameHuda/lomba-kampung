import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/lomba", "/lomba/", "/admin/login"];
const ADMIN_PREFIX = "/admin";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get("lomba_kampung_session");

  // Public path: allow
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/lomba/") || pathname.startsWith("/api/public/")) {
    return NextResponse.next();
  }

  // Admin path: require session
  if (pathname.startsWith(ADMIN_PREFIX) && pathname !== "/admin/login") {
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  // For all dynamic routes, prevent Vercel CDN from caching the response.
  // Without this, `X-Vercel-Cache: HIT` causes stale data after CRUD ops:
  // user deletes a kategori, UI updates optimistically, but on reload the
  // CDN serves the OLD HTML (3 kats instead of 2). The user's edits "vanish".
  const response = NextResponse.next();
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api/public).*)"],
};
