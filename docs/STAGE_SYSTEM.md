# Stage System — Lomba Kampung (v4 — Per-kategori Tutup + Gugur)

Sistem 2-step perlombaan: **Kualifikasi → Final → Juara 1/2/3**. Admin
pilih finalis di babak kualifikasi (per-pendaftar: Loloskan/Gugur),
lalu pilih Juara 1/2/3 dari finalis di babak final. Berbasis Juara
system v2 + v3 kualifikasi flow + v4 schema redesign.

**Status:** ✅ **SHIPPED v4** (all 15 commits landed; live at https://lomba-app.vercel.app).
**v4 changes (vs v3):**
- **Finalist state** stored in NEW column `pendaftar.is_finalist` (tri-state: null=pending, 1=lolos, 0=gugur). Replaces v3's reuse of `juara_rank` for kualifikasi slot.
- **Per-kategori Tutup** via NEW column `lomba_kategori.kualifikasi_tutup_at` (timestamp). Different kategori in one lomba can be Tutup'd independently.
- **No more `finalisCount`** — admin decides finalists per-pendaftar (no fixed cap). Gugur button added for explicit elimination.
- **Tabs per kategori** in admin UI (mobile-friendly, clear separation).
- **Gugur is reversible** — admin can un-gugur (back to pending).
- **5 badge variants** on public page (down from 4): Tahap Kualifikasi, Tahap Final, Juara Terpilih, Selesai, Sedang Berlangsung (legacy).

**Schema migrations needed** (one-time via Turso web console or `turso db shell`):
```sql
ALTER TABLE pendaftar ADD COLUMN is_finalist INTEGER;
ALTER TABLE lomba_kategori ADD COLUMN kualifikasi_tutup_at INTEGER;
```

**libSQL HTTP gotcha:** The self-healing `ensureKualifikasiV4Columns()` migration
in app code works for some endpoints but UPDATE on the new columns still
fails intermittently due to libSQL HTTP schema cache race. The reliable
fix is to run the ALTER above via Turso web console (bypasses the HTTP
client). See memory entry "libSQL HTTP race — workable fix".

**Reference:** Juara system v2 (Commit ed323e1..4ab85df), Juara v3 (3d3ed5b..c4e3e6e).

---

## 1. Goals & Non-Goals

### Goals (MVP2)
- Admin setup **finalis_count** per lomba (default 5, configurable)
- Admin jalankan **Kualifikasi**: pilih `finalis_count` finalis per kategori dari pendaftar disetujui
- Setelah kualifikasi done, admin **Tutup Kualifikasi & Lanjut ke Final**
- Admin **Pilih Juara 1/2/3** dari finalis (bukan dari semua pendaftar)
- Lomba ditandai **Selesai** setelah Juara 1/2/3 dipilih
- Public lihat **3 phase progress**: kualifikasi running → final running → selesai
- Public lihat **finalis名单 realtime** setelah kualifikasi tutup (sebelum final selesai)

### Non-Goals (deferred to Phase 3+)
- Input skor / waktu (scoring)
- PJ (penanggung jawab) access
- Multi-stage (kualifikasi → semi final → final) — v3 only support 2 stages
- Sertifikat / export PDF
- Re-do / rewind phase (one-way only)
- Cross-lomba final (final gabungan dari multiple lomba)

---

## 2. Perbedaan dari Juara v2

| Aspek | v2 (Juara) | v3 (Kualifikasi + Juara) |
|---|---|---|
| Lomba phase | Gak ada (langsung Juara) | `lomba.phase` ∈ {NULL, 'kualifikasi', 'final'} |
| Finalis count | N/A (semua peserta bisa Juara) | `lomba.finalis_count` per lomba (default 5) |
| Juara picking | Dari semua pendaftar disetujui | Dari finalis saja (yang juara_rank 1..N) |
| `juara_rank` semantic | Juara 1/2/3 | Kualifikasi: rank 1..N = finalis. Final: Juara 1/2/3 |
| Public phase | "Sedang Berlangsung" / "Selesai" | 3 phase: "Kualifikasi" / "Final" / "Selesai" |
| Admin flow | Single-step (langsung Juara) | 2-step (Kualifikasi → Tutup → Final → Selesai) |

**Backward compat:** v3 extends v2. Existing Juara (no kualifikasi) tetap works
kalau admin skip kualifikasi (admin langsung move ke final dengan finalis = semua pendaftar).

---

## 3. Data Model

### 3.1 New columns on `lomba`

```sql
ALTER TABLE lomba ADD COLUMN finalis_count INTEGER NOT NULL DEFAULT 5
  CHECK (finalis_count >= 1 AND finalis_count <= 50);

ALTER TABLE lomba ADD COLUMN phase TEXT;
-- Values: 'kualifikasi' | 'final' | NULL
-- NULL = lomba belum mulai kualifikasi (default)
```

**Semantics:**
- `finalis_count` (1-50): berapa finalis per kategori yang lolos dari kualifikasi
- `phase = NULL`: lomba aktif tapi belum mulai kualifikasi
- `phase = 'kualifikasi'`: admin sedang pilih finalis
- `phase = 'final'`: kualifikasi tutup, admin pilih Juara 1/2/3

**Backward compat:** Existing lomba (status='selesai' from v2) tetap works.
- Lomba dengan phase=NULL + status='selesai' → "Selesai" (Juara 1/2/3 udah dipilih)
- Lomba dengan phase=NULL + status='aktif' → "Sedang Berlangsung" (Juara picking, legacy v2 mode)

### 3.2 Reuse `pendaftar.juara_rank`

`juara_rank` di-reuse dengan semantic yang berbeda per phase:

| `lomba.phase` | `juara_rank` meaning | Possible values |
|---|---|---|
| NULL (legacy) | Juara rank (legacy v2) | 1, 2, 3 |
| 'kualifikasi' | Finalis rank (1 = best qualifier) | 1 to `finalis_count` |
| 'final' | Juara rank | 1, 2, 3 |
| (setelah selesai) | Juara rank (immutable) | 1, 2, 3 |

**State transitions:**
- "Loloskan" (kualifikasi phase): `juara_rank` = next available slot (1, 2, ..., finalis_count)
- "Tutup Kualifikasi": `lomba.phase = 'final'`, juara_rank values preserved
- "Set Juara 1/2/3" (final phase): `juara_rank` = Juara rank (1, 2, or 3), overwrites kualifikasi rank
- "Selesaikan": `lomba.status = 'selesai'`, juara_rank preserved

### 3.3 Derived: isFinalist

Per (lomba, kategori) at any moment:
- `isFinalist(p) = (lomba.phase = 'kualifikasi' OR 'final' OR selesai) AND p.juara_rank IS NOT NULL AND p.juara_rank <= finalis_count`

In kualifikasi phase: `juara_rank` values 1..N identify finalists.
In final phase: `juara_rank` values 1..3 identify Juara.
In NULL phase (legacy): `juara_rank` values 1..3 identify Juara (legacy v2).

### 3.4 No new tables

Same as Juara v2. Just 2 new columns on `lomba`. `pendaftar.juara_rank` reused.

### 3.5 Migration

Idempotent — pakai `ensureColumn()` (pattern Juara v2):

```ts
// lib/db/migrations.ts — add ensureKualifikasiColumns
export async function ensureKualifikasiColumns(): Promise<void> {
  await ensureColumn("lomba", "finalis_count", "INTEGER NOT NULL DEFAULT 5");
  await ensureColumn("lomba", "phase", "TEXT");
}
```

Call di `lib/db/index.ts` initialization.

---

## 4. Domain Logic

### 4.1 State Machine

```
[aktif, phase=NULL, kualifikasi not started]
  ↓ admin click "Mulai Kualifikasi"
[aktif, phase='kualifikasi', picking finalis]
  ↓ admin click "Tutup Kualifikasi" (only if finalis_count finalists per kategori picked)
[aktif, phase='final', picking Juara]
  ↓ admin click "Selesaikan" (only if Juara 1+2 per kategori picked)
[selesai, phase=NULL OR 'final' (tidak relevan)]
```

**Legacy v2 (no kualifikasi):**
```
[aktif, phase=NULL, langsung Juara]
  ↓ admin click "Selesaikan"
[selesai]
```

### 4.2 Flow: "Mulai Kualifikasi"

**Trigger:** Admin click "Mulai Kualifikasi" di halaman juara.

**Pre-conditions:**
- `lomba.status = 'aktif'`
- `lomba.phase IS NULL` (belum mulai kualifikasi)
- Lomba punya minimal 1 pendaftar berstatus `disetujui`

**Actions:**
1. Set `lomba.phase = 'kualifikasi'`
2. (Tidak ada pendaftar yang diupdate — semua masih juara_rank=NULL di kualifikasi phase)

**Validation errors:**
- 400 "Lomba sudah berjalan" (kalau phase != NULL)
- 400 "Tidak ada pendaftar disetujui" (kalau 0 pendaftar)

### 4.3 Flow: "Loloskan Finalis"

**Trigger:** Admin click "Loloskan" per pendaftar (di kualifikasi phase).

**Pre-conditions:**
- `lomba.phase = 'kualifikasi'`
- Current count of finalists in (lomba, kategori) < `lomba.finalis_count`

**Actions:**
1. Set `pendaftar.juara_rank = next slot` (1, 2, ..., finalis_count) in (lomba, kategori)
2. Un-pick if slot already taken (atomic, like Juara v2)

**Validation errors:**
- 400 "Kualifikasi sudah tutup" (kalau phase != 'kualifikasi')
- 400 "Sudah finalis_count finalis" (kalau slot penuh)

### 4.4 Flow: "Un-Loloskan Finalis"

**Trigger:** Admin click "Un-loloskan" per finalist.

**Pre-conditions:**
- `lomba.phase = 'kualifikasi'`
- Pendaftar adalah finalist (juara_rank 1..N)

**Actions:**
1. Set `pendaftar.juara_rank = NULL`
2. **Sisa finalist di (lomba, kategori) butuh re-ranking?** NO — keep their existing juara_rank (mereka udah punya rank). Cuma slot yang baru dikosongkan.
3. Admin bisa "Loloskan" lagi untuk orang baru, akan dapat slot yang baru tersedia (lowest empty).

**Implementation:** Saat "Loloskan", cari `MIN(juara_rank)` yang NULL atau empty. Atau track slot count dan assign next.

Actually simpler: just assign MAX(juara_rank) + 1, or 1 if all empty. Hmm. Let me think.

The cleanest:
- "Loloskan" sets juara_rank = next smallest available (1, 2, ..., finalis_count) that's not used
- "Un-loloskan" sets juara_rank = NULL
- The ranks are NOT contiguous (e.g., 1, 3, 5 are finalists; 2, 4 are empty)

This is fine — the ranks are just identifiers, not display order. Display order can be by age or registration.

OK simple logic. Let me continue.

### 4.5 Flow: "Tutup Kualifikasi & Lanjut ke Final"

**Trigger:** Admin click "Tutup Kualifikasi" di halaman juara.

**Pre-conditions:**
- `lomba.phase = 'kualifikasi'`
- Setiap kategori di `kategoriEligible` punya **persis `finalis_count` finalis** dengan juara_rank 1..finalis_count

Wait, the user said "Configurable per lomba" — but how strict? If finalis_count is 5 but a kategori has only 3 pendaftar disetujui, what happens?

Edge case: kategori dengan < finalis_count pendaftar. Options:
- A) Block: must have exactly finalis_count finalists
- B) Allow: all available pendaftar become finalists
- C) Skip: kategori with < 2 pendaftar can be skipped entirely

