import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { bulkCopyPendaftar, getLombaById } from "@/lib/db";

const postSchema = z.object({
  sourceLombaId: z.number().int().positive(),
});

/**
 * POST /api/admin/lomba/[id]/copy-from
 *
 * Body: { sourceLombaId: number }
 * Effect: copies all "disetujui" pendaftar from `sourceLombaId` into
 * the target lomba (id from URL). Each row is sourced as "manual"
 * (admin-initiated) and marked hadir=true, consistent with the
 * input-manual form default.
 *
 * Dedup: pendaftar whose nama already exists in target (case-insensitive,
 * trim) are skipped. Pendaftar whose kategoriId is not eligible in the
 * target lomba are also skipped (keeps target's kategori integrity).
 *
 * Returns: { ok, copied, skippedDuplicate, skippedKategori }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const targetId = Number(id);
  if (isNaN(targetId)) return NextResponse.json({ error: "Invalid target id" }, { status: 400 });

  try {
    const body = await req.json();
    const data = postSchema.parse(body);

    if (data.sourceLombaId === targetId) {
      return NextResponse.json({ error: "Source dan target lomba tidak boleh sama" }, { status: 400 });
    }

    // Validate both lomba exist + fetch target's eligible kategori
    const [target, source] = await Promise.all([
      getLombaById(targetId),
      getLombaById(data.sourceLombaId),
    ]);
    if (!target) return NextResponse.json({ error: "Lomba target tidak ditemukan" }, { status: 404 });
    if (!source) return NextResponse.json({ error: "Lomba sumber tidak ditemukan" }, { status: 404 });

    const targetEligible = Array.isArray(target.kategoriEligible) ? target.kategoriEligible : [];

    const result = await bulkCopyPendaftar(data.sourceLombaId, targetId, targetEligible);

    revalidatePath("/admin");
    revalidatePath("/admin/approval");
    revalidatePath("/admin/peserta");
    revalidatePath("/admin/input-manual");
    revalidatePath(`/admin/peserta/${targetId}`);

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid", details: e.issues }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
