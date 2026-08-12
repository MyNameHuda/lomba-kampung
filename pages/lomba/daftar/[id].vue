<script setup lang="ts">
// Public 3-step daftar form — Vue 3 port of app/lomba/[id]/daftar/daftar-form.tsx
// Smart input UX: live validation, char counter, auto-focus next field,
// arrow-key nav on age grid, beforeunload guard for unsaved progress.
import { KAT_ICON, DEFAULT_KAT_ICON } from "~/utils/constants";

const route = useRoute();
const id = computed(() => Number(route.params.id));

const { data, error: fetchError, pending } = useFetch<{
  lomba: { id: number; nama: string; emoji: string };
  kategori: Array<{ id: string; nama: string; icon: string; min: number; max: number; autoAge: boolean; inputMode: "button" | "field" }>;
}>(() => `/api/public/lomba/${id.value}/daftar-info`, {
  credentials: "include",
  // lazy: true → useFetch fetched di background, page render IMMEDIATELY.
  // Sebelumnya pakai `await useFetch` di script setup = page blank selama
  // ~1.3s (Neon cold start + DB roundtrip). Sekarang user lihat skeleton
  // dalam ~50ms, form muncul saat data ready.
  // Trade-off: SSR HTML tidak include data lagi (jadi bot/crawler tidak
  // lihat form). Untuk app ini end-user ortu (bukan SEO-critical), worth it.
  lazy: true,
});

useHead(() => ({ title: `Daftar — ${data.value?.lomba?.nama || "Lomba"}` }));

const VIRTUAL_ANAK_ID = "_anak";
const NAMA_MIN = 2;
const NAMA_MAX = 60;
const AGE_COLS = 5; // keep in sync with grid-cols-5 in template

const displayKats = computed(() => {
  const kats = data.value?.kategori ?? [];
  const anakL = kats.find((k) => k.id === "k_anak_l");
  const anakP = kats.find((k) => k.id === "k_anak_p");
  if (anakL && anakP) {
    // NOTE: do NOT name this local var `ref` — it shadows Vue's auto-imported
    // `ref` function and breaks every subsequent ref() call in this <script setup>.
    // (Broke the page in 2026-08-12 — caused "ref is not defined" at hydration,
    //  which looked like the form was "missing".)
    const sample = anakL;
    return [
      ...kats.filter((k) => k.id !== "k_anak_l" && k.id !== "k_anak_p"),
      { id: VIRTUAL_ANAK_ID, nama: "Anak", icon: sample.icon, min: sample.min, max: sample.max, autoAge: sample.autoAge, inputMode: sample.inputMode },
    ];
  }
  return kats;
});

const lomba = computed(() => data.value?.lomba);
// Pre-select first kategori from useFetch so SSR HTML is complete
// (avoids the empty-umur-grid flicker on first paint). For autoAge kats
// (e.g. virtual "Anak"), seed umur to kategori min so the form never
// POSTs `umur: null`. Without this, the form looked "empty" — Step 1
// showed the kategori button, but Step 2 grid rendered as <!--[]--> in
// SSR HTML because selectedKategori was null until onMounted ran client-side.
const initialFirst = (data.value?.kategori ?? [])[0];
// Note: we don't apply the k_anak_l/k_anak_p collapse here because
// `data.value?.kategori` is already the API-filtered eligible list;
// the collapse happens via displayKats, but displayKats[0] is the same
// first element we'd preselect either way for non-collapse cases.
const displayKatsForInit = (() => {
  const kats = data.value?.kategori ?? [];
  const anakL = kats.find((k) => k.id === "k_anak_l");
  const anakP = kats.find((k) => k.id === "k_anak_p");
  if (anakL && anakP) {
    return [
      ...kats.filter((k) => k.id !== "k_anak_l" && k.id !== "k_anak_p"),
      { id: VIRTUAL_ANAK_ID, nama: "Anak", icon: anakL.icon, min: anakL.min, max: anakL.max, autoAge: anakL.autoAge, inputMode: anakL.inputMode },
    ];
  }
  return kats;
})();
const preselectedKat = displayKatsForInit[0] ?? null;
const selectedKategori = ref<string | null>(preselectedKat?.id ?? null);
const selectedUmur = ref<number | null>(preselectedKat?.autoAge ? preselectedKat.min : null);
const nama = ref("");
const jenisKelamin = ref<"L" | "P">("L");
const submitting = ref(false);
const error = ref("");