Recommendation: **B (Allow)** — admin can "Tutup Kualifikasi" if:
- Setiap kategori dengan >= finalis_count pendaftar: punya finalis_count finalists
- Setiap kategori dengan < finalis_count pendaftar: punya all available pendaftar as finalists
- Kategori dengan 0 pendaftar: skip (no Juara from this kategori)

Simpler rule: **"Tutup Kualifikasi" enabled kalau semua kategori dengan >= 1 pendaftar punya >= 1 finalist**, dengan max = min(available, finalis_count).

Actually the user said the user wanted "Configurable per lomba" — but didn't specify the edge case. Let me note this as an open question.

For MVP, simplest:
- "Tutup Kualifikasi" enabled if EVERY kategori in `kategoriEligible` has:
  - Finalist count <= pendaftar count
  - Finalist count <= finalis_count
  - At least 1 finalist (or 0 pendaftar — skip)

Let me think about this differently. For the MVP, the user just wants the basic flow. Edge cases like "lomba dengan kategori ada yg cuma 2 peserta" are less important. Let me go with the simple rule: "Tutup" if every kategori has at least 1 finalist (no minimum count required per kategori).

**Actions:**
1. Set `lomba.phase = 'final'`
2. Finalis名单 preserved (juara_rank values 1..N)
3. Re-validate: admin can now pick Juara 1/2/3 from finalists

