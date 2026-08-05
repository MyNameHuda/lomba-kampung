# Stage System — Lomba Kampung (v2)

Sistem pemilihan Juara 1/2/3 per kategori di setiap lomba. Berbasis
`kategoriEligible` yang sudah ada di lomba, jadi **gak ada table baru** —
cukup 1 kolom tambahan di `pendaftar`.

**Status:** Spec draft, menunggu review.
**Scope:** MVP (Phase 1). Phase 2 (scoring, PJ access, sertifikat, dll) di luar dokumen ini.

---

## 1. Goals & Non-Goals

### Goals (MVP)
- Admin bisa pilih **Juara 1, 2, 3 dari setiap kategori** dalam satu lomba
- "Stages" (= kategori) **auto-generated** dari `lomba.kategoriEligible`
- Pendaftar di setiap stage **disortir by umur ascending**
- 1 pendaftar hanya bisa pegang 1 Juara rank per (lomba, kategori)
- Lomba ditandai "Selesai" setelah semua Juara 1/2/3 dipilih
- Public bisa lihat Juara 1/2/3 per kategori saat lomba selesai

### Non-Goals (deferred to Phase 2)
- Input skor / waktu
- PJ (penanggung jawab) access
- Sertifikat / export PDF
- Real-time public live results
- Re-do / rewind phase (one-way only)
- Per-lomba config: jumlah Juara, qualifier → final flow

---

## 2. Data Model (TRIMMED!)

### 2.1 New column: `pendaftar.juara_rank`

```sql
ALTER TABLE pendaftar ADD COLUMN juara_rank INTEGER
  CHECK (juara_rank IS NULL OR juara_rank BETWEEN 1 AND 3);
```

**Semantics:**
- `NULL` = bukan Juara (default)
- `1` = Juara 1 (juara utama)
- `2` = Juara 2 (runner-up)
- `3` = Juara 3 (juara ketiga)

**Scope:** Juara rank spesifik per (lomba_id, kategori_id). Pendaftar yang sama
bisa jadi Juara di lomba berbeda tanpa konflik, karena `(pendaftar.id, lomba.id, kategori.id)` combination uniquely identifies a row in lomba context.

Wait, satu pendaftar cuma ada di satu lomba (existing). Jadi cukup `(lomba_id, kategori_id, juara_rank)` untuk uniqueness.

**Uniqueness** (enforced di app code, bukan DB constraint):
- 1 pendaftar hanya 1 Juara rank per (lomba, kategori) — enforced by UPDATE pattern
- Per (lomba, kategori), maksimal 1 Juara 1, 1 Juara 2, 1 Juara 3 — enforced at write time

### 2.2 No new tables. No new columns on `lomba`.

Existing `lomba.status` (`draft` / `aktif` / `selesai`) sudah cukup:
- `aktif` = lomba lagi bisa di-pendaftari + juara sedang dipilih
- `selesai` = semua Juara dipilih + admin klik "Selesaikan"

Heuristic for "siap diselesaikan": setiap kategori di `kategoriEligible` punya minimal 1 Juara 1, 1 Juara 2 (Juara 3 optional jika < 3 pendaftar).

### 2.3 Migration

Idempotent — pakai `client.batch([...], "write")` pattern (lesson dari commit b9c012a):

```ts
// lib/db/migrations.ts — add ensureJuaraColumn
export async function ensureJuaraColumn() {
  const cols = await all<{ name: string }>("PRAGMA table_info(pendaftar)");
  if (!cols.some(c => c.name === 'juara_rank')) {
    await getClient().batch([
      "ALTER TABLE pendaftar ADD COLUMN juara_rank INTEGER",
    ], "write");
  }
}
```

Call di `lib/db/index.ts` initialization, sama dengan `ensurePjMultiSupport` dll.

---

## 3. Domain Logic

### 3.1 State machine

```
[draft] --publish--> [aktif, picking] --all juara picked--> [aktif, ready]
                                                                        |
                                                                        v
                                                                   [selesai]
```

- `aktif, picking` = status='aktif', belum semua Juara dipilih
- `aktif, ready` = semua Juara 1/2 (minimal) dipilih, tombol "Selesaikan" enabled
- `selesai` = status='selesai', Juara displayable publicly

Derive `picking` vs `ready` at read time:
```ts
const allJuaraPicked = await checkAllJuaraPicked(lombaId);
// if allJuaraPicked → 'ready', else → 'picking'
```

### 3.2 Flow: "Pilih Juara"

**Trigger:** Admin click "Juara 1" / "Juara 2" / "Juara 3" button di pendaftar card.

**Pre-conditions:**
- Lomba `status = 'aktif'`
- Pendaftar `status = 'disetujui'`

