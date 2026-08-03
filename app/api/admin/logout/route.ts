import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  session.destroy();

  // If the request expects HTML (form submit), redirect to home.
  // Otherwise (fetch/AJAX), return JSON.
  const accept = req.headers.get("accept") || "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/", req.url), { status: 303 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  // Allow GET for direct browser visits / link clicks
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
