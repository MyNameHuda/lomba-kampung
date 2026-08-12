import { defineEventHandler, readBody, createError } from "h3";
// POST /api/admin/kategori — upsert kategori
import { z } from "zod";
import { requireAuth } from "~~/server/utils/auth";
import { get } from "~~/server/utils/db/client";
import { upsertKategori } from "~~/server/utils/db/kategori";

// Slugify a kategori nama into a valid DB id.
// Convention: `k_<lowercase_underscored>`, e.g. "Bapak-Bapak" -> "k_bapak_bapak".
// Collisions are resolved by appending `_2`, `_3`, ... (DB-unique).
function slugifyKategoriId(nama: string): string {
  const base = "k_" + nama
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return base || "k_kategori";
}

async function ensureUniqueKategoriId(base: string, excludeId?: string): Promise<string> {
  // Try base, base_2, base_3, ... up to 999. Returns first unused id.
  for (let i = 0; i < 1000; i++) {
    const candidate = i === 0 ? base : `${base}_${i + 1}`;
    if (candidate === excludeId) return candidate; // editing same row — keep id
    const existing = await get<{ id: string }>("SELECT id FROM kategori WHERE id = ?", candidate);
    if (!existing) return candidate;
  }
  throw createError({ statusCode: 500, statusMessage: "Gagal generate ID unik untuk kategori" });
}

const schema = z.object({
  // id is optional for new kategori — server auto-generates from `nama`.
  // For edit, the existing id is sent back unchanged.
  id: z.string().min(1).max(50).optional(),
  nama: z.string().min(1).max(100),
  icon: z.string().min(1).max(50),
  min: z.number().int().min(0).max(999),
  max: z.number().int().min(0).max(999),
  urutan: z.number().int().min(0),
  autoAge: z.boolean(),
  // "button" = age grid (good for narrow ranges like Balita 2-5)
  // "field"  = number input (good for wide ranges like Dewasa 18+)
  inputMode: z.enum(["button", "field"]).default("button"),
  colorBg: z.string().min(1).max(20),
  colorText: z.string().min(1).max(20),
  colorBorder: z.string().min(1).max(20),
});

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || "Input tidak valid" });
  }
  if (parsed.data.min > parsed.data.max) {
    throw createError({ statusCode: 400, statusMessage: "Umur min tidak boleh lebih besar dari max" });
  }
  // Resolve final id: edit keeps existing, new auto-generates from nama.
  const finalId = parsed.data.id
    ? parsed.data.id
    : await ensureUniqueKategoriId(slugifyKategoriId(parsed.data.nama));
  await upsertKategori({ ...parsed.data, id: finalId });
  return { ok: true, id: finalId };
});
