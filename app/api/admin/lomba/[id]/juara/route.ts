// Juara picker API for stage system v4.
// POST   = set Juara 1/2/3 for a finalist pendaftar (un-picks existing Juara with same rank)
// DELETE = clear Juara (set juara_rank = NULL)
//
// v4: Juara is set only for finalists (is_finalist=1) in a Tutup'd kategori.
// Rank is 1, 2, or 3 (no more finalisCount reuse — that's gone in v4).
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import {
  getLombaById,
  getPendaftarById,
  setJuaraRank,
  clearJuaraRank,
} from "@/lib/db";

const postSchema = z.object({
  pendaftarId: z.number().int().positive(),
  // v4: rank is Juara rank 1, 2, or 3 only. Finalist count is decided per-pendaftar.
  rank: z.number().int().min(1).max(3),
});

const deleteSchema = z.object({
  pendaftarId: z.number().int().positive(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: lombaIdStr } = await params;
  const lombaId = Number(lombaIdStr);
  if (isNaN(lombaId)) return NextResponse.json({ error: "Invalid lomba id" }, { status: 400 });

  try {
    const body = await req.json();
    const data = postSchema.parse(body);

    // Validate lomba
    const lomba = await getLombaById(lombaId);
    if (!lomba) return NextResponse.json({ error: "Lomba tidak ditemukan" }, { status: 404 });
    if (lomba.status !== "aktif") {
      return NextResponse.json(
        { error: `Lomba berstatus '${lomba.status}', tidak bisa pilih Juara` },
        { status: 400 }
      );
    }

    // Validate pendaftar
    const p = await getPendaftarById(data.pendaftarId);
    if (!p) return NextResponse.json({ error: "Pendaftar tidak ditemukan" }, { status: 404 });
    if (p.lombaId !== lombaId) {
      return NextResponse.json(
        { error: "Pendaftar bukan dari lomba ini" },
        { status: 400 }
      );
    }
    if (p.status !== "disetujui") {
      return NextResponse.json(
        { error: `Pendaftar berstatus '${p.status}', hanya 'disetujui' yang bisa dipilih` },
        { status: 400 }
      );
    }
    if (!lomba.kategoriEligible.includes(p.kategoriId)) {
      return NextResponse.json(
        { error: `Kategori '${p.kategoriId}' bukan eligible untuk lomba ini` },
        { status: 400 }
      );
    }

    // v4: require pendaftar to be a finalist
    if (p.isFinalist !== 1) {
      return NextResponse.json(
        { error: "Pendaftar bukan finalist (is_finalist != 1). Loloskan dulu di kualifikasi." },
        { status: 400 }
      );
    }
    // v4: require kategori to be Tutup'd
    if (!lomba.kategoriTutupAt?.[p.kategoriId]) {
      return NextResponse.json(
        { error: "Kategori ini belum Tutup kualifikasi. Tutup dulu sebelum pilih Juara." },
        { status: 400 }
      );
    }

    // Set Juara (atomically un-picks existing Juara with same rank in same (lomba, kategori))
    const result = await setJuaraRank(data.pendaftarId, data.rank);

    // Invalidate all relevant pages
    revalidatePath("/admin/lomba");
    revalidatePath(`/admin/lomba/${lombaId}`);
    revalidatePath(`/lomba/${lombaId}`);

    return NextResponse.json({
      ok: true,
      pendaftarId: data.pendaftarId,
      rank: data.rank,
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

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: lombaIdStr } = await params;
  const lombaId = Number(lombaIdStr);
  if (isNaN(lombaId)) return NextResponse.json({ error: "Invalid lomba id" }, { status: 400 });

  try {
    const body = await req.json().catch(() => ({}));
    const data = deleteSchema.parse(body);

    // Validate pendaftar
    const p = await getPendaftarById(data.pendaftarId);
    if (!p) return NextResponse.json({ error: "Pendaftar tidak ditemukan" }, { status: 404 });
    if (p.lombaId !== lombaId) {
      return NextResponse.json(
        { error: "Pendaftar bukan dari lomba ini" },
        { status: 400 }
      );
    }

    await clearJuaraRank(data.pendaftarId);

    revalidatePath("/admin/lomba");
    revalidatePath(`/admin/lomba/${lombaId}`);
    revalidatePath(`/lomba/${lombaId}`);

    return NextResponse.json({ ok: true, pendaftarId: data.pendaftarId });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid", details: e.issues }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

