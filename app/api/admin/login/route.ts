import { NextResponse } from "next/server";
import { getSettings } from "@/lib/db";
import { getSession, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password wajib diisi" }, { status: 400 });
    }
    const s = await getSettings();
    if (!s) {
      return NextResponse.json({ error: "Settings belum di-seed" }, { status: 500 });
    }
    if (!verifyPassword(password, s.adminPasswordHash)) {
      return NextResponse.json({ error: "Password salah" }, { status: 401 });
    }
    const session = await getSession();
    session.isAdmin = true;
    session.loginAt = Date.now();
    await session.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
