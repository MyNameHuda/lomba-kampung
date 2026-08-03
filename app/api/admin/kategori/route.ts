import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { upsertKategori, getKategori, deleteKategori } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  id: z.string().min(1).max(50).optional(),
  nama: z.string().min(1).max(50),
  icon: z.string().min(1).max(50).default("fa-user"),
  min: z.number().int().min(1).max(150),
  max: z.number().int().min(1).max(150),
  urutan: z.number().int().min(0).default(0),
  autoAge: z.boolean().default(false),
}).refine((d) => d.min <= d.max, { message: "min harus <= max" });

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, data: await getKategori() });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const id = data.id || `k_${Date.now()}`;
    const isAdult = data.min >= 18;
    await upsertKategori({
      id,
      nama: data.nama,
      icon: data.icon,
      min: data.min,
      max: data.max,
      urutan: data.urutan,
      autoAge: data.autoAge || isAdult,
    });
    // Invalidate the settings page RSC cache so the next render picks up the new kategori.
    revalidatePath("/admin/pengaturan");
    revalidatePath("/");
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid", details: e.issues }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  await deleteKategori(id);
  // Invalidate RSC cache for any page that renders this data.
  revalidatePath("/admin/pengaturan");
  revalidatePath("/admin/lomba");
  revalidatePath("/admin/input-manual");
  revalidatePath("/lomba/[id]", "page");
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
