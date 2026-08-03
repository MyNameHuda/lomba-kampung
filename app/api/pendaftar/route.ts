import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createPendaftar, getLombaById } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  nama: z.string().min(2).max(100),
  noWa: z.string().nullable().optional(),
  jenisKelamin: z.enum(["L", "P"]),
  kategoriId: z.string().min(1),
  umur: z.number().int().min(1).max(120),
  lombaId: z.number().int().positive(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    const l = await getLombaById(data.lombaId);
    if (!l || l.status !== "aktif") {
      return NextResponse.json({ error: "Lomba tidak ditemukan" }, { status: 404 });
    }
    if (!l.kategoriEligible.includes(data.kategoriId)) {
      return NextResponse.json({ error: "Kategori tidak eligible untuk lomba ini" }, { status: 400 });
    }

    const result = await createPendaftar({
      nama: data.nama,
      noWa: data.noWa ?? null,
      jenisKelamin: data.jenisKelamin,
      kategoriId: data.kategoriId,
      umur: data.umur,
      lombaId: data.lombaId,
      sumber: "publik",
    });

    // Invalidate admin pages so stats update on next navigation
    revalidatePath("/admin");
    revalidatePath("/admin/approval");
    revalidatePath("/admin/peserta");
    revalidatePath(`/admin/peserta/${data.lombaId}`);

    return NextResponse.json({ ok: true, nomor: result.nomor });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid", details: e.issues }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