**Actions:**
1. Cek current Juara for that rank di (lomba, kategori)
2. Jika ada pendaftar lain dengan rank yang sama → un-pick dia (set `juara_rank = NULL`)
3. Set `pendaftar.juara_rank` = rank yang dipilih
4. Re-validate "all Juara picked" untuk enable/disable "Selesaikan" button
5. `revalidatePath('/admin/lomba/[id]/juara')` + public path

**Edge cases:**
- Admin click "Juara 1" on pendaftar yang sudah Juara 1 → no-op (idempotent)
- Admin click "Juara 2" on pendaftar yang Juara 1 → re-pick as Juara 2 (old Juara 1 un-picked)
- Pindahin Juara 1 dari A ke B: A un-pick, B jadi Juara 1

### 3.3 Flow: "Selesaikan Lomba"

**Trigger:** Admin click "Selesaikan Lomba" button.

**Pre-conditions:**
- Lomba `status = 'aktif'`
- Semua kategori di `kategoriEligible` punya minimal Juara 1 + Juara 2
  - Juara 3 optional (skip kalo kategori punya < 3 pendaftar)

**Actions:**
1. Set `lomba.status = 'selesai'`
2. Public badge → "Selesai" + Juara display
3. Re-validate all relevant paths

**Edge cases:**
- Belum semua Juara 1/2 dipilih → 400 "Pilih Juara 1 dan 2 untuk semua kategori dulu"
- Lomba already selesai → 400 "Lomba sudah selesai"

### 3.4 Edge Cases

| Case | Handling |
|---|---|
| Lomba dengan 0 kategoriEligible | Tidak bisa pick Juara (gak ada stage). Lomba stuck. |
| Lomba dengan 1 kategori | Tampil 1 section (kategori itu), admin pilih Juara 1/2/3 dari pendaftar di kategori itu |
| Lomba dengan 5 kategori | Tampil 5 sections, total 15 Juara (3 per kategori) |
| Kategori dengan 0 pendaftar | Juara 1/2/3 = null untuk kategori itu, lomba masih bisa "Selesaikan" (heuristic relax) |
| Kategori dengan 1 pendaftar | Juara 1 boleh dipilih, Juara 2/3 = null |
| Kategori dengan 2 pendaftar | Juara 1 + Juara 2, Juara 3 = null |
| Pendaftar reject setelah dipilih Juara | Juara cleared (juara_rank → NULL) |
| Pendaftar baru di-approve setelah Juara dipilih | Otomatis join dengan juara_rank=NULL (default) |
| Hapus lomba yang sudah selesai | Tetap boleh (existing behavior) |

---

## 4. Admin UI

### 4.1 `/admin/lomba` list — tambah juara summary

Setiap card lomba tambah info kecil:
- `Juara 1/3 dipilih` atau `Belum ada juara`
- Kalau lomba selesai: `Juara 1/2/3 lengkap` (hijau)

### 4.2 `/admin/lomba/[id]/edit` — tab "Juara"

Tambah tab baru "Juara" di halaman edit lomba. Isinya:
- List sections per kategori dari `kategoriEligible`
- Tiap section: pendaftar disetujui sorted by umur ascending
- Tiap pendaftar: tombol "Juara 1" / "Juara 2" / "Juara 3"
- Currently picked Juara highlighted
- Bottom: tombol "Selesaikan Lomba" (enabled kalau semua Juara 1+2 dipilih)

### 4.3 `/admin/lomba/[id]/juara` (NEW, optional standalone)

Bisa juga halaman dedicated `/admin/lomba/[id]/juara` untuk quick access. Tapi untuk MVP, tab di edit page cukup.

### 4.4 Wireframe — tab Juara

```
┌─────────────────────────────────────────┐
│  🍪 Makan Kerupuk        [● Aktif]      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━       │
│  Pilih Juara untuk setiap kategori      │
│                                         │
│  ⚠️ 2/3 kategori sudah lengkap Juara 1&2│
│     1/3 belum (Dewasa — perlu 1 Juara 1)│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  👶 Balita (2-5 tahun)                  │
│  Status: ✓ Juara 1&2 dipilih             │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ [AS] Andi Setiawan (5 th)         │  │
│  │       [✓ Juara 1]  [Juara 2] [3]  │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ [BS] Budi Santoso (4 th)          │  │
│  │       [Juara 1]  [✓ Juara 2] [3]  │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ [CL] Cici Lestari (3 th)          │  │
│  │       [Juara 1] [2] [✓ Juara 3]   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  👦 Anak (6-13 tahun)                   │
│  Status: ✓ Juara 1&2 dipilih             │
│  ... (same as above)                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  🧑 Dewasa (18+ tahun)                  │
│  Status: ⚠ Belum ada Juara 1            │
│                                         │
│  [List pendaftar dengan button Juara 1/2/3] │
└─────────────────────────────────────────┘

[button: Selesaikan Lomba]  (disabled: 1 kategori belum Juara 1)
```