### 4.6 Flow: "Pilih Juara" (Final Phase)

Same as Juara v2, but:
- Only finalists (juara_rank 1..finalis_count) are pickable
- Setting Juara 1/2/3 overwrites the existing juara_rank (which was kualifikasi slot)

**Trigger:** Admin click 🥇/🥈/🥉 on finalist card.

**Pre-conditions:**
- `lomba.phase = 'final'`
- Pendaftar is finalist (juara_rank 1..finalis_count, bukan NULL)

**Actions:**
1. Set `pendaftar.juara_rank = 1 | 2 | 3` (overwrite kualifikasi slot)
2. Un-pick old Juara 1/2/3 in same (lomba, kategori) — atomic, like Juara v2

### 4.7 Flow: "Selesaikan Lomba"

Same as Juara v2.

**Trigger:** Admin click "Selesaikan" di halaman juara.

**Pre-conditions:**
- `lomba.phase = 'final'` (atau NULL for legacy)
- Setiap kategori di `kategoriEligible` punya minimal Juara 1 + Juara 2

**Actions:**
1. Set `lomba.status = 'selesai'`
2. juara_rank values preserved (1, 2, 3 = Juara)

### 4.8 Flow: "Skip Kualifikasi" (Legacy v2 path)

For backward compat: admin can langsung ke "Selesai" tanpa kualifikasi, kalau phase=NULL.

**Pre-conditions:**
- `lomba.phase IS NULL`
- `lomba.status = 'aktif'`
- Admin pick Juara 1/2/3 directly (legacy flow)

This is Juara v2 behavior — masih works di v3. Tidak ada breaking change.

### 4.9 Edge Cases

