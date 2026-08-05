// Stage system v4 — Buka (re-open) Kualifikasi for ONE kategori.
// POST /api/admin/lomba/[id]/kategori/[kid]/buka-kualifikasi
//
// Re-opens the kualifikasi phase for a kategori. Admin can then edit
// is_finalist again. Only allowed if NO Juara 1/2/3 has been picked
// yet (otherwise we'd silently clear them).
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import { getLombaById, bukaKualifikasiKategori } from "@/lib/db";

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
      { error: `Lomba berstatus '${lomba.status}', gak bisa Buka kualifikasi` },
      { status: 400 }
    );
  }
  if (!lomba.kategoriTutupAt?.[kid]) {
    return NextResponse.json(
      { error: "Kategori ini belum Tutup, gak perlu dibuka" },
      { status: 400 }
    );
  }

  const ok = await bukaKualifikasiKategori(lombaId, kid);
  if (!ok) {
    return NextResponse.json(
      { error: "Gagal Buka — Juara 1/2/3 sudah dipilih. Hapus Juara dulu kalau mau edit finalist." },
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
  });
}
