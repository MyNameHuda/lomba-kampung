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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api/public).*)"],
};
