<script setup lang="ts">
// Public home — list lomba with category filter (client-side, no URL change).
// Vue 3 port of app/page.tsx + app/home-client.tsx, with festive UI/UX polish.
import type { LombaSlim, KategoriSlim } from "~/utils/types";
import { KAT_ICON, DEFAULT_KAT_ICON } from "~/utils/constants";
import {
  formatTanggalLomba,
  lombaTimeStatus,
  displayKategoriName,
  groupKategoriByPublicName,
  type LombaTimeStatus,
} from "~/utils/format";

useHead({ title: "Lomba Kampung" });

const { data } = await useFetch<{
  lomba: LombaSlim[];
  kategori: KategoriSlim[];
  cfg: { appName: string; kampungName: string; tahunAktif: string };
  isAdmin: boolean;
}>("/api/public/home", { credentials: "include" });

const lomba = computed<LombaSlim[]>(() => (data.value?.lomba ?? []) as LombaSlim[]);
const kats = computed<KategoriSlim[]>(() => (data.value?.kategori ?? []) as KategoriSlim[]);
const cfg = computed(() => data.value?.cfg);
const isAdmin = computed(() => data.value?.isAdmin ?? false);

const activeKat = ref<string | null>(null);
const search = ref("");

const katMap = computed(() => new Map<string, KategoriSlim>(kats.value.map((k) => [k.id, k] as const)));

const countByPublicName = computed(() => {
  const m = new Map<string, number>();
  for (const l of lomba.value) {
    const publicNames = new Set<string>();
    for (const kid of Array.isArray(l.kategoriEligible) ? l.kategoriEligible : []) {
      publicNames.add(displayKategoriName(kid, katMap.value.get(kid)));
    }
    for (const name of publicNames) {
      m.set(name, (m.get(name) ?? 0) + 1);
    }
  }
  return m;
});

const availablePublicKats = computed(() => {
  const seen = new Set<string>();
  const out: { publicName: string; sample: KategoriSlim }[] = [];
  for (const k of kats.value) {
    const publicName = displayKategoriName(k.id, k);
    if (seen.has(publicName)) continue;
    seen.add(publicName);
    if ((countByPublicName.value.get(publicName) ?? 0) > 0) {
      out.push({ publicName, sample: k });
    }
  }
  return out;
});

const visibleLomba = computed(() => {
  const q = search.value.trim().toLowerCase();
  return lomba.value.filter((l) => {
    if (activeKat.value) {
      const hasMatch = (Array.isArray(l.kategoriEligible) ? l.kategoriEligible : []).some(
        (kid) => displayKategoriName(kid, katMap.value.get(kid)) === activeKat.value
      );
      if (!hasMatch) return false;
    }
    if (q && !l.nama.toLowerCase().includes(q)) return false;
    return true;
  });
});

const isFiltered = computed(() => search.value.trim() !== "" || activeKat.value !== null);

const totalPeserta = computed(() => lomba.value.reduce((s, l) => s + (l.count ?? 0), 0));

// Static badge map — one allocation per module load, not per call.
const TIME_STATUS_BADGE: Record<LombaTimeStatus, { label: string; cls: string }> = {
  "akan-datang": { label: "Akan Datang", cls: "pill pill-soon" },
  "sedang-berlangsung": { label: "Berlangsung", cls: "pill pill-live" },
  "lewat-jadwal": { label: "Lewat", cls: "pill pill-past" },
  "belum-dijadwalkan": { label: "Belum Mulai", cls: "pill pill-not-started" },
};

function timeStatusBadge(l: LombaSlim) {
  const ts = lombaTimeStatus(l.jadwalByKategori, l.kategoriEligible);
  // Lomba with no jadwal yet but already has peserta → mark as "live" so
  // admins/visitors see the lomba is actively running, not just empty.
  if (ts === "belum-dijadwalkan" && (l.count ?? 0) > 0) {
    return TIME_STATUS_BADGE["sedang-berlangsung"];
  }
  return TIME_STATUS_BADGE[ts];
}

// Earliest jadwal across a list of kategori IDs (used for the date pill on
// each lomba card). Returns null when none of the kategori have a tanggal.
function earliestJadwal(l: LombaSlim, kategoriIds: string[]) {
  const withTanggal = kategoriIds
    .map((kid) => l.jadwalByKategori?.[kid])
    .filter((j): j is { kategoriId: string; tanggal: number; jam: string | null } => !!j && j.tanggal != null);
  return withTanggal.reduce<{ kategoriId: string; tanggal: number; jam: string | null } | null>(
    (min, j) => (min == null || j.tanggal < min.tanggal ? j : min),
    null
  );
}

