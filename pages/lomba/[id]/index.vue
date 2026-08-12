<script setup lang="ts">
// Public lomba detail — Vue 3 port of app/lomba/[id]/page.tsx.
// Server-rendered via useFetch; client receives pre-shaped data.
import { getInitials, formatTanggalLomba, lombaTimeStatus, juaraLabel, displayKategoriName } from "~/utils/format";

// Convert hex to rgba — used to derive light tints for section backgrounds
// without mutating stored kategori colors. Solid colorBg in DB (e.g. k_anak_l
// = #E11D1D) would otherwise dominate the page; alpha 0.1 keeps the section
// visually grouped but text stays legible.
function hexToRgba(hex: string, alpha: number): string {
  const h = (hex || "#F3F4F6").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const route = useRoute();
const id = computed(() => Number(route.params.id));

const { data, error } = await useFetch<{
  lomba: any;
  kategori: Array<{ id: string; nama: string; icon?: string; colorBg?: string; colorText?: string; colorBorder?: string }>;
  sections: Array<{
    key: string;
    title: string;
    rangeLabel: string;
    peserta: Array<{ nama: string; umur: number; jenisKelamin: "L" | "P"; kategoriId: string }>;
  }>;
  finalisByKategori: Record<string, any[]>;
  pjEntries: Array<{ katId: string; pj: { nama: string; kontak: string | null } }>;
  totalPeserta: number;
  totalJuara: number;
  totalFinalis: number;
  readinessAllReady: boolean;
}>(() => `/api/public/lomba/${id.value}`, { credentials: "include" });

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: "Lomba tidak ditemukan" });
}

useHead(() => ({
  title: data.value?.lomba?.nama ? `${data.value.lomba.nama} — Lomba Kampung` : "Lomba Kampung",
}));

const l = computed(() => data.value?.lomba);
const kats = computed(() => data.value?.kategori ?? []);
const sections = computed(() => data.value?.sections ?? []);
const finalisByKategori = computed(() => data.value?.finalisByKategori ?? {});
const pjEntries = computed(() => data.value?.pjEntries ?? []);
const katMap = computed(() => new Map(kats.value.map((k: any) => [k.id, k])));

const eligibleKategori = computed(() => Array.isArray(l.value?.kategoriEligible) ? l.value.kategoriEligible : []);
const kualMap = computed(() => l.value?.kategoriTutupAt?.kual || {});
const allKategoriTutup = computed(() => eligibleKategori.value.length > 0 && eligibleKategori.value.every((kid: string) => !!kualMap.value[kid]));
const anyKategoriTutup = computed(() => eligibleKategori.value.some((kid: string) => !!kualMap.value[kid]));
const showJuaraTerpilih = computed(() => data.value?.readinessAllReady && (data.value?.totalJuara ?? 0) > 0);
const timeStatus = computed(() =>
  l.value?.status === "aktif"
    ? lombaTimeStatus(l.value.jadwalByKategori, eligibleKategori.value)
    : "belum-dijadwalkan"
);
const publicStatus = computed(() => {
  if (l.value?.status === "selesai") return "selesai";
  if (showJuaraTerpilih.value) return "juara-terpilih";
  if (timeStatus.value === "akan-datang") return "akan-datang";
  if (timeStatus.value === "sedang-berlangsung") return "berlangsung";
  if (timeStatus.value === "lewat-jadwal") return "lewat-jadwal";
  if (allKategoriTutup.value || anyKategoriTutup.value) return "final";
  if (sections.value.length > 0 && eligibleKategori.value.length > 0) return "kualifikasi";
  return "belum-mulai";
});