### 4.5 `loading.tsx`

Skeleton yang sama dengan page lomba lain, reuse `admin-loading-chrome`.

---

## 5. Public UI

### 5.1 `/lomba/[id]` — juara display + badge

Update existing page:

**Badge (existing location, near header):**
- `status = 'draft'` → "Coming Soon" (abu)
- `status = 'aktif'` + juara belum lengkap → "Sedang Berlangsung" (kuning)
- `status = 'aktif'` + juara lengkap (siap selesai) → "Juara Terpilih!" (biru)
- `status = 'selesai'` → "Selesai" (hijau)

**Per-kategori section (existing):**
Tambah Juara 1/2/3 badges di atas list peserta existing, hanya tampil kalau `status = 'selesai'`:

```
┌─────────────────────────────────────┐
│  👶 Balita (2-5 tahun)              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  🥇 Andi Setiawan  (Juara 1)         │  ← NEW
│  🥈 Budi Santoso   (Juara 2)         │  ← NEW
│  🥉 Cici Lestari   (Juara 3)         │  ← NEW
│  ──────────────────────────────      │
│  Peserta lainnya:                    │
│  • Dodi (2 th)                       │  ← existing
│  • Eka (3 th)                        │
└─────────────────────────────────────┘
```

Tampil Juara 1/2/3 hanya kalau:
- `status = 'selesai'`, ATAU
- `status = 'aktif' + juara lengkap` (siap selesai) — biar warga tau hasilnya tinggal di-umumkan

Order: Juara 1, 2, 3 (if exists), then other participants sorted by existing rule.

---

## 6. API Endpoints

Semua di bawah `/api/admin/lomba/[id]/...`. Auth: `isAuthenticated()`.

### 6.1 `POST /api/admin/lomba/[id]/juara`

Pilih Juara untuk 1 pendaftar (replace existing if any).

**Request:**
```json
{ "pendaftarId": 123, "rank": 1 }
```
`rank` 1, 2, atau 3. Untuk un-pick, kirim `rank: null`.

**Response 200:**
```json
{ "ok": true, "pendaftarId": 123, "rank": 1 }
```

**Errors:**
- 400 (validation: rank not 1-3, missing fields)
- 404 (pendaftar not found)
- 400 (pendaftar not in this lomba, or status != 'disetujui')
- 400 (lomba not 'aktif')

**Side effects:**
- If old Juara 1 exists → un-pick them
- Re-validate "all juara picked" (for Selesai button enabled state)

### 6.2 `DELETE /api/admin/lomba/[id]/juara`

Un-pick a Juara (clear `juara_rank`).

**Request:**
```json
{ "pendaftarId": 123 }
```

**Response 200:**
```json
{ "ok": true, "pendaftarId": 123 }
```

### 6.3 `POST /api/admin/lomba/[id]/selesai`

Mark lomba as selesai.

**Request:** `{}`

**Response 200:**
```json
{ "ok": true, "jumlahJuara": 6 }
```

**Errors:**
- 400 (not all Juara 1+2 picked across kategori)
- 400 (lomba already selesai)

---

## 7. Acceptance Criteria

### 7.1 Migration
- [ ] Fresh deploy → `pendaftar.juara_rank` column added, existing rows NULL
- [ ] Re-deploy → migration idempotent (no errors)
- [ ] Existing data preserved

### 7.2 Pilih Juara
- [ ] Admin click "Juara 1" on Andi → Andi's `juara_rank = 1`
- [ ] Admin click "Juara 1" on Budi (sambil Andi Juara 1) → Andi un-picked, Budi Juara 1
- [ ] Admin click "Juara 2" on Andi (sambil Andi Juara 1) → Andi Juara 2 (Juara 1 cleared, no conflict)
- [ ] Admin un-pick via DELETE → Andi's `juara_rank = NULL`
- [ ] Picker dropdown only shows pendaftar with `status = 'disetujui'`
- [ ] Picker dropdown sorted by umur ASC within each kategori
- [ ] Tidak bisa pick Juara di pendaftar yang bukan di lomba ini (400)
- [ ] Tidak bisa pick Juara kalau lomba status='selesai' (400)