// Count-up animation — animates a ref from previous value to the source
// ref's current value with ease-out cubic. Used for the hero stat pills
// ("N lomba", "N pendaftar") so the page feels alive on load instead of
// dropping the final number in cold.
function useCountUp(source: Ref<number>, durationMs = 900) {
  const current = ref(0);
  let rafId: number | null = null;

  function animate(from: number, to: number) {
    // Skip RAF entirely during SSR — requestAnimationFrame only exists in
    // browsers. Snap to final value so the rendered HTML has the correct
    // number; the client will re-run the watcher and animate from there.
    if (typeof window === "undefined") {
      current.value = to;
      return;
    }
    if (rafId != null) cancelAnimationFrame(rafId);
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / durationMs, 1);
      // ease-out cubic — fast start, gentle settle
      const eased = 1 - Math.pow(1 - t, 3);
      current.value = Math.round(from + (to - from) * eased);
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  watch(
    source,
    (val, prev) => animate(prev ?? 0, val),
    { immediate: true }
  );

  onBeforeUnmount(() => {
    if (rafId != null) cancelAnimationFrame(rafId);
  });

  return current;
}

const displayedLombaCount = useCountUp(computed(() => lomba.value.length));
const displayedPesertaCount = useCountUp(computed(() => totalPeserta.value));
</script>

