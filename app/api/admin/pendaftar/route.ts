import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createPendaftar, getLombaById, bulkDeletePendaftar } from "@/lib/db";
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

const deleteSchema = z.object({
  // "pending" → only rows with status='pending' (the approval queue)
  // "all"     → every row in the pendaftar table (full reset)
  scope: z.enum(["pending", "all"]),
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

    revalidatePath("/admin");
    revalidatePath("/admin/approval");
    revalidatePath("/admin/peserta");
    revalidatePath(`/admin/peserta/${data.lombaId}`);

    return NextResponse.json({ ok: true, id: result.id, nomor: result.nomor });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid", details: e.issues }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Bulk delete — used by the "Hapus semua" button on /admin/approval.
// Body: { scope: "pending" | "all" }
export async function DELETE(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const data = deleteSchema.parse(body);
    const deleted = await bulkDeletePendaftar(data.scope);
    revalidatePath("/admin");
    revalidatePath("/admin/approval");
    revalidatePath("/admin/peserta");
    return NextResponse.json({ ok: true, deleted, scope: data.scope });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid", details: e.issues }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
