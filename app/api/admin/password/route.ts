import { NextResponse } from "next/server";
import { getSettings, updateAdminPassword } from "@/lib/db";
import { hashPassword, verifyPassword, isAuthenticated } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const s = await getSettings();
    if (!s) {
      return NextResponse.json({ error: "Settings belum di-seed" }, { status: 500 });
    }
    if (!verifyPassword(data.oldPassword, s.adminPasswordHash)) {
      return NextResponse.json({ error: "Password lama salah" }, { status: 400 });
    }
    const newHash = hashPassword(data.newPassword);
    await updateAdminPassword(newHash);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid", details: e.issues }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
