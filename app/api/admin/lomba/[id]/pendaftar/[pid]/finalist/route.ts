// Stage system v4 — set finalist state (loloskan / gugur / clear).
// POST /api/admin/lomba/[id]/pendaftar/[pid]/finalist
//   Body: { status: 1 | 0 | null }
//     1 = lolos (advance to final)
//     0 = gugur (eliminate)
//     null = reset to pending (un-loloskan / un-gugur)
//
// Pre-conditions:
//   - pendaftar exists, belongs to this lomba, status='disetujui'
//   - (lomba, kategori) is NOT yet Tutup (kualifikasi_tutup_at IS NULL)
//   - Juara 1/2/3 NOT yet picked for this pendaftar (auto-clear if status changes)
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import {
  getLombaById,
  getPendaftarById,
  setFinalist,
  clearJuaraRank,
} from "@/lib/db";

const schema = z.object({
  status: z.union([z.literal(1), z.literal(0), z.null()]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: lombaIdStr, pid: pidStr } = await params;
  const lombaId = Number(lombaIdStr);
  const pendaftarId = Number(pidStr);
  if (isNaN(lombaId) || isNaN(pendaftarId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const lomba = await getLombaById(lombaId);
    if (!lomba) return NextResponse.json({ error: "Lomba tidak ditemukan" }, { status: 404 });
    if (lomba.status !== "aktif") {
      return NextResponse.json(
        { error: `Lomba berstatus '${lomba.status}', gak bisa set finalist` },
        { status: 400 }
      );
    }

    const p = await getPendaftarById(pendaftarId);
    if (!p) return NextResponse.json({ error: "Pendaftar tidak ditemukan" }, { status: 404 });
    if (p.lombaId !== lombaId) {
      return NextResponse.json(
        { error: "Pendaftar bukan dari lomba ini" },
        { status: 400 }
      );
    }
    if (p.status !== "disetujui") {
      return NextResponse.json(
        { error: `Pendaftar berstatus '${p.status}', hanya 'disetujui' yang bisa diset finalist` },
        { status: 400 }
      );
    }
    if (!lomba.kategoriEligible.includes(p.kategoriId)) {
      return NextResponse.json(
        { error: `Kategori '${p.kategoriId}' bukan eligible untuk lomba ini` },
        { status: 400 }
      );
    }

    // Per-kategori Tutup guard: kualifikasi phase is locked for this kategori
    if (lomba.kategoriTutupAt?.[p.kategoriId]) {
      return NextResponse.json(
        { error: "Kategori ini sudah Tutup. Buka dulu kualifikasi untuk edit finalist." },
        { status: 400 }
      );
    }

    // If changing from finalist (lolos) to gugur/pending, clear any Juara rank
    if (p.isFinalist === 1 && data.status !== 1 && p.juaraRank !== null) {
      await clearJuaraRank(pendaftarId);
    }

    await setFinalist(pendaftarId, data.status);

    revalidatePath("/admin/lomba");
    revalidatePath(`/admin/lomba/${lombaId}`);
    revalidatePath(`/admin/lomba/${lombaId}/juara`);
    revalidatePath(`/lomba/${lombaId}`);

    return NextResponse.json({
      ok: true,
      pendaftarId,
      status: data.status,
      kategoriId: p.kategoriId,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid", details: e.issues }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
