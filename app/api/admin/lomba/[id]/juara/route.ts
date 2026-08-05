// Juara picker API for stage system v3 (kualifikasi + Juara).
// POST   = set Juara 1/2/3 for a pendaftar (un-picks existing Juara with same rank)
// DELETE = clear Juara (set juara_rank = NULL)
//
// Phase-aware:
//   - phase='kualifikasi': rank is 1..finalisCount (finalist slot)
//   - phase='final' or NULL (legacy): rank is 1, 2, or 3 (Juara rank)
//
// Juara is scoped per (lomba, kategori). At most 1 Juara per rank per kategori.
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
  // Accept 1..50 (finalisCount max). API layer validates exact range
  // based on lomba.phase + finalisCount.
  rank: z.number().int().min(1).max(50),
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

    // Phase-aware rank validation
    if (lomba.phase === "kualifikasi") {
      if (data.rank > lomba.finalisCount) {
        return NextResponse.json(
          { error: `Rank ${data.rank} melebihi finalis_count (${lomba.finalisCount})` },
          { status: 400 }
        );
      }
    } else {
      // phase='final' or NULL (legacy v2 mode)
      if (data.rank > 3) {
        return NextResponse.json(
          { error: "Juara rank harus 1, 2, atau 3" },
          { status: 400 }
        );
      }
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

    // Phase-specific: in kualifikasi, pendaftar can be picked as finalist
    // if not already a finalist. In final, only finalists can be picked.
    if (lomba.phase === "final" && (p.juaraRank === null || p.juaraRank > lomba.finalisCount)) {
      return NextResponse.json(
        { error: "Pendaftar bukan finalis (juara_rank tidak valid di final phase)" },
        { status: 400 }
      );
    }
    // In kualifikasi: pendaftar shouldn't already be a finalist with a different rank
    // (idempotent re-pick with same rank is allowed)
    if (lomba.phase === "kualifikasi" && p.juaraRank !== null && p.juaraRank <= lomba.finalisCount && p.juaraRank !== data.rank) {
      return NextResponse.json(
        { error: `Pendaftar sudah menjadi finalis (rank ${p.juaraRank}). Un-loloskan dulu.` },
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
      phase: lomba.phase,
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