<template>
  <div class="mobile-page">
    <!-- Festive header -->
    <header class="app-header">
      <div class="header-content header-content-wide">
        <div class="logo flex-1 min-w-0">
          <img src="/logo.webp" alt="Logo IPPeKa" class="w-7 h-7 rounded-full object-cover bg-white/10 flex-shrink-0" />
          <span class="truncate min-w-0">{{ cfg?.appName || "Lomba Kampung" }}</span>
        </div>
        <NuxtLink v-if="isAdmin" to="/admin" class="ml-auto text-sm font-semibold bg-white/20 px-3 py-1.5 rounded-full flex items-center gap-1.5 no-underline text-white flex-shrink-0">
          <i class="fas fa-gauge-high" />
          <span class="hidden sm:inline">Admin</span>
        </NuxtLink>
        <NuxtLink v-else to="/admin/login" class="ml-auto text-sm opacity-80 text-white flex-shrink-0" title="Login Admin" aria-label="Login Admin">
          <i class="fas fa-user-shield" />
        </NuxtLink>
      </div>
    </header>

    <!-- Festive hero -->
    <div class="hero-festive anim-fade-up">
      <div class="hero-pill mb-2 anim-scale-in" style="animation-delay: 80ms">
        <span>🇮🇩</span>
        <span>{{ cfg?.tahunAktif || "HUT RI ke-81 (2026)" }}</span>
      </div>
      <h1 class="anim-scale-in" style="animation-delay: 140ms">Perlombaan 17 Agustus</h1>
      <p class="anim-fade-up" style="animation-delay: 220ms">{{ cfg?.kampungName || "Kampung Kadu Jaya" }}</p>
      <div class="mt-3 flex items-center justify-center gap-2 text-[12px] font-semibold flex-wrap anim-fade-up" style="animation-delay: 300ms">
        <span class="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full border border-white/20 anim-wiggle">
          <i class="fas fa-trophy" /> {{ displayedLombaCount }} lomba
        </span>
        <span class="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full border border-white/20 anim-wiggle">
          <i class="fas fa-users" /> {{ displayedPesertaCount }} pendaftar
        </span>
      </div>
    </div>

    <main class="app-content w-full lg:max-w-[1100px] mx-auto">
      <!-- Cara daftar mini-section -->
      <div v-if="!isFiltered" class="how-to anim-fade-up" style="animation-delay: 80ms">
        <div class="how-to-step" style="animation-delay: 180ms">
          <div class="step-num anim-celebrate" style="animation-delay: 280ms">1</div>
          <span class="step-icon">👀</span>
          <div class="step-label">Pilih lomba</div>
        </div>
        <div class="how-to-step" style="animation-delay: 260ms">
          <div class="step-num anim-celebrate" style="animation-delay: 360ms">2</div>
          <span class="step-icon">📝</span>
          <div class="step-label">Isi form</div>
        </div>
        <div class="how-to-step" style="animation-delay: 340ms">
          <div class="step-num anim-celebrate" style="animation-delay: 440ms">3</div>
          <span class="step-icon">🏆</span>
          <div class="step-label">Siap lomba!</div>
        </div>
      </div>

      <!-- Search bar -->
      <div class="search-festive anim-fade-up" style="animation-delay: 120ms">
        <i class="fas fa-search search-icon" />
        <input
          v-model="search"
          type="text"
          placeholder="Cari nama lomba..."
          aria-label="Cari nama lomba"
        />
        <button
          v-if="search"
          type="button"
          aria-label="Bersihkan pencarian"
          class="search-clear"
          @click="search = ''"
        >
          <i class="fas fa-xmark text-[12px]" />
        </button>
      </div>

      <!-- Filter chips -->
      <div class="-mx-4 px-4 mt-3 overflow-x-auto anim-fade-up" style="animation-delay: 160ms">
        <div class="flex gap-2 min-w-max pb-1">
          <button
            type="button"
            :class="['chip', { active: activeKat === null }]"
            @click="activeKat = null"
          >
            <i class="fas fa-trophy text-[10px]" /> Semua ({{ lomba.length }})
          </button>
          <button
            v-for="{ publicName, sample: k } in availablePublicKats"
            :key="publicName"
            type="button"
            :class="['chip', { active: activeKat === publicName }]"
            :style="activeKat === publicName ? {
              background: k.colorBg || '#E11D1D',
              borderColor: k.colorBorder || k.colorBg || '#E11D1D',
              color: k.colorText || '#FFFFFF',
              boxShadow: `0 4px 12px ${k.colorBg || '#E11D1D'}50`,
            } : {}"
            @click="activeKat = activeKat === publicName ? null : publicName"
          >
            <span>{{ KAT_ICON[k.icon || 'fa-user'] || DEFAULT_KAT_ICON }}</span>
            {{ publicName }} ({{ countByPublicName.get(publicName) ?? 0 }})
          </button>
        </div>
      </div>

      <!-- Result count + reset -->
      <div v-if="isFiltered" class="flex items-center justify-between text-[12px] text-[#6B7280] mt-3 mb-3 anim-fade-up">
        <span>
          Menampilkan <strong class="text-[#1F2937]">{{ visibleLomba.length }}</strong> dari {{ lomba.length }} lomba
          <span v-if="activeKat" class="text-[#9CA3AF]"> · <strong>{{ activeKat }}</strong></span>
        </span>
        <button type="button" class="text-primary font-semibold hover:underline cursor-pointer" @click="search = ''; activeKat = null">
          <i class="fas fa-xmark text-[10px]" /> Reset
        </button>
      </div>

      <!-- Lomba grid -->
      <div v-if="visibleLomba.length === 0" class="empty-state anim-fade-up">
        <span class="empty-emoji">🔍</span>
        <div class="empty-title">Tidak ada lomba yang cocok</div>
        <p class="empty-text">Coba kata kunci lain atau ubah filter kategori.</p>
        <button type="button" class="btn btn-secondary btn-sm mt-4" @click="search = ''; activeKat = null">
          <i class="fas fa-rotate-left" /> Reset filter
        </button>
      </div>
      <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <NuxtLink
          v-for="(l, i) in visibleLomba"
          :key="l.id"
          :to="`/lomba/${l.id}`"
          class="lomba-card group anim-fade-up"
          :style="{ animationDelay: `${Math.min(i, 8) * 40}ms` }"
          style="text-decoration: none; color: inherit"
        >
          <div class="lomba-icon">{{ l.emoji }}</div>
          <div class="lomba-info flex flex-col gap-2 min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap pr-6">
              <h3 class="flex-1 min-w-0 break-words">{{ l.nama }}</h3>
              <span
                v-if="timeStatusBadge(l)"
                :class="timeStatusBadge(l)!.cls"
              >{{ timeStatusBadge(l)!.label }}</span>
              <span
                v-if="l.pendaftaranDibuka === false"
                class="pill pill-closed"
              >
                <i class="fas fa-lock" /> Ditutup
              </span>
            </div>
            <p v-if="l.deskripsi" class="text-[11px] text-[#6B7280] line-clamp-2 leading-relaxed break-words">{{ l.deskripsi }}</p>
            <!-- Tags + tanggal (grouped by public name) -->
            <div v-if="Array.isArray(l.kategoriEligible) && l.kategoriEligible.length > 0" class="flex flex-col gap-1.5">
              <div
                v-for="{ publicName, kategoriIds } in groupKategoriByPublicName(
                  l.kategoriEligible.filter((kid) => !!katMap.get(kid)),
                  katMap as unknown as Map<string, { nama: string }>
                )"
                :key="publicName"
                class="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2 sm:flex-wrap text-[10px]"
              >
                <KatTag
                  :nama="publicName"
                  :color-bg="katMap.get(kategoriIds[0])?.colorBg"
                  :color-text="katMap.get(kategoriIds[0])?.colorText"
                  :color-border="katMap.get(kategoriIds[0])?.colorBorder"
                />
                <span v-if="earliestJadwal(l, kategoriIds)" class="text-[10px] text-[#6B7280] flex items-center gap-1">
                  <i class="far fa-calendar text-[10px] text-primary" />
                  <span class="font-semibold text-[#374151]">{{ formatTanggalLomba(earliestJadwal(l, kategoriIds)!.tanggal, 'short') }}</span>
                  <span class="text-[#9CA3AF]">· {{ earliestJadwal(l, kategoriIds)!.jam }}</span>
                </span>
                <span v-else class="text-[10px] text-[#9CA3AF] italic">Belum dijadwalkan</span>
              </div>
            </div>
            <!-- Peserta count -->
            <div v-if="(l.count ?? 0) > 0" class="self-start peserta-chip">
              <i class="fas fa-users text-[11px]" />
              <span>{{ l.count }} peserta</span>
            </div>
            <div v-else class="self-start inline-flex items-center gap-1.5 text-[11px] text-[#9CA3AF] italic">
              <i class="fas fa-user-slash text-[10px]" />
              <span>Belum ada peserta</span>
            </div>
          </div>
        </NuxtLink>
      </div>

      <p v-if="!isFiltered" class="text-center text-[11px] text-[#9CA3AF] mt-4">
        Kapasitas tanpa batas — daftar kapan saja ✨
      </p>
    </main>
  </div>
</template>
