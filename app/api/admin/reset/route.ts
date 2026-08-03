import { NextResponse } from "next/server";
import { resetAllData } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  confirm: z.string(),
});

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const data = schema.parse(body);
    if (data.confirm !== "HAPUS SEMUA DATA") {
      return NextResponse.json({ error: "Konfirmasi tidak valid. Ketik 'HAPUS SEMUA DATA' persis." }, { status: 400 });
    }
    await resetAllData(true);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid", details: e.issues }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