// Live validation state
const namaTouched = ref(false);
const namaInputRef = ref<HTMLInputElement | null>(null);
const ageGridRef = ref<HTMLDivElement | null>(null);
const firstAgeButtonRef = ref<HTMLButtonElement | null>(null);
// Field-mode input ref (rendered when inputMode === "field")
const ageFieldRef = ref<HTMLInputElement | null>(null);

const namaLen = computed(() => nama.value.trim().length);
const namaValid = computed(() => namaLen.value >= NAMA_MIN && namaLen.value <= NAMA_MAX);
const namaError = computed(() => {
  if (!namaTouched.value) return "";
  if (nama.value.trim().length === 0) return "Nama wajib diisi";
  if (namaLen.value < NAMA_MIN) return `Nama minimal ${NAMA_MIN} karakter`;
  if (namaLen.value > NAMA_MAX) return `Nama maksimal ${NAMA_MAX} karakter`;
  return "";
});
const namaHasError = computed(() => !!namaError.value);
const namaHasSuccess = computed(() => namaTouched.value && namaValid.value);
const charCounterClass = computed(() => {
  if (namaLen.value > NAMA_MAX) return "is-bad";
  if (namaLen.value >= NAMA_MAX - 5) return "is-warn";
  return "is-ok";
});

// Progress: how many of 3 steps done
const progressSteps = computed(() => {
  let done = 0;
  if (selectedKategori.value) done++;
  const skip = selectedKat.value?.autoAge;
  if (skip || selectedUmur.value) done++;
  if (namaValid.value) done++;
  return done;
});
const progressTotal = 3;
const progressPct = computed(() => Math.round((progressSteps.value / progressTotal) * 100));

// Sticky submit visibility — show only when all 3 steps complete.
// umurError guards field-mode out-of-range values: e.g. user typed
// 5 for kategori "Dewasa 18+" → submit stays hidden.
const canSubmit = computed(
  () => !!selectedKategori.value && namaValid.value && (skipUmur.value || (!!selectedUmur.value && !umurError.value))
);

// Unsaved-changes guard
const hasUnsavedChanges = computed(
  () => !!selectedKategori.value || nama.value.trim().length > 0
);

onMounted(() => {
  // Initial kategori/umur selection is now done in script setup (SSR-safe).
  // onMounted only handles the beforeunload guard now.
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", beforeUnloadHandler);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("beforeunload", beforeUnloadHandler);
  }
});

function beforeUnloadHandler(e: BeforeUnloadEvent) {
  if (hasUnsavedChanges.value && !submitting.value) {
    e.preventDefault();
    e.returnValue = "";
  }
}

watch(displayKats, (curr) => {
  if (!selectedKategori.value || !curr.find((k) => k.id === selectedKategori.value)) {
    selectedKategori.value = curr[0]?.id || null;
    selectedUmur.value = null;
  }
});