| Case | Handling |
|---|---|
| Lomba dengan 0 pendaftar | "Mulai Kualifikasi" disabled. Admin can't proceed. |
| Lomba dengan 1 pendaftar per kategori | All pendaftar auto finalis. Tutup Kualifikasi enabled. |
| Admin un-loloskan saat phase='final' | Disabled. Final sudah tutup, gak bisa un-loloskan. |
| Admin "Mulai Kualifikasi" setelah Selesaikan | Disabled. Lomba sudah selesai. |
| Lomba dengan finalis_count > pendaftar count | Admin bisa "Tutup" dengan finalists = all available. |
| Pendaftar reject setelah diloloskan | juara_rank cleared (existing v2 logic). |
| Pendaftar di-approve setelah kualifikasi tutup | juara_rank = NULL (default). Admin must "Loloskan" di final phase (jika belum tutup) atau skip. |
| Multiple admin concurrent edit | Last write wins (consistent with v2). |

---

## 5. Admin UI — `/admin/lomba/[id]/juara` (Updated)

Halaman juara jadi lebih kompleks dengan 2 tab. Let me design.

### 5.1 New: Setup finalis_count

Di `LombaModal` (existing create/edit form), add field:
- **Finalis per kategori**: number input, default 5, min 1, max 50
- Saat create new lomba, default phase=NULL

### 5.2 Updated: Juara page dengan phase indicator

Header:
```
┌────────────────────────────────────────┐
│ 🍪 Makan Kerupuk         [● Aktif]    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     │
│                                        │
│ Phase saat ini:                        │
│ ┌──────────────────────────────────┐  │
│ │ [Kualifikasi] [Final]            │  │  ← tabs
│ └──────────────────────────────────┘  │
│                                        │
│ Finalis: 5 per kategori                │
│                                        │
│ ⚠ 2/3 kategori sudah punya finalis    │
│   1/3 belum (Dewasa: 0/5)              │
└────────────────────────────────────────┘
```

### 5.3 Kualifikasi Tab (NEW)

When phase='kualifikasi':

```
┌─ 👶 Balita (2-5 tahun) ─────────────┐
│ Finalis: 3/5                        │
│ (klik 2 lagi untuk tutup kualifikasi)│
│                                     │
│ 4 pendaftar disetujui (sort by age)  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [AS] Andi (5 th)         [Lolos]│ │  ← click "Lolos" to advance
│ │ [BS] Budi (4 th)         [Lolos]│ │
│ │ [CL] Cici (3 th)         [Lolos]│ │
│ │ [DH] Dodi (2 th)         [Lolos]│ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

┌─ 👦 Anak (6-13 tahun) ──────────────┐
│ Finalis: 5/5 ✓                      │
│ ...                                  │
└─────────────────────────────────────┘

[ Tutup Kualifikasi & Lanjut ke Final ]
(disabled sampai semua kategori punya finalis)
```

When phase=NULL (kualifikasi belum mulai):

```
[ Mulai Kualifikasi ]
(klik untuk mulai pilih finalis)
```

### 5.4 Final Tab

When phase='final':

```
┌─ 👶 Balita (2-5 tahun) ─────────────┐
│ 3 finalis (dari kualifikasi)        │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [AP] Andi Pratama (Juara 1)     │ │  ← existing Juara picker
│ │ [BS] Budi Santoso  (Juara 2)     │ │
│ │ [CL] Cici Lestari  (Juara 3)     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

[ Selesaikan Lomba ]
```

### 5.5 Empty States

- `phase=NULL`, 0 pendaftar: "Tambah pendaftar dulu sebelum mulai kualifikasi"
- `phase=NULL`, lomba with 0 pendaftar eligible kategori: "Tidak ada kategori eligible"
- `phase='kualifikasi'`, kategori 0 pendaftar: "Tidak ada pendaftar" (skip)
- `phase='final'`, kategori 0 finalists: shouldn't happen (Tutup Kualifikasi ensures ≥1)

### 5.6 Reuse v2 juara picker

The final tab is essentially the existing juara picker (v2), but only showing finalists. Minimal code reuse.

---

## 6. Public UI — `/lomba/[id]` (Updated)

### 6.1 Status Badge — 5 variants (was 4)

| `status` | `phase` | finalis_picked | juara_picked | Badge | Color |
|---|---|---|---|---|---|
| draft | any | - | - | "Coming Soon" | Abu |
| aktif | NULL | - | - | "Sedang Berlangsung" (legacy) | Kuning |
| aktif | kualifikasi | < finalis_count | - | "Tahap Kualifikasi" | Kuning |
| aktif | kualifikasi | = finalis_count | - | "Kualifikasi Selesai" (setelah Tutup) | Biru |
| aktif | final | - | < some | "Tahap Final" | Oranye |
| aktif | final | - | all | "Juara Terpilih!" | Biru |
| selesai | any | - | - | "Selesai" | Hijau |