const showFinalis = computed(() => anyKategoriTutup.value && (data.value?.totalFinalis ?? 0) > 0);

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  "coming-soon":    { label: "Coming Soon", bg: "#E5E7EB", text: "#374151", icon: "fa-clock" },
  "berlangsung":    { label: "Sedang Berlangsung", bg: "#FBBF24", text: "#92400E", icon: "fa-bolt" },
  "kualifikasi":    { label: "Tahap Kualifikasi", bg: "#FEF3C7", text: "#92400E", icon: "fa-hourglass-half" },
  "final":          { label: "Tahap Final", bg: "#DBEAFE", text: "#1E40AF", icon: "fa-trophy" },
  "juara-terpilih": { label: "Juara Terpilih", bg: "#DCFCE7", text: "#15803D", icon: "fa-crown" },
  "selesai":        { label: "Selesai", bg: "#1F2937", text: "#FFFFFF", icon: "fa-flag-checkered" },
  "akan-datang":    { label: "Akan Datang", bg: "#8B5CF6", text: "#FFFFFF", icon: "fa-calendar" },
  "lewat-jadwal":   { label: "Lewat Jadwal", bg: "#6B7280", text: "#FFFFFF", icon: "fa-calendar-xmark" },
  "belum-mulai":    { label: "Belum Mulai", bg: "#E5E7EB", text: "#374151", icon: "fa-circle-pause" },
};

// Group jadwal by public name
type JadwalGroup = { publicName: string; sampleKat?: any; jadwals: Array<{ tanggal: number; jam: string | null }> };
const jadwalGroups = computed<JadwalGroup[]>(() => {
  const seen = new Map<string, JadwalGroup>();
  const ordered: JadwalGroup[] = [];
  for (const kid of eligibleKategori.value) {
    const sampleKat = (katMap.value as any).get(kid);
    const publicName = displayKategoriName(kid, sampleKat);
    let g = seen.get(publicName);
    if (!g) {
      g = { publicName, sampleKat, jadwals: [] };
      seen.set(publicName, g);
      ordered.push(g);
    }
    const j = l.value?.jadwalByKategori?.[kid];
    if (j && j.tanggal != null) g.jadwals.push({ tanggal: j.tanggal, jam: j.jam });
  }
  return ordered;
});
const withJadwal = computed(() => jadwalGroups.value.filter((g) => g.jadwals.length > 0));

// =================== Sections enriched with jadwal ===================
// Each section (grouped by age range like "Anak Laki-laki") gets the
// earliest upcoming jadwal of its kategori, so the public can see WHEN
// that batch is competing.
type EnrichedPeserta = {
  nama: string;
  umur: number;
  jenisKelamin: "L" | "P";
  kategoriId: string;
  kategoriLabel: string;
  jadwalTanggal: number | null;
  jadwalJam: string | null;
};
type EnrichedSection = {
  key: string;
  title: string;
  rangeLabel: string;
  icon: string;
  colorBg: string;
  colorText: string;
  colorBorder: string;
  totalCount: number;
  // Earliest upcoming jadwal for this section (across all peserta)
  earliestJadwal: { tanggal: number; jam: string | null; publicName: string } | null;
  peserta: EnrichedPeserta[];
  // If section contains >1 kategori, show "multi" indicator
  isMultiKategori: boolean;
};
const sectionsEnriched = computed<EnrichedSection[]>(() => {
  const out: EnrichedSection[] = [];
  const now = Date.now();
  for (const sec of sections.value) {
    // Find distinct kategori labels + first jadwal across the section
    const katSet = new Set<string>();
    const enrichedPeserta: EnrichedPeserta[] = [];
    for (const p of sec.peserta) {
      katSet.add(p.kategoriId);
      const kat = (katMap.value as any).get(p.kategoriId);
      const j = l.value?.jadwalByKategori?.[p.kategoriId];
      enrichedPeserta.push({
        nama: p.nama,
        umur: p.umur,
        jenisKelamin: p.jenisKelamin,
        kategoriId: p.kategoriId,
        kategoriLabel: displayKategoriName(p.kategoriId, kat),
        jadwalTanggal: j?.tanggal ?? null,
        jadwalJam: j?.jam ?? null,
      });
    }
    // Pick the earliest FUTURE jadwal (or first jadwal if none future)
    const withJadwalArr = enrichedPeserta
      .filter((p) => p.jadwalTanggal != null)
      .sort((a, b) => (a.jadwalTanggal! - b.jadwalTanggal!));
    let earliest: EnrichedSection["earliestJadwal"] = null;
    for (const p of withJadwalArr) {
      const ts = p.jadwalTanggal! * 1000; // unix seconds → ms
      if (ts >= now - 86_400_000) { // include today
        const kat = (katMap.value as any).get(p.kategoriId);
        earliest = {
          tanggal: p.jadwalTanggal!,
          jam: p.jadwalJam ?? null,
          publicName: displayKategoriName(p.kategoriId, kat),
        };
        break;
      }
    }
    if (!earliest && withJadwalArr.length > 0) {
      // fall back to most recent past jadwal
      const p = withJadwalArr[withJadwalArr.length - 1];
      const kat = (katMap.value as any).get(p.kategoriId);
      earliest = {
        tanggal: p.jadwalTanggal!,
        jam: p.jadwalJam ?? null,
        publicName: displayKategoriName(p.kategoriId, kat),
      };
    }
    // Section visual style: use first kategori's colors
    const sampleKat = sec.peserta.length > 0
      ? (katMap.value as any).get(sec.peserta[0].kategoriId)
      : null;
    out.push({
      key: sec.key,
      title: sec.title,
      rangeLabel: sec.rangeLabel,
      icon: sampleKat?.icon || "fas fa-users",
      colorBg: sampleKat?.colorBg || "#FEF3C7",
      colorText: sampleKat?.colorText || "#92400E",
      colorBorder: sampleKat?.colorBorder || "#FDE68A",
      totalCount: sec.peserta.length,
      earliestJadwal: earliest,
      peserta: enrichedPeserta,
      isMultiKategori: katSet.size > 1,
    });
  }
  return out;
});

