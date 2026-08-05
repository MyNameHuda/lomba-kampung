// Stage system v4 — Tutup Kualifikasi for ONE kategori (per-kategori).
// POST /api/admin/lomba/[id]/kategori/[kid]/tutup-kualifikasi
//
// Pre-conditions:
//   - Lomba status = 'aktif'
//   - Kategori is eligible for this lomba
//   - ALL pendaftar (status='disetujui') in this kategori have is_finalist
//     set (no NULLs). Admin must decide Loloskan/Gugur for everyone.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import { getLombaById, tutupKualifikasiKategori, getKualifikasiStatusByKategori } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; kid: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: lombaIdStr, kid } = await params;
  const lombaId = Number(lombaIdStr);
  if (isNaN(lombaId)) {
    return NextResponse.json({ error: "Invalid lomba id" }, { status: 400 });
  }

  const lomba = await getLombaById(lombaId);
  if (!lomba) return NextResponse.json({ error: "Lomba tidak ditemukan" }, { status: 404 });
  if (lomba.status !== "aktif") {
    return NextResponse.json(
      { error: `Lomba berstatus '${lomba.status}', gak bisa Tutup kualifikasi` },
      { status: 400 }
    );
  }
  if (!lomba.kategoriEligible.includes(kid)) {
    return NextResponse.json(
      { error: `Kategori '${kid}' bukan eligible untuk lomba ini` },
      { status: 400 }
    );
  }
  if (lomba.kategoriTutupAt?.[kid]) {
    return NextResponse.json(
      { error: "Kategori ini sudah Tutup sebelumnya" },
      { status: 400 }
    );
  }

  // Check readiness via getKualifikasiStatusByKategori
  const status = await getKualifikasiStatusByKategori(lombaId, kid);
  if (status.pending > 0) {
    return NextResponse.json(
      {
        error: `Masih ada ${status.pending} pendaftar yang belum di-Loloskan/Gugur`,
        status,
      },
      { status: 400 }
    );
  }

  const ok = await tutupKualifikasiKategori(lombaId, kid);
  if (!ok) {
    return NextResponse.json(
      { error: "Gagal Tutup (cek lagi apakah semua pendaftar sudah diset finalist)" },
      { status: 400 }
    );
  }

  revalidatePath("/admin/lomba");
  revalidatePath(`/admin/lomba/${lombaId}`);
  revalidatePath(`/admin/lomba/${lombaId}/juara`);
  revalidatePath(`/lomba/${lombaId}`);

  return NextResponse.json({
    ok: true,
    lombaId,
    kategoriId: kid,
    status,
  });
}
