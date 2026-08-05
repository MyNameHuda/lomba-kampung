// Selesaikan Lomba API for stage system v4.
// POST = mark lomba as 'selesai' (Juara 1/2/3 are finalized).
//
// Pre-conditions (v4):
//  - Lomba status must be 'aktif'
//  - EVERY eligible kategori (with at least 1 finalist) must have Juara 1 + Juara 2
//    selected (Juara 3 is optional — kategori with < 3 finalists can skip it)
//  - v4 doesn't use lomba.phase — kualifikasi state is per-kategori.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import {
  getLombaById,
  getJuaraReadiness,
  markLombaSelesai,
} from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: lombaIdStr } = await params;
  const lombaId = Number(lombaIdStr);
  if (isNaN(lombaId)) return NextResponse.json({ error: "Invalid lomba id" }, { status: 400 });

  // Validate lomba exists
  const lomba = await getLombaById(lombaId);
  if (!lomba) return NextResponse.json({ error: "Lomba tidak ditemukan" }, { status: 404 });
  if (lomba.status === "selesai") {
    return NextResponse.json({ error: "Lomba sudah selesai" }, { status: 400 });
  }
  if (lomba.status === "draft") {
    return NextResponse.json(
      { error: "Lomba masih draft, tidak bisa diselesaikan" },
      { status: 400 }
    );
  }

  // Validate Juara readiness (v4: same per-kategori Juara 1+2 check)
  const readiness = await getJuaraReadiness(lombaId);
  if (!readiness.allReady) {
    return NextResponse.json(
      {
        error: "Belum semua kategori punya Juara 1 & 2",
        missingKategori: readiness.missingKategori,
        perKategori: readiness.perKategori,
      },
      { status: 400 }
    );
  }

  // Commit
  await markLombaSelesai(lombaId);

  // Invalidate all relevant pages
  revalidatePath("/admin");
  revalidatePath("/admin/lomba");
  revalidatePath(`/admin/lomba/${lombaId}`);
  revalidatePath("/admin/peserta");
  revalidatePath(`/admin/peserta/${lombaId}`);
  revalidatePath("/lomba");
  revalidatePath(`/lomba/${lombaId}`);

  return NextResponse.json({ ok: true, lombaId });
}