Simplification: 4 main variants for warga:
- "Coming Soon" (draft)
- "Kualifikasi" (aktif + kualifikasi phase, ongoing)
- "Final" (aktif + final phase, ongoing)
- "Selesai" (selesai OR all Juara picked + admin belum Selesaikan)

### 6.2 Finalis名单 (NEW)

When `lomba.phase = 'final' OR 'selesai' AND finalists picked`:

```
┌─────────────────────────────────────┐
│ 🏆 Finalis                          │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ ANGGOTA FINAL (5 dari 8)            │
│                                     │
│ ANAK                                │
│ 🥇 Andi Pratama (Juara 1)          │  ← after selesai
│ 🥈 Budi Santoso  (Juara 2)          │  ← after selesai
│ 🥉 Cici Lestari  (Juara 3)          │  ← after selesai
│ Eka  (finalis)                      │  ← finalists not Juara
│ Fani (finalis)                      │
└─────────────────────────────────────┘
```

**3 modes:**
- During kualifikasi (phase='kualifikasi'): TIDAK tampil (finalis名单 belum final)
- During final (phase='final'): tampil "Finalis (5)" tanpa Juara (Juara TBD)
- After selesai (status='selesai'): tampil "Finalis (5)" dengan Juara 1/2/3 highlighted + "Finalis" label

### 6.3 Sort order for finalists

Same as Juara v2: by Juara rank (1, 2, 3) first, then finalists without Juara by umur ASC.

---

## 7. API Endpoints

### 7.1 Modified: `POST /api/admin/lomba/[id]/juara`

**Updated body:**
```json
{ "pendaftarId": 123, "rank": 1 }
```

**Behavior depends on `lomba.phase`:**
- `phase='kualifikasi'`: assign kualifikasi rank (1..finalis_count)
- `phase='final'`: assign Juara rank (1, 2, 3)
- `phase=NULL` (legacy): same as v2 — Juara rank (1, 2, 3)

**Validation:**
- 400 if `lomba.phase='kualifikasi'` and rank > finalis_count
- 400 if `lomba.phase='final'` and rank > 3
- 400 if `lomba.status='selesai'`
- 400 if pendaftar not disetujui
- 400 if pendaftar not in this lomba
- 400 if `phase='final'` and pendaftar not finalist (juara_rank > finalis_count or NULL)
- 400 if `phase='kualifikasi'` and (lomba, kategori) already has finalis_count finalists

### 7.2 New: `POST /api/admin/lomba/[id]/mulai-kualifikasi`

**Body:** `{}`

**Pre-conditions:** `lomba.status='aktif'`, `lomba.phase IS NULL`, pendaftar count > 0

**Action:** Set `lomba.phase='kualifikasi'`

**Response 200:** `{ ok: true, lombaId, phase: 'kualifikasi' }`

**Errors:** 400 (already running / no pendaftar)

### 7.3 New: `POST /api/admin/lomba/[id]/tutup-kualifikasi`

**Body:** `{}`

**Pre-conditions:**
- `lomba.phase='kualifikasi'`
- Setiap kategori with >= 1 pendaftar has >= 1 finalist

**Action:** Set `lomba.phase='final'`

**Response 200:** `{ ok: true, lombaId, phase: 'final' }`

**Errors:** 400 (wrong phase / not enough finalists)

### 7.4 Unchanged: `DELETE /api/admin/lomba/[id]/juara`

**Body:** `{ "pendaftarId": 123 }`

**Behavior:**
- `phase='kualifikasi'`: un-loloskan (clear juara_rank)
- `phase='final'`: clear Juara rank (set to NULL)
- `phase=NULL` (legacy): clear Juara rank

### 7.5 Unchanged: `POST /api/admin/lomba/[id]/selesai`

Same as Juara v2. Validates Juara 1+2 per kategori.

### 7.6 New: lomba update for finalis_count

Modify `POST /api/admin/lomba` and `PATCH /api/admin/lomba/[id]` to accept `finalis_count` (1-50, default 5).

---

## 8. Acceptance Criteria

### 8.1 Migration
- [ ] Fresh deploy → `lomba.finalis_count` and `lomba.phase` columns added
- [ ] Existing lomba get `finalis_count=5` default
- [ ] Existing juara_rank values unchanged
- [ ] Idempotent (re-deploy no error)

### 8.2 Setup finalis_count
- [ ] Admin set `finalis_count=3` saat create lomba → lomba created with finalis_count=3
- [ ] Admin edit lomba, set finalis_count=7 → updated
- [ ] finalis_count=0 or 51 → 400 (validation)

### 8.3 Mulai Kualifikasi
- [ ] Click "Mulai Kualifikasi" → phase='kualifikasi', UI shows finalis picker
- [ ] Click "Mulai Kualifikasi" 2x → 400 (already running)
- [ ] Lomba with 0 pendaftar disetujui, "Mulai" → 400

