// Mulai Kualifikasi API for stage system v3.
// POST = set lomba.phase = 'kualifikasi' (transition from NULL → 'kualifikasi')
//
// Pre-conditions:
//  - Lomba status must be 'aktif'
//  - Lomba.phase must be NULL (not yet started)
//  - Lomba must have at least 1 pendaftar berstatus 'disetujui'
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import {
  getLombaById,
  getPendaftarByLomba,
  setLombaPhase,
} from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: lombaIdStr } = await params;
  const lombaId = Number(lombaIdStr);
  if (isNaN(lombaId)) return NextResponse.json({ error: "Invalid lomba id" }, { status: 400 });

  const lomba = await getLombaById(lombaId);
  if (!lomba) return NextResponse.json({ error: "Lomba tidak ditemukan" }, { status: 404 });
  if (lomba.status !== "aktif") {
    return NextResponse.json(
      { error: `Lomba berstatus '${lomba.status}', tidak bisa mulai kualifikasi` },
      { status: 400 }
    );
  }
  if (lomba.phase !== null) {
    return NextResponse.json(
      { error: `Lomba sudah di phase '${lomba.phase}', tidak bisa mulai ulang` },
      { status: 400 }
    );
  }
  if (!lomba.kategoriEligible || lomba.kategoriEligible.length === 0) {
    return NextResponse.json(
      { error: "Lomba belum punya kategori eligible" },
      { status: 400 }
    );
  }

  // Check at least 1 pendaftar disetujui across all eligible kategori
  const allRows = await Promise.all(
    lomba.kategoriEligible.map((katId) => getPendaftarByLomba(lombaId, "disetujui").then(
      (rows) => rows.filter((r) => r.kategoriId === katId).length
    ))
  );
  const totalPendaftar = allRows.reduce((sum, n) => sum + n, 0);
  if (totalPendaftar === 0) {
    return NextResponse.json(
      { error: "Belum ada pendaftar disetujui" },
      { status: 400 }
    );
  }

  // Commit
  await setLombaPhase(lombaId, "kualifikasi");

  revalidatePath("/admin/lomba");
  revalidatePath(`/admin/lomba/${lombaId}`);

  return NextResponse.json({
    ok: true,
    lombaId,
    phase: "kualifikasi",
    totalPendaftar,
  });
}
