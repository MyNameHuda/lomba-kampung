import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updateLomba, deleteLomba, getLombaById, setLombaKategori, setLombaJadwal } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { z } from "zod";

const pjSchema = z.object({
  kategoriId: z.string().min(1),
  pjNama: z.string().min(2).max(100),
  pjKontak: z.string().max(50).nullable().optional(),
});

const jadwalSchema = z.object({
  kategoriId: z.string().min(1),
  tanggal: z.number().int().nullable().optional(),
  jam: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

const lombaSchema = z.object({
  nama: z.string().min(2).max(100).optional(),
  emoji: z.string().min(1).max(8).optional(),
  deskripsi: z.string().max(500).nullable().optional(),
  syarat: z.array(z.string().min(1).max(200)).max(20).optional(),
  kategoriEligible: z.array(z.string().min(1)).min(1).max(10).optional(),
  pjList: z.array(pjSchema).min(1).max(30).optional(),
  // Jadwal pelaksanaan per (lomba, kategori). Empty array = clear all jadwal.
  jadwalList: z.array(jadwalSchema).max(10).optional(),
  status: z.enum(["draft", "aktif", "selesai"]).optional(),
  urutan: z.number().int().min(0).optional(),
  // v4: finalisCount removed from active use. Kept optional for back-compat
  // with old payloads (silently ignored).
  finalisCount: z.number().int().min(1).max(50).optional(),
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

    // If pjList provided, validate it covers the (possibly updated) eligible kategori.
    // Multi-PJ allowed — same kategori can appear multiple times.
    if (data.pjList) {
      const eligible = new Set(data.kategoriEligible || existing.kategoriEligible);
      const pjCountByKat = new Map<string, number>();
      for (const pj of data.pjList) {
        if (!eligible.has(pj.kategoriId)) {
          return NextResponse.json(
            { error: `Kategori '${pj.kategoriId}' di pjList bukan eligible untuk lomba ini` },
            { status: 400 }
          );
        }
        pjCountByKat.set(pj.kategoriId, (pjCountByKat.get(pj.kategoriId) ?? 0) + 1);
      }
      for (const k of eligible) {
        if (!pjCountByKat.has(k) || pjCountByKat.get(k) === 0) {
          return NextResponse.json(
            { error: `Kategori '${k}' belum ada PJ-nya di pjList` },
            { status: 400 }
          );
        }
      }
      for (const [k, n] of pjCountByKat) {
        if (n > 5) {
          return NextResponse.json(
            { error: `Kategori '${k}' punya ${n} PJ — maksimal 5` },
            { status: 400 }
          );
        }
      }
    }

    // Separate pjList from lomba fields
    const { pjList, jadwalList, ...lombaFields } = data;
    await updateLomba(idNum, lombaFields);
    if (pjList) {
      await setLombaKategori(idNum, pjList.map((p) => ({
        kategoriId: p.kategoriId,
        pjNama: p.pjNama,
        pjKontak: p.pjKontak ?? null,
      })));
    }
    if (jadwalList) {
      await setLombaJadwal(idNum, jadwalList.map((j) => ({
        kategoriId: j.kategoriId,
        tanggal: j.tanggal ?? null,
        jam: j.jam ?? null,
      })));
    }
    revalidatePath("/admin");
    revalidatePath("/admin/lomba");
    revalidatePath("/");
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
  revalidatePath("/admin");
  revalidatePath("/admin/lomba");
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