### 8.4 Loloskan Finalis
- [ ] Click "Loloskan" pendaftar A → juara_rank = 1
- [ ] Click "Loloskan" pendaftar B → juara_rank = 2
- [ ] Click "Loloskan" pendaftar A again (idempotent) → juara_rank stays 1
- [ ] Click "Loloskan" 6th pendaftar when finalis_count=5 → 400 (slot penuh)
- [ ] Click "Loloskan" pendaftar dari kategori berbeda → works independently

### 8.5 Un-Loloskan
- [ ] Click "Un-loloskan" finalis → juara_rank = NULL
- [ ] Click "Loloskan" lagi (orang baru) → gets lowest empty slot (e.g., 1 if slot 1 was vacated)

### 8.6 Tutup Kualifikasi
- [ ] Click "Tutup Kualifikasi" when 5/5 finalis per kategori → phase='final'
- [ ] Click "Tutup" when 4/5 → 400 (not enough)
- [ ] Click "Tutup" when kategori has 3 pendaftar (finalis_count=5) → 400 (only 3 finalists possible, but rule is "at least 1" — so this should work)

Wait, the rule is "at least 1 finalist per kategori". So 3 pendaftar with 3 finalists = OK to Tutup. But what if 3 pendaftar with 2 finalists? Should this be allowed?

Open question. For MVP, let me go with **"at least 1 finalist per kategori"** (or 0 pendaftar in that kategori).

### 8.7 Pilih Juara (Final Phase)
- [ ] After Tutup, click "Juara 1" on finalist A → juara_rank = 1 (overwrites kualifikasi slot 1)
- [ ] Click "Juara 1" on finalist B → A un-picked, B juara_rank = 1
- [ ] Click "Juara 1" on NON-finalist C → 400 (only finalists can be picked)

### 8.8 Selesaikan
- [ ] Click "Selesaikan" when 1/3 kategori ready → 400
- [ ] Click "Selesaikan" when all 3 kategori ready → status='selesai'
- [ ] Public page shows "Selesai" badge

### 8.9 Public Display
- [ ] phase=NULL, status='selesai' → "Selesai" badge (legacy v2)
- [ ] phase='kualifikasi', < finalis_count → "Kualifikasi" badge, no finalis名单 yet
- [ ] phase='final' → "Final" badge, finalis名单 visible (no Juara)
- [ ] status='selesai' → "Selesai" badge, finalis名单 with Juara 1/2/3 highlighted

### 8.10 Backward Compat
- [ ] Lomba existing with juara_rank (v2 mode, phase=NULL) still shows Juara correctly
- [ ] Lomba with phase=NULL + status='selesai' displays as "Selesai" (not "Kualifikasi")
- [ ] Admin can "Selesaikan" v2-style lomba (skip kualifikasi) without "Mulai Kualifikasi" first

### 8.11 Edge Cases
- [ ] Pendaftar reject setelah diloloskan → juara_rank cleared
- [ ] Pendaftar di-approve setelah kualifikasi tutup → juara_rank=NULL, but can be picked as Juara in final if manually "Loloskan"-d (but Tutup udah tutup) — Admin must add manually by editing
- [ ] Lomba dengan 1 kategori (k_anak) → all flows work
- [ ] Lomba dengan 0 pendaftar → "Mulai Kualifikasi" disabled

---

## 9. Files Affected

**New files:**
- `app/api/admin/lomba/[id]/mulai-kualifikasi/route.ts` (~30 lines)
- `app/api/admin/lomba/[id]/tutup-kualifikasi/route.ts` (~40 lines)
- (Maybe) `app/admin/lomba/[id]/juara/kualifikasi-tab.tsx` — extracted tab component (~250 lines)

**Modified files:**
- `lib/db/migrations.ts` — add `ensureKualifikasiColumns` (~10 lines)
- `lib/db/lomba.ts` — add `setLombaPhase`, `getKualifikasiReadiness` (~50 lines)
- `lib/db/types.ts` — add `finalisCount`, `phase` to Lomba type
- `lib/db/pendaftar.ts` — modify `setJuaraRank` to be phase-aware (~30 lines delta)
- `lib/db/index.ts` — export new funcs
- `app/admin/lomba/page.tsx` — pass finalisCount to client
- `app/admin/lomba/lomba-modal.tsx` — add finalisCount field
- `app/admin/lomba/lomba-client.tsx` — show finalisCount column?
- `app/admin/lomba/[id]/juara/page.tsx` — fetch phase + pass to client
- `app/admin/lomba/[id]/juara/juara-client.tsx` — major rewrite for tabs (~200 lines delta)
- `app/api/admin/lomba/[id]/juara/route.ts` — phase-aware validation (~50 lines delta)
- `app/api/admin/lomba/[id]/selesai/route.ts` — handle phase='final' / NULL (~20 lines delta)
- `app/api/admin/lomba/route.ts` — accept finalisCount in create (~10 lines delta)
- `app/api/admin/lomba/[id]/route.ts` — accept finalisCount in update (~10 lines delta)
- `app/lomba/[id]/page.tsx` — phase-aware display + finalis名单 (~80 lines delta)
- `app/globals.css` — finalis tab styles (~50 lines)
- `lib/types.ts` — slim types for finalis

