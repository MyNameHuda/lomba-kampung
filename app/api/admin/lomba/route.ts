import { NextResponse } from "next/server";
import { createLomba, getLomba, setLombaKategori } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { z } from "zod";

const pjSchema = z.object({
  kategoriId: z.string().min(1),
  pjNama: z.string().min(2).max(100),
  pjKontak: z.string().max(50).nullable().optional(),
});

const lombaSchema = z.object({
  nama: z.string().min(2).max(100),
  emoji: z.string().min(1).max(8).default("🏆"),
  deskripsi: z.string().max(500).nullable().optional(),
  syarat: z.array(z.string().min(1).max(200)).max(20).default([]),
  kategoriEligible: z.array(z.string().min(1)).min(1).max(10),
  pjList: z.array(pjSchema).min(1).max(10),
  status: z.enum(["draft", "aktif", "selesai"]).default("aktif"),
  urutan: z.number().int().min(0).default(0),
});

// Note: lomba.pj_nama and pj_kontak are no longer used; pj per kategori lives in lomba_kategori table.

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, data: await getLomba(true) });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const data = lombaSchema.parse(body);

    // Validate pjList covers every eligible kategori exactly once
    const eligible = new Set(data.kategoriEligible);
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

    const id = await createLomba({
      nama: data.nama,
      emoji: data.emoji,
      deskripsi: data.deskripsi ?? null,
      syarat: data.syarat,
      kategoriEligible: data.kategoriEligible,
      status: data.status,
      urutan: data.urutan,
    });
    await setLombaKategori(id, data.pjList.map((p) => ({
      kategoriId: p.kategoriId,
      pjNama: p.pjNama,
      pjKontak: p.pjKontak ?? null,
    })));
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid", details: e.issues }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
