// Backward-compat redirects for old /lomba/:id/daftar/* URLs.
//
// Why this file exists: the form was moved from pages/lomba/[id]/daftar/
// (nested) to pages/lomba/daftar/[id] (flat) to break a Nuxt 3 parent-child
// route trap (see "Nuxt 3 parent-child routing gotcha" in agent memory).
// We still get traffic to the old URL from:
//   - Bookmarks saved before the restructure
//   - Browser autofill of form fields
//   - Old screenshots / WA messages sharing the link
//   - Indexed pages from before the move
// We use a server middleware (instead of routeRules redirect) because the
// routeRules function form does NOT auto-substitute path params in Nitro
// (gives "Location: /" instead of the substituted URL), and the plain
// string form gives literal ":id" in Location header.
//
// Pattern: /lomba/<id>/daftar  ->  /lomba/daftar/<id>
// Pattern: /lomba/<id>/daftar/sukes  ->  /pendaftaran/sukes
// (sukes was a typo; original form page was at this path before the rename)
import { getRequestURL, sendRedirect } from "h3";

export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  // Match /lomba/<id>/daftar with optional trailing path (e.g. /sukes)
  const m = url.pathname.match(/^\/lomba\/([^/]+)\/daftar(\/.*)?$/);
  if (!m) return;
  const id = m[1];
  const rest = m[2] || "";
  // /lomba/<id>/daftar/sukes -> /pendaftaran/sukes (typo path, preserve "sukes" intent)
  if (rest === "/sukes") {
    return sendRedirect(event, "/pendaftaran/sukes", 301);
  }
  // /lomba/<id>/daftar -> /lomba/daftar/<id>
  return sendRedirect(event, `/lomba/daftar/${id}`, 301);
});
