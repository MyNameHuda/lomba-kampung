import { NextResponse } from "next/server";
import { createPendaftar, getLombaById } from "@/lib/db";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";

const postSchema = z.object({
  nama: z.string().min(2).max(100),
  jenisKelamin: z.enum(["L", "P"]),
  kategoriId: z.string().min(1),
  umur: z.number().int().min(1).max(120),
  lombaId: z.number().int().positive(),
  hadir: z.boolean().optional(),
});

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const data = postSchema.parse(body);
    const l = await getLombaById(data.lombaId);
    if (!l) return NextResponse.json({ error: "Lomba tidak ditemukan" }, { status: 404 });

    const result = await createPendaftar({
      nama: data.nama,
      noWa: null,
      jenisKelamin: data.jenisKelamin,
      kategoriId: data.kategoriId,
      umur: data.umur,
      lombaId: data.lombaId,
      sumber: "manual",
      hadir: data.hadir ?? false,
      status: "disetujui",
    });

    return NextResponse.json({ ok: true, nomor: result.nomor });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid", details: e.issues }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
