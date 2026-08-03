import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updatePendaftar, deletePendaftar } from "@/lib/db";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";

const patchSchema = z.object({
  status: z.enum(["pending", "disetujui", "ditolak"]).optional(),
  alasanTolak: z.string().nullable().optional(),
  hadir: z.boolean().optional(),
  kategoriOverride: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const idNum = Number(id);
  if (isNaN(idNum)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const body = await req.json();
    const data = patchSchema.parse(body);
    const updates: Record<string, unknown> = {};
    if (data.status !== undefined) updates.status = data.status;
    if (data.alasanTolak !== undefined) updates.alasanTolak = data.alasanTolak;
    if (data.hadir !== undefined) updates.hadir = data.hadir;
    if (data.kategoriOverride !== undefined) updates.kategoriId = data.kategoriOverride;
    await updatePendaftar(idNum, updates);
    // Invalidate all admin pages that show pendaftar counts/derived data
    revalidatePath("/admin");
    revalidatePath("/admin/approval");
    revalidatePath("/admin/peserta");
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid", details: e.issues }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const idNum = Number(id);
  if (isNaN(idNum)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await deletePendaftar(idNum);
  revalidatePath("/admin");
  revalidatePath("/admin/approval");
  revalidatePath("/admin/peserta");
  return NextResponse.json({ ok: true });
}