const selectedKat = computed(
  () => displayKats.value.find((k) => k.id === selectedKategori.value) || null
);
const ages = computed(() => {
  if (!selectedKat.value) return [];
  const arr: number[] = [];
  for (let i = selectedKat.value.min; i <= selectedKat.value.max; i++) arr.push(i);
  return arr;
});
const skipUmur = computed(() => selectedKat.value?.autoAge ?? false);
// Field mode = render number input instead of chip grid. Used when
// kategori range is wide (e.g. Dewasa 18+) and a chip grid would
// render 50+ buttons. Admin picks this per-kategori in /admin/pengaturan.
const useFieldInput = computed(() =>
  !skipUmur.value && selectedKat.value?.inputMode === "field"
);
// Live age validation: only count as "valid" if value is within range
const umurError = computed(() => {
  if (skipUmur.value) return "";
  if (selectedUmur.value === null) return "";
  if (useFieldInput.value && selectedKat.value) {
    if (selectedUmur.value < selectedKat.value.min) {
      return `Minimal ${selectedKat.value.min} tahun`;
    }
    if (selectedKat.value.max < 999 && selectedUmur.value > selectedKat.value.max) {
      return `Maksimal ${selectedKat.value.max} tahun`;
    }
  }
  return "";
});

function selectKategori(id: string) {
  const sameKategori = selectedKategori.value === id;
  selectedKategori.value = id;
  const kat = displayKats.value.find((k) => k.id === id);
  if (kat) selectedUmur.value = kat.autoAge ? kat.min : null;
  // Auto-focus next: skip age step entirely if autoAge; otherwise focus
  // the first interactive element of the umur step (button for chip grid,
  // input for field-mode).
  nextTick(() => {
    if (kat?.autoAge) {
      namaInputRef.value?.focus({ preventScroll: false });
    } else if (kat?.inputMode === "field") {
      // Field mode: focus the number input itself
      ageFieldRef.value?.focus({ preventScroll: false });
    } else if (!sameKategori || !selectedUmur.value) {
      firstAgeButtonRef.value?.focus();
      firstAgeButtonRef.value?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      namaInputRef.value?.focus();
    }
  });
}

function selectUmur(a: number) {
  selectedUmur.value = a;
  // Auto-focus nama input after age selection
  nextTick(() => {
    namaInputRef.value?.focus({ preventScroll: false });
  });
}

// Arrow-key navigation on age grid (roving tabindex pattern)
function onAgeGridKeydown(e: KeyboardEvent) {
  const cols = AGE_COLS;
  const list = ages.value;
  if (list.length === 0) return;
  const currentIdx = selectedUmur.value ? list.indexOf(selectedUmur.value) : -1;
  let nextIdx = currentIdx;

  if (e.key === "ArrowRight") {
    nextIdx = currentIdx < 0 ? 0 : Math.min(currentIdx + 1, list.length - 1);
  } else if (e.key === "ArrowLeft") {
    nextIdx = currentIdx < 0 ? 0 : Math.max(currentIdx - 1, 0);
  } else if (e.key === "ArrowDown") {
    nextIdx = currentIdx < 0 ? 0 : Math.min(currentIdx + cols, list.length - 1);
  } else if (e.key === "ArrowUp") {
    nextIdx = currentIdx < 0 ? 0 : Math.max(currentIdx - cols, 0);
  } else if (e.key === "Home") {
    nextIdx = 0;
  } else if (e.key === "End") {
    nextIdx = list.length - 1;
  } else {
    return;
  }
  e.preventDefault();
  const nextAge = list[nextIdx];
  if (nextAge !== undefined) {
    selectedUmur.value = nextAge;
    // Focus the corresponding button
    nextTick(() => {
      const btn = ageGridRef.value?.querySelector<HTMLButtonElement>(
        `button[data-age="${nextAge}"]`
      );
      btn?.focus();
    });
  }
}

