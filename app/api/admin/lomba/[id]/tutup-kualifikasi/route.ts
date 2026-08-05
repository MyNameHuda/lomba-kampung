// Tutup Kualifikasi API for stage system v3.
// POST = set lomba.phase = 'final' (transition from 'kualifikasi' → 'final')
//
// Pre-conditions:
//  - Lomba.phase must be 'kualifikasi'
//  - Every eligible kategori with >= 1 pendaftar has >= 1 finalist
//    (kategori with 0 pendaftar are skipped)
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import { getLombaById, getKualifikasiReadiness, setLombaPhase } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: lombaIdStr } = await params;
  const lombaId = Number(lombaIdStr);
  if (isNaN(lombaId)) return NextResponse.json({ error: "Invalid lomba id" }, { status: 400 });

  const lomba = await getLombaById(lombaId);
  if (!lomba) return NextResponse.json({ error: "Lomba tidak ditemukan" }, { status: 404 });
  if (lomba.phase !== "kualifikasi") {
    return NextResponse.json(
      { error: `Lomba bukan di phase 'kualifikasi' (saat ini: ${lomba.phase ?? "belum mulai"})` },
      { status: 400 }
    );
  }

  // Validate readiness
  const readiness = await getKualifikasiReadiness(lombaId);
  if (!readiness.ok) {
    return NextResponse.json(
      {
        error: "Belum semua kategori punya finalis",
        missingKategori: readiness.missingKategori,
        perKategori: readiness.perKategori,
      },
      { status: 400 }
    );
  }

  // Commit
  await setLombaPhase(lombaId, "final");

  revalidatePath("/admin/lomba");
  revalidatePath(`/admin/lomba/${lombaId}`);
  revalidatePath(`/lomba/${lombaId}`);

  return NextResponse.json({
    ok: true,
    lombaId,
    phase: "final",
    perKategori: readiness.perKategori,
  });
}
