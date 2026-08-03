import { NextResponse } from "next/server";
import { updateLomba, deleteLomba, getLombaById, setLombaKategori } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { z } from "zod";

const pjSchema = z.object({
  kategoriId: z.string().min(1),
  pjNama: z.string().min(2).max(100),
  pjKontak: z.string().max(50).nullable().optional(),
});

const lombaSchema = z.object({
  nama: z.string().min(2).max(100).optional(),
  emoji: z.string().min(1).max(8).optional(),
  deskripsi: z.string().max(500).nullable().optional(),
  syarat: z.array(z.string().min(1).max(200)).max(20).optional(),
  kategoriEligible: z.array(z.string().min(1)).min(1).max(10).optional(),
  pjList: z.array(pjSchema).min(1).max(10).optional(),
  status: z.enum(["draft", "aktif", "selesai"]).optional(),
  urutan: z.number().int().min(0).optional(),
});

// Note: pj_nama / pj_kontak on lomba are no longer used (lomba_kategori owns pj per-kategori).

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const idNum = Number(id);
  if (isNaN(idNum)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const existing = await getLombaById(idNum);
  if (!existing) return NextResponse.json({ error: "Lomba tidak ditemukan" }, { status: 404 });
  try {
    const body = await req.json();
    const data = lombaSchema.parse(body);

    // If pjList provided, validate it covers the (possibly updated) eligible kategori
    if (data.pjList) {
      const eligible = new Set(data.kategoriEligible || existing.kategoriEligible);
      const pjKatSet = new Set(data.pjList.map((p) => p.kategoriId));
      if (pjKatSet.size !== data.pjList.length) {
        return NextResponse.json({ error: "Ada kategori duplikat di pjList" }, { status: 400 });
      }
      for (const pj of data.pjList) {
        if (!eligible.has(pj.kategoriId)) {
          return NextResponse.json({ error: `Kategori '${pj.kategoriId}' di pjList bukan eligible untuk lomba ini` }, { status: 400 });
        }
      }
      for (const k of eligible) {
        if (!pjKatSet.has(k)) {
          return NextResponse.json({ error: `Kategori '${k}' belum ada PJ-nya di pjList` }, { status: 400 });
        }
      }
    }

    // Separate pjList from lomba fields
    const { pjList, ...lombaFields } = data;
    await updateLomba(idNum, lombaFields);
    if (pjList) {
      await setLombaKategori(idNum, pjList.map((p) => ({
        kategoriId: p.kategoriId,
        pjNama: p.pjNama,
        pjKontak: p.pjKontak ?? null,
      })));
    }
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
  const existing = await getLombaById(idNum);
  if (!existing) return NextResponse.json({ error: "Lomba tidak ditemukan" }, { status: 404 });
  await deleteLomba(idNum);
  return NextResponse.json({ ok: true });
}
