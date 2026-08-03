import { NextResponse } from "next/server";
import { updateSettings, getSettings } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  appName: z.string().min(1).max(100),
  kampungName: z.string().min(1).max(100),
  tahunAktif: z.string().min(1).max(50),
});

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const s = await getSettings();
  return NextResponse.json({ ok: true, data: s });
}

export async function PUT(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const data = schema.parse(body);
    await updateSettings(data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid", details: e.issues }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