// Scroll to the registration CTA at the bottom of the page
function scrollToDaftar() {
  if (typeof document === "undefined") return;
  const target = document.getElementById("cta-daftar");
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// Group PJ by public name
type PjGroup = { publicName: string; sampleKat?: any; pjs: Array<{ nama: string; kontak: string | null }> };
const pjGroups = computed<PjGroup[]>(() => {
  const seen = new Map<string, PjGroup>();
  const ordered: PjGroup[] = [];
  for (const kid of eligibleKategori.value) {
    const kat = (katMap.value as any).get(kid);
    if (!kat) continue;
    const pjs = pjEntries.value.filter((e) => e.katId === kid).map((e) => e.pj);
    if (pjs.length === 0) continue;
    const publicName = displayKategoriName(kid, kat);
    let group = seen.get(publicName);
    if (!group) {
      group = { publicName, sampleKat: kat, pjs: [] };
      seen.set(publicName, group);
      ordered.push(group);
    }
    for (const pj of pjs) {
      if (!group.pjs.some((p) => p.nama === pj.nama)) group.pjs.push(pj);
    }
  }
  return ordered;
});
</script>

<template>
  <div v-if="l" class="mobile-page">
    <!-- Festive hero -->
    <div class="detail-hero anim-fade-up">
      <NuxtLink to="/" class="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center hover:bg-white/30 transition-colors z-10" aria-label="Kembali ke daftar lomba">
        <i class="fas fa-arrow-left" />
      </NuxtLink>
      <div class="detail-hero-content">
        <div class="text-7xl mb-3 anim-float inline-block">{{ l.emoji }}</div>
        <h1 class="text-[24px] sm:text-[28px] font-extrabold mb-1 leading-tight drop-shadow-md">{{ l.nama }}</h1>
        <div class="flex flex-col items-center gap-2.5 mt-2">
          <span class="hero-pill">
            <i class="fas fa-tag" />
            {{ eligibleKategori.map((k: string) => (katMap.get(k) as any)?.nama).filter(Boolean).join(" · ") }}
          </span>
          <span
            v-if="l.faseEnabled"
            class="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#1E40AF] via-[#92400E] to-[#7C3AED] px-3 py-1.5 rounded-full text-[11px] font-extrabold text-white shadow-lg"
            title="Lomba ini punya 3 fase: Kualifikasi → Semi Final → Final"
          >
            <i class="fas fa-sitemap" /> 3 Fase: Kualifikasi → Semi Final → Final
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1.5 bg-white text-[#9D1010] px-3 py-1.5 rounded-full text-[11px] font-extrabold border border-[#E11D1D]/40 shadow-sm"
            title="Lomba ini punya 2 fase: Kualifikasi → Final"
          >
            <i class="fas fa-stream" /> 2 Fase: Kualifikasi → Final
          </span>
          <span
            v-if="STATUS_BADGES[publicStatus]"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold shadow"
            :style="{ background: STATUS_BADGES[publicStatus].bg, color: STATUS_BADGES[publicStatus].text }"
          >
            <i :class="['fas', STATUS_BADGES[publicStatus].icon]" /> {{ STATUS_BADGES[publicStatus].label }}
          </span>
        </div>
      </div>
    </div>

    <!-- Scroll hint: registration CTA is at the bottom of the page -->
    <div
      v-if="l.status === 'aktif' && l.pendaftaranDibuka !== false"
      class="text-center -mt-3 mb-2 anim-fade-up"
      style="animation-delay: 250ms"
    >
      <button
        type="button"
        @click="scrollToDaftar"
        class="inline-flex items-center gap-1.5 text-[12px] font-bold text-primary bg-white/95 backdrop-blur px-3.5 py-2 rounded-full border border-primary/30 shadow-md hover:bg-primary hover:text-white hover:border-primary transition-all no-underline cursor-pointer"
        aria-label="Scroll ke bawah untuk tombol pendaftaran"
      >
        <i class="fas fa-pen-to-square text-[11px]" />
        Scroll untuk mendaftar
        <i class="fas fa-arrow-down anim-float text-[11px]" style="animation-duration: 1.5s" />
      </button>
    </div>

    <main class="app-content max-w-[1100px] mx-auto w-full">
      <!-- Deskripsi -->
      <div v-if="l.deskripsi" class="relative mb-5 p-4 sm:p-5 rounded-2xl border border-[#FCE0E0] bg-gradient-to-br from-[#FCE0E0]/60 via-[#FDF5F5] to-white shadow-sm overflow-hidden">
        <i class="fas fa-quote-left absolute top-3 right-4 text-2xl text-primary opacity-20" aria-hidden="true" />
        <div class="text-[10px] font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <i class="fas fa-book-open text-[10px]" /> Tentang Lomba
        </div>
        <p class="text-[14px] text-[#1F2937] leading-relaxed break-words relative z-[1]">{{ l.deskripsi }}</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <!-- Left col -->
        <div class="space-y-3.5">
          <!-- Syarat -->
          <div class="info-section">
            <h3 class="text-[13px] font-bold mb-3 text-[#1F2937] flex items-center gap-2">
              <i class="fas fa-clipboard-list text-primary" /> Syarat & Ketentuan
            </h3>
            <ul class="space-y-2.5 text-[13px] text-[#6B7280] list-none p-0 leading-relaxed">
              <li v-for="(s, i) in (l.syarat || [])" :key="i" class="pl-5 relative">
                <span class="absolute left-0 text-[#15803D] font-bold">✓</span> {{ s }}
              </li>
            </ul>
          </div>

          <!-- Jadwal -->
          <div class="info-section">
            <h3 class="text-[13px] font-bold mb-3 text-[#1F2937] flex items-center gap-2">
              <i class="far fa-calendar text-primary" /> Jadwal Pelaksanaan
            </h3>
            <div v-if="withJadwal.length === 0" class="text-center py-3 text-[#6B7280] text-sm">
              Belum ada jadwal yang diumumkan
            </div>
            <div v-else class="space-y-2.5 mt-2">
              <div
                v-for="g in withJadwal"
                :key="g.publicName"
                class="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-lg"
              >
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center flex-shrink-0">
                  <i class="far fa-calendar text-base" />
                </div>
                <div class="flex-1 min-w-0 flex flex-col gap-0.5 leading-snug">
                  <div class="text-[10px] font-bold text-primary uppercase tracking-wide">{{ g.publicName }}</div>
                  <template v-if="g.jadwals.every((j) => j.tanggal === g.jadwals[0].tanggal)">
                    <div class="font-semibold text-[13px]">{{ formatTanggalLomba(g.jadwals[0].tanggal, "weekday-long") }}</div>
                  </template>
                  <template v-else>
                    <div class="font-semibold text-[13px] flex flex-col gap-0.5">
                      <span v-for="t in Array.from(new Set(g.jadwals.map((j) => j.tanggal)))" :key="t">{{ formatTanggalLomba(t, "weekday-long") }}</span>
                    </div>
                  </template>
                  <div v-if="Array.from(new Set(g.jadwals.map((j) => j.jam).filter((j): j is string => !!j))).length > 0" class="text-[11px] text-[#6B7280]">
                    Pukul {{ Array.from(new Set(g.jadwals.map((j) => j.jam).filter((j): j is string => !!j))).join(", ") }} WIB
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right col: PJ -->
        <div class="info-section">
          <h3 class="text-[13px] font-bold mb-3 text-[#1F2937] flex items-center gap-2">
            <i class="fas fa-user-tie text-primary" /> Penanggung Jawab
            <span v-if="new Set(pjEntries.map((e) => e.katId)).size > 1" class="text-[10px] font-normal text-[#6B7280]">per kategori</span>
          </h3>
          <div v-if="pjGroups.length === 0" class="text-center py-4 text-[#6B7280] text-sm">
            Belum ada PJ yang ditugaskan
          </div>
          <div v-else class="space-y-3 mt-2">
            <div v-for="g in pjGroups" :key="g.publicName" class="border border-[#E5E7EB] rounded-lg overflow-hidden">
              <div
                class="px-3.5 py-2 text-[11px] font-bold text-primary uppercase tracking-wide"
                :style="{
                  background: g.sampleKat?.colorBg || '#F9FAFB',
                  color: g.sampleKat?.colorText || '#92400E',
                  borderBottom: `1px solid ${g.sampleKat?.colorBorder || '#E5E7EB'}`,
                }"
              >
                <i class="fas fa-tag" /> {{ g.publicName }}
                <span class="ml-2 text-[10px] font-normal opacity-80 normal-case">{{ g.pjs.length }} PJ</span>
              </div>
              <div class="divide-y divide-[#F3F4F6]">
                <div v-for="(pj, pjIdx) in g.pjs" :key="pjIdx" class="flex items-center gap-3 p-3 bg-white">
                  <div class="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {{ getInitials(pj.nama) }}
                  </div>
                  <div class="flex-1 min-w-0 flex flex-col gap-0.5 leading-snug">
                    <div class="font-semibold text-[13px] truncate">{{ pj.nama }}</div>
                    <div v-if="pj.kontak" class="text-[11px] text-[#6B7280]">{{ pj.kontak }}</div>
                  </div>
                  <a
                    v-if="pj.kontak"
                    :href="`https://wa.me/${pj.kontak.replace(/\D/g, '')}`"
                    target="_blank"
                    rel="noreferrer"
                    class="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-[#25D366] text-white rounded-lg text-[12px] font-bold hover:bg-[#1ebe57] transition-all no-underline"
                    :title="`Chat WhatsApp ${pj.nama}`"
                  >
                    <i class="fab fa-whatsapp" /> WA
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Peserta Terdaftar — grouped by kategori, enriched with jadwal slot -->
      <div v-if="sectionsEnriched.length > 0" class="info-section mt-3.5">
        <div class="flex items-center justify-between gap-2 mb-3">
          <h3 class="text-[13px] font-bold text-[#1F2937] flex items-center gap-2">
            <i class="fas fa-users text-primary" /> Peserta Terdaftar
          </h3>
          <span class="text-[10px] font-bold bg-[#FCE0E0] text-primary px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
            <i class="fas fa-check-circle text-[9px]" />
            {{ data?.totalPeserta }} disetujui
          </span>
        </div>

        <div class="space-y-2.5">
          <div
            v-for="sec in sectionsEnriched"
            :key="sec.key"
            class="rounded-2xl border-2 overflow-hidden shadow-sm transition-shadow hover:shadow-md"
            :style="{
              background: hexToRgba(sec.colorBg, 0.1),
              borderColor: hexToRgba(sec.colorText, 0.25),
              color: sec.colorText,
            }"
          >
            <!-- Section header: icon + title + count + earliest jadwal -->
            <div class="px-3 pt-2.5 pb-2.5 flex items-start gap-2.5">
              <div
                class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-white/85 shadow-sm"
                :style="{ color: sec.colorText }"
              >
                <i class="fa text-[14px]" :class="sec.icon" />
              </div>
              <div class="flex-1 min-w-0 leading-snug">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h4 class="text-[13px] font-extrabold uppercase tracking-wide">{{ sec.title }}</h4>
                  <span class="text-[10px] font-semibold opacity-75">· {{ sec.rangeLabel }}</span>
                </div>
                <!-- Earliest upcoming jadwal pill -->
                <div v-if="sec.earliestJadwal" class="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 text-[10px] font-bold backdrop-blur-sm shadow-sm" :style="{ color: sec.colorText }">
                    <i class="far fa-calendar text-[10px]" />
                    {{ formatTanggalLomba(sec.earliestJadwal.tanggal, "weekday-long") }}
                    <template v-if="sec.earliestJadwal.jam">
                      <span class="opacity-60">·</span>
                      <i class="far fa-clock text-[10px]" />
                      {{ sec.earliestJadwal.jam }} WIB
                    </template>
                  </span>
                  <span v-if="sec.isMultiKategori" class="text-[9px] font-semibold opacity-70">multi-kategori</span>
                </div>
                <div v-else class="mt-1 text-[10px] opacity-70 italic">
                  <i class="far fa-calendar-plus text-[10px]" /> Jadwal menyusul
                </div>
              </div>
              <span class="text-[11px] font-extrabold bg-white px-2.5 py-1 rounded-full flex-shrink-0 shadow-sm inline-flex items-center gap-1" :style="{ color: sec.colorText }">
                <i class="fas fa-user-group text-[10px]" />
                {{ sec.totalCount }}
              </span>
            </div>

            <!-- Subtle divider between header and peserta list -->
            <div class="mx-3 border-t" :style="{ borderColor: hexToRgba(sec.colorText, 0.15) }" />

            <!-- Peserta grid: adaptive columns to avoid empty cells with low counts -->
            <div
              class="p-2.5 grid gap-2"
              :class="[
                sec.peserta.length === 1 ? 'grid-cols-1' :
                sec.peserta.length <= 3 ? 'grid-cols-2' :
                'grid-cols-2 sm:grid-cols-3',
              ]"
            >
              <div
                v-for="(p, i) in sec.peserta"
                :key="`${sec.key}-${i}`"
                class="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white shadow-sm border transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
                :style="{ borderColor: hexToRgba(sec.colorText, 0.2) }"
                :title="`${p.nama} (${p.umur} th)${p.jadwalJam ? ' · tanding ' + p.jadwalJam + ' WIB' : ''}`"
              >
                <div
                  class="w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-[11px] flex-shrink-0 shadow-sm"
                  :style="{ background: sec.colorText, color: 'white' }"
                >
                  {{ getInitials(p.nama) }}
                </div>
                <div class="flex-1 min-w-0 leading-tight">
                  <div class="text-[13px] font-bold truncate" :style="{ color: sec.colorText }">{{ p.nama }}</div>
                  <div class="text-[10.5px] opacity-80 flex items-center gap-1 mt-0.5">
                    <i :class="['fas', p.jenisKelamin === 'L' ? 'fa-mars' : 'fa-venus']" class="text-[9px]" />
                    <span>{{ p.umur }} th</span>
                    <template v-if="p.jadwalJam">
                      <span class="opacity-50">·</span>
                      <i class="far fa-clock text-[9px]" />
                      <span>{{ p.jadwalJam }}</span>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Subtle hint at the bottom -->
        <p class="text-[10px] text-[#9CA3AF] text-center mt-3 italic">
          <i class="fas fa-info-circle" /> Hanya peserta <strong>disetujui</strong> yang tampil di sini. Pendaftaran & approval dilakukan oleh admin.
        </p>
      </div>

      <!-- Finalis + Juara (when shown) -->
      <div v-if="showFinalis" class="info-section mt-3.5">
        <h3 class="text-[13px] font-bold mb-3 text-[#1F2937] flex items-center gap-2">
          <i class="fas fa-medal text-primary" /> Finalis & Juara
        </h3>
        <div class="space-y-3">
          <div v-for="katId in eligibleKategori" :key="katId">
            <template v-if="finalisByKategori[katId] && finalisByKategori[katId].length > 0">
              <div class="text-[11px] font-bold text-[#6B7280] uppercase tracking-wide mb-1.5">
                {{ displayKategoriName(katId, katMap.get(katId)) }}
              </div>
              <div class="space-y-1.5">
                <div
                  v-for="f in finalisByKategori[katId]"
                  :key="f.pendaftarId"
                  class="flex items-center gap-2 p-2.5 rounded-lg"
                  :class="f.juaraRank === 1 ? 'bg-[#FFFBEB] border border-[#FDE68A]' : f.juaraRank === 2 ? 'bg-[#F9FAFB] border border-[#E5E7EB]' : f.juaraRank === 3 ? 'bg-[#FEF3C7] border border-[#FBBF24]' : 'bg-white border border-[#E5E7EB]'"
                >
                  <span
                    v-if="f.juaraRank"
                    :class="[
                      'text-[14px] font-extrabold w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0',
                      f.juaraRank === 1 ? 'bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-white' : f.juaraRank === 2 ? 'bg-gradient-to-br from-[#C0C0C0] to-[#808080] text-white' : 'bg-gradient-to-br from-[#CD7F32] to-[#8B4513] text-white',
                    ]"
                  >
                    {{ f.juaraRank }}
                  </span>
                  <span v-else class="text-[10px] font-bold text-[#6B7280] bg-[#F3F4F6] w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0">F</span>
                  <div class="flex-1 min-w-0">
                    <div class="text-[13px] font-semibold text-[#1F2937] truncate">{{ f.nama }}</div>
                    <div class="text-[10px] text-[#6B7280]">{{ f.umur }} th · {{ f.jenisKelamin === "L" ? "Laki-laki" : "Perempuan" }}</div>
                  </div>
                  <span v-if="f.juaraRank" class="text-[10px] font-extrabold text-[#15803D]">{{ juaraLabel(katId, f.juaraRank, true) }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- CTA Daftar -->
      <div v-if="l.status === 'aktif' && l.pendaftaranDibuka !== false" id="cta-daftar" class="mt-5">
        <div class="bg-gradient-to-br from-[#FCE0E0] to-white border-2 border-[#E11D1D] rounded-2xl p-4 text-center">
          <div class="text-[14px] font-bold text-[#9D1010] mb-1">Siap ikut lomba ini? 🎉</div>
          <div class="text-[12px] text-[#6B7280] mb-3">Gratis, tanpa login, daftar dalam 1 menit</div>
          <NuxtLink :to="`/lomba/daftar/${l.id}`" class="btn btn-primary btn-block anim-pulse-glow">
            <i class="fas fa-pen-to-square" /> Daftar Sekarang
          </NuxtLink>
        </div>
      </div>
      <div v-else-if="l.pendaftaranDibuka === false" class="notice notice-warn mt-5">
        <i class="fas fa-lock" />
        <div>
          <strong>Pendaftaran sudah ditutup.</strong>
          <p class="m-0 text-[11px] opacity-80">Coba lihat lomba lain yang masih buka.</p>
        </div>
      </div>
    </main>
  </div>
</template>