### 7.3 Selesaikan Lomba
- [ ] Lomba dengan 2 kategori, 1 punya Juara 1+2, 1 belum → "Selesaikan" disabled
- [ ] Lomba dengan 2 kategori, keduanya punya Juara 1+2 → "Selesaikan" enabled
- [ ] Click "Selesaikan" → `lomba.status = 'selesai'`
- [ ] Public badge = "Selesai" (hijau)
- [ ] Public tampil Juara 1/2/3 di setiap kategori section
- [ ] Click "Selesaikan" lagi → 400 (already selesai)

### 7.4 Single-kategori & small kategori
- [ ] Lomba 1 kategori (Balita) → 1 section di admin, max 3 Juara
- [ ] Kategori dengan 1 pendaftar → admin pick Juara 1, Juara 2/3 = null
- [ ] Kategori dengan 2 pendaftar → admin pick Juara 1+2, Juara 3 = null
- [ ] "Selesaikan" enabled kalau Juara 1+2 picked (Juara 3 optional)

### 7.5 Edge cases
- [ ] Pendaftar reject setelah jadi Juara → juara_rank cleared
- [ ] Pendaftar baru di-approve setelah Juara dipilih → join dengan juara_rank=NULL
- [ ] Pindahin Juara 1 dari A ke B (A & B di kategori sama) → A un-picked, B Juara 1
- [ ] 2 admin concurrent pick Juara 1 (A and B) → last write wins (A atau B, whoever latest)

### 7.6 Public display
- [ ] `status = 'selesai'` → Juara 1/2/3 tampil per kategori di `/lomba/[id]`
- [ ] `status = 'aktif' + juara lengkap` → Juara tampil tapi badge "Juara Terpilih!" (belum "Selesai")
- [ ] `status = 'aktif' + juara belum lengkap` → gak ada Juara, badge "Sedang Berlangsung"
- [ ] `status = 'draft'` → badge "Coming Soon", gak ada Juara

---

## 8. Execution Plan (commit order)

| # | Commit | Scope | Estimated lines |
|---|--------|-------|-----------------|
| 1 | `feat: add juara_rank column + migration` | Idempotent migration, DB layer helpers | ~50 |
| 2 | `feat: juara picker API` | POST/DELETE `/api/admin/lomba/[id]/juara` + DB functions | ~150 |
| 3 | `feat: lomba selesai API` | POST `/api/admin/lomba/[id]/selesai` + validation | ~80 |
| 4 | `feat: juara tab in lomba edit` | UI tab + per-kategori picker | ~250 |
| 5 | `feat: juara display on public lomba page` | Update `/lomba/[id]` + badge | ~80 |
| 6 | `chore: e2e test for juara system` | `test-juara-system.cjs` | ~200 |

**Total estimated:** ~810 lines across 6 commits.

Each commit deploys independently.

---

## 9. Files Affected

**New files:**
- `app/api/admin/lomba/[id]/juara/route.ts` (~60 lines, POST + DELETE handlers)
- `app/api/admin/lomba/[id]/selesai/route.ts` (~30 lines, POST handler)
- `test-juara-system.cjs` (~200 lines, E2E test)

**Modified files:**
- `lib/db/migrations.ts` — add `ensureJuaraColumn` (~15 lines)
- `lib/db/pendaftar.ts` — add `setJuaraRank`, `clearJuaraRank`, `getJuaraByLomba` (~80 lines)
- `lib/db/lomba.ts` — add `getJuaraStatus(lombaId)` helper (~30 lines)
- `lib/db/index.ts` — export new funcs + call migration
- `lib/db/types.ts` — add `juaraRank: number | null` to Pendaftar
- `lib/types.ts` — add `JuaraSlim` type for client
- `app/admin/lomba/[id]/edit/lomba-edit-client.tsx` (or similar) — add Juara tab (~250 lines)
- `app/lomba/[id]/page.tsx` — add Juara display + badge update (~80 lines)
- `app/admin/lomba/lomba-list-client.tsx` — add juara summary chip (~20 lines)
- `app/admin/lomba/lomba-modal.tsx` — pass juara info to list

---

## 10. Open Questions (sudah dijawab user, di sini untuk reference)

1. **Stage source**: `kategoriEligible` (auto, fixed per lomba) ✓
2. **Finalists per stage**: 3 Juara per kategori (fixed, bukan configurable) ✓
3. **Single-kategori flow**: sama kayak multi-kategori (pick Juara 1/2/3 per kategori langsung) ✓
4. **Re-do/undo**: one-way only, gak bisa rewind ✓

**Sisa assumptions** (kasih tau kalo salah):
- Juara 3 optional kalau kategori punya < 3 pendaftar
- Sort by umur ASCENDING di setiap kategori
- Total juara per lomba = 3 × jumlah_kategori (maks 9 jika 3 kategori)
- Public bisa lihat Juara sebelum "Selesaikan" (badge "Juara Terpilih!" beda dari "Selesai")
