import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updatePendaftar, deletePendaftar, getLombaById, getPendaftarById } from "@/lib/db";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";

const patchSchema = z.object({
  // Approval & attendance
  status: z.enum(["pending", "disetujui", "ditolak"]).optional(),
  alasanTolak: z.string().nullable().optional(),
  hadir: z.boolean().optional(),
  kategoriOverride: z.string().optional(),
  // Editable core fields (CRUD)
  nama: z.string().min(2).max(100).optional(),
  noWa: z.string().max(50).nullable().optional(),
  umur: z.number().int().min(1).max(120).optional(),
  jenisKelamin: z.enum(["L", "P"]).optional(),
  kategoriId: z.string().min(1).optional(),
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

    // If changing kategoriId, validate it's eligible for the lomba
    if (data.kategoriId) {
      const existing = await getPendaftarById(idNum);
      if (!existing) return NextResponse.json({ error: "Peserta tidak ditemukan" }, { status: 404 });
      const l = await getLombaById(existing.lombaId);
      if (!l) return NextResponse.json({ error: "Lomba tidak ditemukan" }, { status: 404 });
      const eligible = Array.isArray(l.kategoriEligible) ? l.kategoriEligible : [];
      if (!eligible.includes(data.kategoriId)) {
        return NextResponse.json(
          { error: `Kategori '${data.kategoriId}' bukan eligible untuk lomba ini` },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (data.status !== undefined) updates.status = data.status;
    if (data.alasanTolak !== undefined) updates.alasanTolak = data.alasanTolak;
    if (data.hadir !== undefined) updates.hadir = data.hadir ? 1 : 0;
    if (data.kategoriOverride !== undefined) updates.kategoriId = data.kategoriOverride;
    // CRUD fields
    if (data.nama !== undefined) updates.nama = data.nama.trim();
    if (data.noWa !== undefined) updates.noWa = data.noWa?.trim() || null;
    if (data.umur !== undefined) updates.umur = data.umur;
    if (data.jenisKelamin !== undefined) updates.jenisKelamin = data.jenisKelamin;
    if (data.kategoriId !== undefined) updates.kategoriId = data.kategoriId;
    updates.updatedAt = Math.floor(Date.now() / 1000);

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
  const existing = await getPendaftarById(idNum);
  if (!existing) return NextResponse.json({ error: "Peserta tidak ditemukan" }, { status: 404 });
  await deletePendaftar(idNum);
  revalidatePath("/admin");
  revalidatePath("/admin/approval");
  revalidatePath("/admin/peserta");
  return NextResponse.json({ ok: true });
}