async function submit() {
  // Mark nama as touched so any error appears immediately
  namaTouched.value = true;
  if (!namaValid.value) {
    error.value = "Nama belum valid — perbaiki dulu";
    namaInputRef.value?.focus();
    return;
  }
  if (!selectedKategori.value) { error.value = "Pilih kategori dulu"; return; }
  if (!skipUmur.value && !selectedUmur.value) { error.value = "Pilih umur dulu"; return; }
  submitting.value = true;
  error.value = "";
  try {
    const realKategoriId = selectedKategori.value === VIRTUAL_ANAK_ID
      ? (jenisKelamin.value === "L" ? "k_anak_l" : "k_anak_p")
      : selectedKategori.value!;
    // For autoAge kategori (e.g. Anak), seed umur to kategori min so we
    // never POST null. Pre-submit check above guarantees a number is set
    // for non-autoAge, but for autoAge we synthesize it here.
    const finalUmur = skipUmur.value
      ? (selectedKat.value?.min ?? 0)
      : selectedUmur.value!;
    const res = await $fetch<{ nomor: string }>("/api/pendaftar", {
      method: "POST",
      body: {
        nama: nama.value.trim(),
        jenisKelamin: jenisKelamin.value,
        kategoriId: realKategoriId,
        umur: finalUmur,
        lombaId: lomba.value!.id,
      },
    });
    // Clear dirty state so beforeunload doesn't fire on navigation
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
    }
    await navigateTo(`/pendaftaran/sukses?nomor=${res.nomor}`);
  } catch (e: unknown) {
    // Surface the real server error message instead of generic "Gagal mendaftar".
    // ofetch ($fetch) attaches server's `statusMessage` to e.data.statusMessage
    // when the response is JSON with a `statusMessage` field (h3 convention).
    const err = e as {
      data?: { statusMessage?: string; message?: string; data?: { issues?: Array<{ message: string }> } };
      statusMessage?: string;
      message?: string;
    };
    const zodIssue = err.data?.data?.issues?.[0]?.message;
    error.value =
      zodIssue ||
      err.data?.statusMessage ||
      err.statusMessage ||
      err.data?.message ||
      err.message ||
      "Gagal mendaftar";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <!-- Loading state: form skeleton shown immediately while useFetch
       resolves (lazy: true di script setup). Tanpa ini, page blank
       1-2s (Neon cold start), user bingung. Dengan skeleton + spinner,
       user lihat "Memuat..." dalam ~50ms, form nyusul. -->
  <div v-if="fetchError" class="form-page flex items-center justify-center min-h-[60vh] p-6">
    <div class="text-center">
      <i class="fas fa-circle-exclamation text-4xl text-red-500 mb-3" />
      <p class="text-sm text-gray-700">Gagal memuat form pendaftaran.</p>
      <button type="button" class="mt-3 px-4 py-2 bg-[#E11D1D] text-white text-sm rounded-lg" @click="() => $fetch(`/api/public/lomba/${id.value}/daftar-info`)">
        Coba lagi
      </button>
    </div>
  </div>
  <div v-else-if="!lomba" class="form-page flex flex-col items-center justify-center min-h-[60vh] p-6">
    <div class="skeleton-spinner" aria-hidden="true" />
    <p class="mt-4 text-sm text-gray-600">Memuat form…</p>
  </div>
  <div v-else class="form-page">
    <header class="form-header">
      <div class="header-content">
        <NuxtLink :to="`/lomba/${lomba.id}`" class="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center" aria-label="Kembali ke detail lomba">
          <i class="fas fa-arrow-left" />
        </NuxtLink>
        <h2 class="text-base font-bold">Form Pendaftaran</h2>
        <div class="ml-auto text-[11px] font-mono bg-white/20 px-2 py-0.5 rounded-full" aria-live="polite">
          {{ progressSteps }}/{{ progressTotal }}
        </div>
      </div>
    </header>

    <main class="form-body">
      <div class="form-intro anim-fade-up">
        <div class="text-3xl mb-1">{{ lomba.emoji }}</div>
        <strong>{{ lomba.nama }}</strong>
        <div class="mt-1 text-[12px]">Semua usia · Kapasitas tanpa batas · Gratis</div>
      </div>

      <!-- Stepper -->
      <div class="stepper anim-fade-up" style="animation-delay: 80ms">
        <div :class="['stepper-item', selectedKategori ? 'completed' : 'active']">
          <div class="stepper-circle">{{ selectedKategori ? '✓' : '1' }}</div>
          <div class="stepper-label">Kategori</div>
        </div>
        <div v-if="!skipUmur" :class="['stepper-item', selectedUmur ? 'completed' : (selectedKategori ? 'active' : '')]">
          <div class="stepper-circle">{{ selectedUmur ? '✓' : '2' }}</div>
          <div class="stepper-label">Umur</div>
        </div>
        <div :class="['stepper-item', namaValid ? 'completed' : (selectedUmur || skipUmur ? 'active' : '')]">
          <div class="stepper-circle">{{ namaValid ? '✓' : (skipUmur ? '2' : '3') }}</div>
          <div class="stepper-label">Identitas</div>
        </div>
      </div>

      <div class="step-badge anim-fade-up" style="animation-delay: 120ms">
        <i :class="['fas', selectedKategori ? 'fa-check' : 'fa-1']" /> {{ selectedKategori ? 'Selesai' : 'Langkah 1' }} · Pilih Kategori
      </div>
      <div class="mb-4">
        <label class="label">Kategori Peserta <span class="text-primary">*</span></label>
        <div class="flex flex-col gap-2">
          <button
            v-for="k in displayKats"
            :key="k.id"
            type="button"
            class="w-full px-4 py-3 border-2 rounded-xl text-sm font-semibold text-left flex items-center gap-3 transition-all cursor-pointer"
            :class="selectedKategori === k.id ? 'bg-primary-light border-primary text-primary shadow-sm' : 'bg-white border-[#E5E7EB] text-[#1F2937] hover:border-primary'"
            @click="selectKategori(k.id)"
            :aria-pressed="selectedKategori === k.id"
          >
            <div :class="['w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 transition-all', selectedKategori === k.id ? 'bg-primary text-white scale-110' : 'bg-[#F9FAFB] text-[#6B7280]']">
              {{ KAT_ICON[k.icon] || DEFAULT_KAT_ICON }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-bold">{{ k.nama }}</div>
              <div :class="['text-[11px] font-normal', selectedKategori === k.id ? 'text-primary-dark' : 'text-[#6B7280]']">
                {{ k.autoAge ? `Usia ${k.min}+ tahun · otomatis` : `Usia ${k.min}-${k.max} tahun` }}
              </div>
            </div>
            <div :class="['w-6 h-6 rounded-full flex items-center justify-center text-[12px] flex-shrink-0 transition-all', selectedKategori === k.id ? 'bg-primary text-white' : 'border-2 border-[#D1D5DB] text-transparent']">
              <i class="fas fa-check" />
            </div>
          </button>
        </div>
      </div>

      <template v-if="!skipUmur">
        <div class="step-badge anim-fade-up" style="animation-delay: 140ms">
          <i :class="['fas', selectedUmur ? 'fa-check' : 'fa-2']" /> {{ selectedUmur ? 'Selesai' : 'Langkah 2' }} · Pilih Umur
        </div>
        <div class="mb-4">
          <label class="label">Umur <span class="text-primary">*</span></label>
          <!-- Field mode (admin set inputMode="field"): number input.
               Used when range is wide (e.g. Dewasa 18+) and a chip grid
               would render too many buttons. -->
          <div v-if="useFieldInput">
            <input
              ref="ageFieldRef"
              v-model.number="selectedUmur"
              type="number"
              inputmode="numeric"
              :min="selectedKat?.min"
              :max="selectedKat?.max < 999 ? selectedKat?.max : undefined"
              :placeholder="`${selectedKat?.min}–${selectedKat?.max < 999 ? selectedKat?.max : '∞'} tahun`"
              :aria-invalid="!!umurError"
              :aria-describedby="umurError ? 'umur-hint' : 'umur-help'"
              class="input text-center text-lg font-bold"
              :class="umurError ? 'input-error' : ''"
              @keydown.enter="canSubmit && submit()"
            />
            <div v-if="umurError" id="umur-hint" class="field-hint is-error mt-1.5">
              <i class="fas fa-exclamation-triangle" /> {{ umurError }}
            </div>
            <div v-else-if="selectedKat" id="umur-help" class="text-[11px] text-[#6B7280] text-center mt-2">
              Rentang <strong>{{ selectedKat.min }}</strong>–<strong>{{ selectedKat.max < 999 ? selectedKat.max : 'tanpa batas' }}</strong> tahun untuk <strong>{{ selectedKat.nama }}</strong>
            </div>
          </div>
          <!-- Button mode (default): chip grid with keyboard nav -->
          <div
            v-else
            ref="ageGridRef"
            class="grid grid-cols-5 gap-1.5"
            role="radiogroup"
            aria-label="Pilih umur"
            @keydown="onAgeGridKeydown"
          >
            <button
              v-for="(a, idx) in ages"
              :key="a"
              ref="idx === 0 ? firstAgeButtonRef : undefined"
              :data-age="a"
              type="button"
              role="radio"
              :aria-checked="selectedUmur === a"
              :tabindex="selectedUmur === a || (selectedUmur === null && idx === 0) ? 0 : -1"
              class="py-3 border-2 rounded-xl text-sm font-bold text-center min-h-[44px] transition-all cursor-pointer"
              :class="selectedUmur === a ? 'bg-primary border-primary text-white shadow-sm' : 'bg-white border-[#E5E7EB] text-[#1F2937] hover:border-primary focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary-light'"
              @click="selectUmur(a)"
            >{{ a }}</button>
          </div>
          <div v-if="!useFieldInput && selectedKat" class="text-[11px] text-[#6B7280] text-center mt-2">
            <strong class="text-primary">{{ ages.length }}</strong> tombol umur untuk <strong>{{ selectedKat.nama }}</strong> ({{ selectedKat.min }}-{{ selectedKat.max }} tahun)
          </div>
        </div>
      </template>

      <div v-else-if="selectedKat" class="notice notice-info mb-4 anim-fade-up" style="animation-delay: 140ms">
        <i class="fas fa-circle-info" />
        <div>
          <strong>Kategori {{ selectedKat.nama }}:</strong> tidak perlu pilih umur. Peserta akan otomatis tercatat dengan usia minimum kategori ({{ selectedKat.min }} tahun ke atas).
        </div>
      </div>

      <div class="step-badge anim-fade-up" style="animation-delay: 160ms" :style="{ background: '#DCFCE7', color: '#15803D' }">
        <i :class="['fas', skipUmur ? 'fa-2' : 'fa-3']" /> Langkah {{ skipUmur ? 2 : 3 }} · Isi Identitas
      </div>

      <div class="mb-4">
        <label class="label" for="nama">Nama Lengkap <span class="text-primary">*</span></label>
        <div
          :class="['input-with-icon', { 'has-success': namaHasSuccess, 'has-error': namaHasError }]"
        >
          <input
            id="nama"
            ref="namaInputRef"
            v-model="nama"
            type="text"
            placeholder="Contoh: Budi Santoso"
            class="input"
            :class="{ 'input-error': namaHasError, 'input-success': namaHasSuccess }"
            :maxlength="NAMA_MAX + 10"
            autocomplete="name"
            autocapitalize="words"
            spellcheck="false"
            :aria-invalid="namaHasError"
            :aria-describedby="namaHasError ? 'nama-hint' : 'nama-helper'"
            @blur="namaTouched = true"
            @input="namaTouched = true"
            @keydown.enter="canSubmit && submit()"
          />
          <div
            :class="['input-icon', namaHasError ? 'is-error' : namaHasSuccess ? 'is-success' : 'is-hidden']"
            aria-hidden="true"
          >
            <i :class="['fas', namaHasError ? 'fa-circle-exclamation' : 'fa-circle-check']" />
          </div>
        </div>
        <div
          :id="namaHasError ? 'nama-hint' : 'nama-helper'"
          :class="['field-hint', namaHasError ? 'is-error' : namaHasSuccess ? 'is-success' : '']"
        >
          <template v-if="namaHasError">
            <i class="fas fa-exclamation-triangle" /> {{ namaError }}
          </template>
          <template v-else-if="namaHasSuccess">
            <i class="fas fa-check" /> Terlihat bagus!
          </template>
          <template v-else>
            <span>Sesuai KTP / Kartu Keluarga</span>
            <span class="ml-auto char-counter" :class="charCounterClass">
              {{ namaLen }} / {{ NAMA_MAX }}
            </span>
          </template>
        </div>
        <div
          v-if="!namaHasError && !namaHasSuccess"
          class="field-hint"
        >
          <span class="char-counter ml-auto" :class="charCounterClass" />
        </div>
      </div>

      <div class="mb-4">
        <label class="label">Jenis Kelamin <span class="text-primary">*</span></label>
        <div class="radio-group">
          <div
            :class="['radio-option', jenisKelamin === 'L' ? 'active' : '']"
            role="radio"
            :aria-checked="jenisKelamin === 'L'"
            tabindex="0"
            @click="jenisKelamin = 'L'"
            @keyup.enter="jenisKelamin = 'L'"
            @keydown.space.prevent="jenisKelamin = 'L'"
          >
            <i class="fas fa-mars" /> Laki-laki
          </div>
          <div
            :class="['radio-option', jenisKelamin === 'P' ? 'active' : '']"
            role="radio"
            :aria-checked="jenisKelamin === 'P'"
            tabindex="0"
            @click="jenisKelamin = 'P'"
            @keyup.enter="jenisKelamin = 'P'"
            @keydown.space.prevent="jenisKelamin = 'P'"
          >
            <i class="fas fa-venus" /> Perempuan
          </div>
        </div>
      </div>

      <div v-if="error" class="notice notice-error mb-3 anim-fade-up" role="alert">
        <i class="fas fa-exclamation-triangle" />
        <div>{{ error }}</div>
      </div>

      <!-- Desktop / non-sticky submit (always visible at end of form) -->
      <button
        :disabled="submitting || !canSubmit"
        class="btn btn-primary btn-block disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        :class="{ 'anim-pulse-glow': canSubmit && !submitting }"
        @click="submit"
      >
        <template v-if="submitting"><i class="fas fa-spinner fa-spin" /> Mengirim...</template>
        <template v-else><i class="fas fa-paper-plane" /> Kirim Pendaftaran</template>
      </button>
    </main>

    <!-- Sticky submit bar — appears once all required steps complete (mobile) -->
    <Teleport to="body">
      <Transition name="slide-up">
        <div v-if="canSubmit && !submitting" class="form-progress md:hidden">
          <div class="flex items-center gap-3">
            <div class="flex-1 min-w-0">
              <div class="text-[10px] text-[#6B7280] font-bold uppercase tracking-wide">Siap kirim</div>
              <div class="text-sm font-bold text-[#1F2937] truncate">
                {{ nama || "..." }}
                <span class="text-[#6B7280] font-normal">·</span>
                {{ skipUmur ? selectedKat?.nama : `Umur ${selectedUmur} tahun` }}
              </div>
            </div>
            <button
              type="button"
              class="btn btn-primary !py-2.5 !px-4 !text-[13px] flex-shrink-0"
              :disabled="submitting"
              @click="submit"
            >
              <i class="fas fa-paper-plane" /> Kirim
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.25s ease-out;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
@media (prefers-reduced-motion: reduce) {
  .slide-up-enter-active,
  .slide-up-leave-active {
    transition: none;
  }
}

/* Skeleton spinner — visible ~50ms (saat useFetch lazy: true fetch di
   background), form nyusul ~1-1.3s kemudian. User lihat "Memuat..."
   bukan blank page, dramatically improves perceived speed. */
.skeleton-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #FEE2E2;
  border-top-color: #E11D1D;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
