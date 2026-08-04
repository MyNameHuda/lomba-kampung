import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { upsertKategori, getKategori, deleteKategori } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { z } from "zod";

const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/, "harus hex 6 digit");
const schema = z.object({
  id: z.string().min(1).max(50).optional(),
  nama: z.string().min(1).max(50),
  icon: z.string().min(1).max(50).default("fa-user"),
  min: z.number().int().min(1).max(150),
  max: z.number().int().min(1).max(150),
  urutan: z.number().int().min(0).default(0),
  autoAge: z.boolean().default(false),
  colorBg: HEX.optional(),
  colorText: HEX.optional(),
  colorBorder: HEX.optional(),
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
    // Helper to look up existing row by id (for partial-update color preservation).
    const existingById = async (id: string) => {
      const all = await getKategori();
      return all.find((k) => k.id === id) || null;
    };
    const body = await req.json();
    const data = schema.parse(body);
    const id = data.id || `k_${Date.now()}`;
    const isAdult = data.min >= 18;
    // Look up existing colors so partial updates don't blank out the colors.
    // (POST acts as upsert — UI may submit only some fields.)
    const existing = await existingById(id);
    await upsertKategori({
      id,
      nama: data.nama,
      icon: data.icon,
      min: data.min,
      max: data.max,
      urutan: data.urutan,
      autoAge: data.autoAge || isAdult,
      colorBg: data.colorBg ?? existing?.colorBg ?? "#FEF3C7",
      colorText: data.colorText ?? existing?.colorText ?? "#92400E",
      colorBorder: data.colorBorder ?? existing?.colorBorder ?? "#FDE68A",
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