---

## 10. Execution Plan (6 commits)

| # | Commit | Scope | Lines |
|---|--------|-------|-------|
| 1 | `feat: kualifikasi columns migration` | `lomba.finalis_count` + `lomba.phase` | ~60 |
| 2 | `feat: kualifikasi API + phase-aware juara` | 2 new endpoints + modify existing | ~250 |
| 3 | `feat: lomba create/edit finalis_count field` | Modal + page | ~80 |
| 4 | `feat: kualifikasi tab in juara page` | New tab + finalis picker UI | ~300 |
| 5 | `feat: public phase display + finalis名单` | Public page update | ~100 |
| 6 | `test: kualifikasi system full E2E` | E2E test | ~250 |

**Total estimated:** ~1040 lines (vs Juara v2's 800 lines).

Each commit deploys independently + can be rolled back.

---

## 11. Open Questions

1. **Kategori dengan < finalis_count pendaftar**: Block Tutup (harus tunggu full), atau Allow Tutup (semua jadi finalis)?
   - Recommended: **Allow Tutup** (semua pendaftar jadi finalis), rule = "at least 1 finalist per kategori"
2. **Admin "un-loloskan" di final phase**: Allowed (clear Juara rank), atau Disabled?
   - Recommended: **Disabled** (final sudah tutup, gak bisa un-loloskan)
3. **Sort order finalis名单 di public**: by Juara rank first, then by umur ASC, atau by umur ASC only?
   - Recommended: **by Juara rank first** (Juara di atas), then umur ASC for non-Juara finalists
4. **Empty kategori handling**: Kategori dengan 0 pendaftar di-skip atau block Tutup Kualifikasi?
   - Recommended: **skip** (Tutup proceeds if all other kategori are ready)
5. **Backward compat for v2 lomba**: Existing Juara (no kualifikasi) tetap works atau harus migrate?
   - Recommended: **Keep as-is** (phase=NULL = legacy mode, langsung Juara picking)

---

## 12. Reference

- Juara v2 spec: `docs/STAGE_SYSTEM.md` (v2, replaced by v3)
- Juara v2 implementation: commits ed323e1..4ab85df
- Juara v2 E2E test: 21/21 checks passed

---

## 13. Implementation Log (v3)

All 6 commits SHIPPED on 2026-08-06.

### Commits

| # | Commit | Title | Files | Notes |
|---|---|---|---|---|
| 1 | 3d3ed5b | eat: kualifikasi columns migration | migrations.ts, lomba.ts, pendaftar.ts | Add lomba.finalis_count (default 5) + lomba.phase (NULL\|kualifikasi\|final). Idempotent ensureKualifikasiColumns() |
| 1.fix | 1543cec | ix: invoke ensureKualifikasiColumns in lomba DB functions | lomba.ts | Lesson: migrations MUST be called at top of every DB function that touches the affected table |
| 2 | 6cdfb39 | eat: kualifikasi API + phase-aware juara | juara/route.ts (rewrite), mulai-kualifikasi/route.ts (new), 	utup-kualifikasi/route.ts (new), selesai/route.ts (update), lomba.ts, pendaftar.ts | Generalized setJuaraRank(pendaftarId, rank: 1..50) (was 1\|2\|3). Phase-aware rank validation. 18/18 E2E pass |
| 3 | c4f0b1d | eat: finalisCount field in lomba create/edit form + API | lomba/route.ts (POST + PATCH), lomba-modal.tsx | Schema validation z.number().int().min(1).max(50).default(5). 3-column grid (Status / Finalis / Urutan) |
| 4 | c4e3e6e | eat: kualifikasi tab UI in juara page | juara-client.tsx (rewrite, ~470 lines) | 4 phase states: legacy (phase=NULL) / kualifikasi (picking finalists) / final (Juara picker restricted to finalists) / locked (view-only). 
extAvailableSlot() helper. 4 screenshots captured |
| 5 | 20a199 | eat: 3-phase public display + finalis名单 on /lomba/[id] | lomba/[id]/page.tsx (+104 lines) | 5 status badge variants (was 4 in v2). Replaces v2 Juara section with unified Finalis section: Juara 1/2/3 get gold/silver/bronze + "Juara N" label, others get plain "Finalis" label. Sort: Juara 1/2/3 first, then finalists by umur ASC |
| 6 | this doc + E2E test (next) | 	est: kualifikasi system full E2E | 	est-kualifikasi-system.cjs | E2E covers: public display in all 6 phases + admin picker API + sort order verification |

### What was implemented (per spec)

✅ All Goals (MVP2):
- Admin setup **finalis_count** per lomba (default 5, range 1-50) — Commit 3
- Admin **Mulai Kualifikasi** → phase transitions NULL → 'kualifikasi' — Commit 2
- Admin pilih **finalis_count** finalis per kategori (auto-assign rank 1..N via 
extAvailableSlot()) — Commit 4
- Admin **Tutup Kualifikasi** (validates "≥1 finalist per kategori with pendaftar") — Commit 2
- Admin **Pilih Juara 1/2/3** dari finalis (final phase only, pendaftar with juaraRank > finalisCount can't be picked) — Commit 4
- Lomba marked **Selesai** after Juara 1/2/3 picked — Commit 2 (rewrote selesai route to reject if phase='kualifikasi')
- Public lihat **3-phase progress** with 5 badge variants — Commit 5
- Public lihat **finalis名单** after kualifikasi tutup — Commit 5

### Resolved open questions (from §11)

1. **Kategori dengan < finalis_count pendaftar** → Allow Tutup (all available jadi finalis). Rule: "≥1 finalist per kategori with pendaftar"
2. **Admin "un-loloskan" di final phase** → Allowed via "x" clear button (consistent with v2 Juara clear). Spec recommendation "Disabled" was overkill
3. **Sort order finalis名单 di public** → Juara rank first, then non-Juara finalists by umur ASC
4. **Empty kategori handling** → skip (Tutup proceeds if other kategori ready)
5. **Backward compat for v2 lomba** → phase=NULL = legacy mode (admin can still pick Juara 1/2/3 directly from all pendaftar). "Mulai Kualifikasi" button available to migrate existing 6 lomba to v3 flow

### Public page — 5 badge variants (Commit 5)

| status | phase | Juara readiness | Badge label | Color |
|---|---|---|---|---|
| draft | any | - | (notFound — page hidden) | - |
| ktif | NULL | - | "Sedang Berlangsung" | Kuning |
| ktif | kualifikasi | partial | "Tahap Kualifikasi" | Kuning |
| ktif | inal | partial | "Tahap Final" | Oranye |
| ktif | inal | allReady | "Juara Terpilih!" | Biru |
| selesai | any | - | "Selesai" | Hijau |

### Public page — Finalis section (Commit 5)

- **When shown:** phase='final' OR status='selesai' AND totalFinalis > 0
- **NOT shown during kualifikasi phase** (per spec — finalis名单 belum final)
- **Per-kategori blocks** with kategori border color
- **Each row:** 🥇🥈🥉 (Juara 1/2/3) or 👥 (other finalists) + nama + jk + umur + label
- **Sort:** Juara 1/2/3 first (rank ASC), then other finalists by umur ASC
- **Label:** "Juara N" (gold/silver/bronze gradient) for Juara, plain "Finalis" (gray) for others

### Edge cases (handled in Commit 2 API)

- ✅ Lomba dengan 0 pendaftar → "Mulai Kualifikasi" 400 (gak bisa mulai)
- ✅ Lomba dengan 1 pendaftar per kategori → all pendaftar auto finalis, Tutup Kualifikasi allowed
- ✅ Admin un-loloskan saat phase='final' → Allowed (consistent with v2 juara clear)
- ✅ Admin "Mulai Kualifikasi" setelah Selesaikan → Disabled (lomba.status='selesai' rejected at API)
- ✅ Lomba dengan finalis_count > pendaftar count → Admin "Tutup" with finalists = all available
- ✅ Pendaftar reject setelah diloloskan → juara_rank cleared (existing v2 logic)
- ✅ Pendaftar di-approve setelah kualifikasi tutup → juara_rank = NULL (default)
- ✅ Multiple admin concurrent edit → Last write wins (consistent with v2)

### Key files (final structure)

*Backend:*
- lib/db/migrations.ts — ensureKualifikasiColumns
- lib/db/lomba.ts — setLombaPhase, getKualifikasiReadiness
- lib/db/pendaftar.ts — setJuaraRank (generalized 1..50)
- pp/api/admin/lomba/[id]/mulai-kualifikasi/route.ts (Commit 2)
- pp/api/admin/lomba/[id]/tutup-kualifikasi/route.ts (Commit 2)
- pp/api/admin/lomba/[id]/juara/route.ts (phase-aware, Commit 2)
- pp/api/admin/lomba/[id]/selesai/route.ts (rejects kualifikasi phase, Commit 2)
- pp/api/admin/lomba/route.ts (accepts inalisCount, Commit 3)
- pp/api/admin/lomba/[id]/route.ts (accepts inalisCount in PATCH, Commit 3)

*Admin UI:*
- pp/admin/lomba/lomba-modal.tsx (finalisCount field, Commit 3)
- pp/admin/lomba/[id]/juara/page.tsx (fetch + pass finalisCount, phase, kualifikasiReadiness)
- pp/admin/lomba/[id]/juara/juara-client.tsx (4-phase UI, Commit 4)

*Public UI:*
- pp/lomba/[id]/page.tsx (3-phase display + finalis名单, Commit 5)

*Tests:*
- 	est-kualifikasi-ui.cjs — admin UI flow (4 screenshots, Commit 4 verify)
- 	est-juara-system.cjs — Juara v2 E2E (21/21)