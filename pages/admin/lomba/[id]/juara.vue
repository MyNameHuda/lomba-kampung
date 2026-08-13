<script setup lang="ts">
// Admin Juara Picker — Vue 3 port of app/admin/lomba/[id]/juara/juara-client.tsx.
// Per-kategori tabs with Kualifikasi → Semi Final (optional, 3-fase) → Final flow.
import AdminShell from "~/components/AdminShell.vue";
import { useNotify } from "~/composables/useNotify";
import { getInitials } from "~/utils/format";
import { KAT_ICON, DEFAULT_KAT_ICON } from "~/utils/constants";
import html2canvas from "html2canvas";


const route = useRoute();
const lombaId = computed(() => Number(route.params.id));

const { data, refresh } = await useFetch<any>(() => `/api/admin/lomba/${lombaId.value}/juara-page`, { credentials: "include" });

useHead(() => ({ title: data.value?.lomba ? `Juara ${data.value.lomba.nama} — Admin` : "Juara — Admin" }));

const state = ref<any>(data.value);
const busy = ref<number | null>(null);
const busyAction = ref<string | null>(null);
const activeTab = ref<string | null>(data.value?.sections?.[0]?.kategoriId ?? null);

watch(data, (curr) => {
  if (curr) {
    state.value = curr;
    if (!activeTab.value && curr.sections?.[0]) activeTab.value = curr.sections[0].kategoriId;
  }
});

const notify = useNotify();
const isLocked = computed(() => state.value?.lomba?.status === "selesai");

const currentSection = computed(() => {
  if (!state.value) return null;
  return state.value.sections.find((s: any) => s.kategoriId === activeTab.value) || state.value.sections[0];
});

const faseEnabled = computed(() => state.value?.lomba?.faseEnabled);

// Convert hex to rgba for the box backgrounds (light tints) and borders.
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${alpha})`;
}

// Live kual status — derived from current pendaftar state so pill/hint/groups stay in sync
// after local mutations (the API response is captured once at page load, so it goes stale).
const liveKualStatus = computed(() => {
  if (!currentSection.value) return { lolos: 0, gugur: 0, pending: 0, total: 0, readyToTutup: false };
  let lolos = 0, gugur = 0, pending = 0;
  for (const p of currentSection.value.pendaftar) {
    if (p.isFinalist === 1) lolos++;
    else if (p.isFinalist === 0) gugur++;
    else pending++;
  }
  const total = currentSection.value.pendaftar.length;
  return { lolos, gugur, pending, total, readyToTutup: pending === 0 };
});

// Live semi status — only counts finalists (kual Lolos) as eligible; same stale-pill fix.
const liveSemiStatus = computed(() => {
  if (!currentSection.value) return { lolos: 0, gugur: 0, pending: 0, total: 0, readyToTutup: false };
  let lolos = 0, gugur = 0, pending = 0, total = 0;
  for (const p of currentSection.value.pendaftar) {
    if (p.isFinalist !== 1) continue;
    total++;
    if (p.isSemiFinalist === 1) lolos++;
    else if (p.isSemiFinalist === 0) gugur++;
    else pending++;
  }
  return { lolos, gugur, pending, total, readyToTutup: pending === 0 };
});

// Kual participants split into 3 groups: Pending (needs action) → Lolos → Gugur.
// Each group is rendered as its own tinted box in the template.
const kualGroups = computed(() => {
  if (!currentSection.value) return [];
  const p = currentSection.value.pendaftar;
  return [
    { key: "pending", label: "Pending", icon: "fa-hourglass-half", color: "#6B7280", border: hexToRgba("#6B7280", 0.35), bg: hexToRgba("#6B7280", 0.05), headerBg: hexToRgba("#6B7280", 0.12), items: p.filter((x: any) => x.isFinalist === null) },
    { key: "lolos", label: "Lolos", icon: "fa-circle-check", color: "#15803D", border: hexToRgba("#15803D", 0.35), bg: hexToRgba("#15803D", 0.05), headerBg: hexToRgba("#15803D", 0.12), items: p.filter((x: any) => x.isFinalist === 1) },
    { key: "gugur", label: "Gugur", icon: "fa-circle-xmark", color: "#991B1B", border: hexToRgba("#991B1B", 0.35), bg: hexToRgba("#991B1B", 0.05), headerBg: hexToRgba("#991B1B", 0.12), items: p.filter((x: any) => x.isFinalist === 0) },
  ];
});

// Same grouping for semi, based on isSemiFinalist.
const semiGroups = computed(() => {
  if (!currentSection.value) return [];
  const p = currentSection.value.pendaftar.filter((x: any) => x.isFinalist === 1);
  return [
    { key: "pending", label: "Pending", icon: "fa-hourglass-half", color: "#6B7280", border: hexToRgba("#6B7280", 0.35), bg: hexToRgba("#6B7280", 0.05), headerBg: hexToRgba("#6B7280", 0.12), items: p.filter((x: any) => x.isSemiFinalist === null) },
    { key: "lolos", label: "Lolos", icon: "fa-circle-check", color: "#15803D", border: hexToRgba("#15803D", 0.35), bg: hexToRgba("#15803D", 0.05), headerBg: hexToRgba("#15803D", 0.12), items: p.filter((x: any) => x.isSemiFinalist === 1) },
    { key: "gugur", label: "Gugur", icon: "fa-circle-xmark", color: "#991B1B", border: hexToRgba("#991B1B", 0.35), bg: hexToRgba("#991B1B", 0.05), headerBg: hexToRgba("#991B1B", 0.12), items: p.filter((x: any) => x.isSemiFinalist === 0) },
  ];
});

// Final phase grouping: Eligible (passed the gate) + Gugur (eliminated in previous phase).
// 3-fase: gate = isSemiFinalist === 1; 2-fase: gate = isFinalist === 1.
// Gugur in gate gets NO rank buttons — only a "Gugur" badge, same pattern as kual/semi groups.
const finalGroups = computed(() => {
  if (!currentSection.value) return [];
  const is3Fase = !!faseEnabled.value;
  const gateKey = is3Fase ? "isSemiFinalist" : "isFinalist";
  const gugurLabel = is3Fase ? "Gugur di Semi Final" : "Gugur di Kualifikasi";
  const all = currentSection.value.pendaftar;
  return [
    { key: "eligible", label: "Kandidat Juara", icon: "fa-trophy", color: "#B45309", border: hexToRgba("#B45309", 0.35), bg: hexToRgba("#B45309", 0.05), headerBg: hexToRgba("#B45309", 0.12), items: all.filter((x: any) => x[gateKey] === 1) },
    { key: "gugur", label: gugurLabel, icon: "fa-circle-xmark", color: "#991B1B", border: hexToRgba("#991B1B", 0.35), bg: hexToRgba("#991B1B", 0.05), headerBg: hexToRgba("#991B1B", 0.12), items: all.filter((x: any) => x[gateKey] === 0) },
  ];
});

// Phase detection
function getPhase(sec: any): "kual" | "semi" | "final" {
  if (faseEnabled.value) {
    if (sec.semiTutupAt) return "final";
    if (sec.tutupAt) return "semi";
    return "kual";
  }
  return sec.tutupAt ? "final" : "kual";
}
const PHASE_LABEL: any = { kual: "Kualifikasi", semi: "Semi Final", final: "Final" };
const PHASE_COLOR: any = {
  kual: { bg: "#FEF3C7", text: "#92400E" },
  semi: { bg: "#DBEAFE", text: "#1E40AF" },
  final: { bg: "#D1FAE5", text: "#065F46" },
};

// =================== Set finalist ===================
async function setFinalistStatus(pid: number, status: 0 | 1 | null) {
  busy.value = pid;
  // Optimistic
  const before = JSON.parse(JSON.stringify(state.value));
  state.value = {
    ...state.value,
    sections: state.value.sections.map((sec: any) => ({
      ...sec,
      pendaftar: sec.pendaftar.map((p: any) =>
        p.id === pid
          ? { ...p, isFinalist: status, isSemiFinalist: status !== 1 ? null : p.isSemiFinalist, juaraRank: status !== 1 ? null : p.juaraRank }
          : p
      ),
    })),
  };
  try {
    await $fetch(`/api/admin/lomba/${lombaId.value}/pendaftar/${pid}/finalist`, {
      method: "POST",
      body: { status },
      credentials: "include",
    });
  } catch (e: any) {
    state.value = before;
    notify.error(e?.data?.statusMessage || "Gagal set finalist");
  } finally {
    busy.value = null;
  }
}

// =================== Set semi-finalist ===================
async function setSemiFinalistStatus(pid: number, status: 0 | 1 | null) {
  busy.value = pid;
  const before = JSON.parse(JSON.stringify(state.value));
  state.value = {
    ...state.value,
    sections: state.value.sections.map((sec: any) => ({
      ...sec,
      pendaftar: sec.pendaftar.map((p: any) =>
        p.id === pid
          ? { ...p, isSemiFinalist: status, juaraRank: status !== 1 ? null : p.juaraRank }
          : p
      ),
    })),
  };
  try {
    await $fetch(`/api/admin/lomba/${lombaId.value}/pendaftar/${pid}/semi-finalist`, {
      method: "POST",
      body: { status },
      credentials: "include",
    });
  } catch (e: any) {
    state.value = before;
    notify.error(e?.data?.statusMessage || "Gagal set semi-finalist");
  } finally {
    busy.value = null;
  }
}

// =================== Set Juara 1/2/3 ===================
async function setRank(pid: number, rank: 1 | 2 | 3) {
  busy.value = pid;
  state.value = {
    ...state.value,
    sections: state.value.sections.map((sec: any) => ({
      ...sec,
      pendaftar: sec.pendaftar.map((p: any) => {
        if (p.id === pid) return { ...p, juaraRank: rank };
        if (p.juaraRank === rank) return { ...p, juaraRank: null };
        return p;
      }),
    })),
  };
  try {
    await $fetch(`/api/admin/lomba/${lombaId.value}/juara`, { method: "POST", body: { pendaftarId: pid, rank }, credentials: "include" });
  } catch (e: any) {
    await refresh();
    notify.error(e?.data?.statusMessage || "Gagal set Juara");
  } finally {
    busy.value = null;
  }
}

async function clearRank(pid: number) {
  busy.value = pid;
  state.value = {
    ...state.value,
    sections: state.value.sections.map((sec: any) => ({
      ...sec,
      pendaftar: sec.pendaftar.map((p: any) => p.id === pid ? { ...p, juaraRank: null } : p),
    })),
  };
  try {
    await $fetch(`/api/admin/lomba/${lombaId.value}/juara`, { method: "DELETE", body: { pendaftarId: pid }, credentials: "include" });
  } catch {
    await refresh();
    notify.error("Gagal clear Juara");
  } finally {
    busy.value = null;
  }
}

// =================== Tutup / Buka fase ===================
async function tutupKual(kid: string) {
  const ok = await notify.confirm({
    title: "Tutup Kualifikasi",
    message: faseEnabled.value
      ? "Tutup kualifikasi? Setelah tutup, masuk ke fase Semi Final."
      : "Tutup kualifikasi? Admin tidak bisa Loloskan/Gugur lagi (kecuali dibuka).",
    confirmText: "Tutup", variant: "danger",
  });
  if (!ok) return;
  busyAction.value = `tutup-kual-${kid}`;
  try {
    await $fetch(`/api/admin/lomba/${lombaId.value}/kategori/${kid}/tutup-kualifikasi`, { method: "POST", credentials: "include" });
    state.value = {
      ...state.value,
      sections: state.value.sections.map((s: any) => s.kategoriId === kid ? { ...s, tutupAt: Date.now() } : s),
    };
    notify.success(faseEnabled.value ? "Kualifikasi ditutup! Sekarang fase Semi Final." : "Kualifikasi ditutup! Sekarang bisa pilih Juara.");
  } catch (e: any) {
    notify.error(e?.data?.statusMessage || "Gagal Tutup");
  } finally {
    busyAction.value = null;
  }
}

async function bukaKual(kid: string) {
  const ok = await notify.confirm({ title: "Buka Kualifikasi", message: "Buka kembali? Juara yang sudah dipilih akan di-block.", confirmText: "Buka", variant: "danger" });
  if (!ok) return;
  busyAction.value = `buka-kual-${kid}`;
  try {
    await $fetch(`/api/admin/lomba/${lombaId.value}/kategori/${kid}/buka-kualifikasi`, { method: "POST", credentials: "include" });
    state.value = { ...state.value, sections: state.value.sections.map((s: any) => s.kategoriId === kid ? { ...s, tutupAt: null } : s) };
    notify.success("Kualifikasi dibuka kembali!");
  } catch (e: any) {
    notify.error(e?.data?.statusMessage || "Gagal Buka");
  } finally {
    busyAction.value = null;
  }
}

async function tutupSemi(kid: string) {
  const ok = await notify.confirm({ title: "Tutup Semi Final", message: "Tutup Semi Final? Juara 1/2/3 dipilih dari semi-finalis.", confirmText: "Tutup", variant: "danger" });
  if (!ok) return;
  busyAction.value = `tutup-semi-${kid}`;
  try {
    await $fetch(`/api/admin/lomba/${lombaId.value}/kategori/${kid}/tutup-semi-final`, { method: "POST", credentials: "include" });
    state.value = { ...state.value, sections: state.value.sections.map((s: any) => s.kategoriId === kid ? { ...s, semiTutupAt: Date.now() } : s) };
    notify.success("Semi Final ditutup! Sekarang bisa pilih Juara.");
  } catch (e: any) {
    notify.error(e?.data?.statusMessage || "Gagal Tutup");
  } finally {
    busyAction.value = null;
  }
}

async function bukaSemi(kid: string) {
  const ok = await notify.confirm({ title: "Buka Semi Final", message: "Buka kembali? Juara yang sudah dipilih akan di-block.", confirmText: "Buka", variant: "danger" });
  if (!ok) return;
  busyAction.value = `buka-semi-${kid}`;
  try {
    await $fetch(`/api/admin/lomba/${lombaId.value}/kategori/${kid}/buka-semi-final`, { method: "POST", credentials: "include" });
    state.value = { ...state.value, sections: state.value.sections.map((s: any) => s.kategoriId === kid ? { ...s, semiTutupAt: null } : s) };
    notify.success("Semi Final dibuka kembali!");
  } finally {
    busyAction.value = null;
  }
}

// =================== Cetak / Download Gambar ===================
// Render hidden printable element with current section's peserta, then capture
// with html2canvas and trigger a PNG download. No new page navigation.
const isCetakBusy = ref(false);
const hiddenPrint = ref<HTMLElement | null>(null);
const hiddenPrintData = ref<{
  lombaNama: string;
  lombaEmoji: string;
  kategoriNama: string;
  ageRange: string;
  peserta: any[];
  tanggalCetak: string;
} | null>(null);

const tanggalCetakStr = computed(() =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date())
);

async function cetakSekarang() {
  if (!currentSection.value || !lombaId.value) return;
  isCetakBusy.value = true;
  try {
    hiddenPrintData.value = {
      lombaNama: state.value?.lomba?.nama || "",
      lombaEmoji: state.value?.lomba?.emoji || "",
      kategoriNama: currentSection.value.kategoriNama,
      ageRange: currentSection.value.ageRange || "",
      peserta: [...(currentSection.value.pendaftar || [])].sort(
        (a: any, b: any) => a.umur - b.umur || a.nomor.localeCompare(b.nomor)
      ),
      tanggalCetak: tanggalCetakStr.value,
    };
    // Wait a tick for Vue to render the hidden element before capturing.
    await nextTick();
    if (!hiddenPrint.value) throw new Error("Print area not ready");
    const canvas = await html2canvas(hiddenPrint.value, {
      backgroundColor: "#FFFFFF",
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Gagal render canvas");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeNama = (hiddenPrintData.value.lombaNama || "lomba").replace(/[^a-zA-Z0-9-_]+/g, "-");
    const safeKat = (hiddenPrintData.value.kategoriNama || "kategori").replace(/[^a-zA-Z0-9-_]+/g, "-");
    a.href = url;
    a.download = `peserta-${safeNama}-${safeKat}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notify.success(`Gambar ${safeKat} berhasil di-download`);
  } catch (e: any) {
    notify.error(e?.message || "Gagal download gambar");
  } finally {
    hiddenPrintData.value = null;
    isCetakBusy.value = false;
  }
}

// =================== Selesaikan Lomba ===================
async function selesaikanLomba() {
  const ok = await notify.confirm({
    title: "Selesaikan Lomba",
    message: "Yakin selesaikan lomba ini? Juara 1/2/3 diumumkan ke publik. Tidak bisa di-undo.",
    confirmText: "Selesaikan", variant: "danger",
  });
  if (!ok) return;
  busyAction.value = "selesai";
  try {
    await $fetch(`/api/admin/lomba/${lombaId.value}/selesai`, { method: "POST", credentials: "include" });
    state.value = { ...state.value, lomba: { ...state.value.lomba, status: "selesai" } };
    notify.success("Lomba selesai! Juara tampil di publik.");
  } catch (e: any) {
    notify.error(e?.data?.statusMessage || "Gagal selesaikan lomba");
  } finally {
    busyAction.value = null;
  }
}
</script>

<template>
  <AdminShell :title="state?.lomba?.nama || 'Juara'" breadcrumb="Juara" active-nav="/admin/lomba">
    <template #actions>
      <span v-if="state?.lomba" class="phase-badge" :class="`status-${state.lomba.status}`">
        <i class="fas fa-circle" style="font-size: 6px" /> {{ state.lomba.status }}
      </span>
      <span v-if="faseEnabled" class="text-[11px] font-extrabold uppercase px-2.5 py-1 rounded bg-gradient-to-r from-[#DBEAFE] via-[#FEF3C7] to-[#F3E8FF] text-[#581C87] border border-[#9333EA]/30">
        <i class="fas fa-sitemap" /> 3 Fase
      </span>
    </template>

    <div v-if="!state || !state.sections || state.sections.length === 0" class="card p-8 text-center">
      <i class="fas fa-list text-4xl text-[#D1D5DB] mb-2" />
      <strong class="block text-[#1F2937] text-base">Lomba belum punya kategori</strong>
      <p class="text-sm text-[#6B7280] mt-1">Tambah kategori di lomba ini dulu untuk mulai pilih Juara.</p>
      <NuxtLink to="/admin/lomba" class="btn btn-secondary btn-sm mt-4 inline-flex" style="width: auto">
        <i class="fas fa-arrow-left" /> Kembali
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Tabs -->
      <div class="flex gap-2 mb-4 -mx-4 px-4 overflow-x-auto pb-1">
        <button
          v-for="sec in state.sections"
          :key="sec.kategoriId"
          type="button"
          class="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold border-2 transition-colors"
          :class="activeTab === sec.kategoriId ? 'bg-primary border-primary text-white' : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:border-primary hover:text-primary'"
          @click="activeTab = sec.kategoriId"
        >
          <i :class="['fas', sec.kategoriIcon]" />
          {{ sec.kategoriNama }}
          <span :class="['text-[10px] font-semibold px-1.5 py-0.5 rounded-full', activeTab === sec.kategoriId ? 'bg-white/25' : 'bg-[#F3F4F6]']">
            {{ sec.pendaftar.length }}
          </span>
        </button>
      </div>

      <template v-if="currentSection">
        <!-- Section header -->
        <div class="juara-section-header">
          <div class="juara-section-icon" :style="{ background: currentSection.kategoriColorBg, color: currentSection.kategoriColorText }">
            <i :class="['fas', currentSection.kategoriIcon]" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-[15px] text-[#1F2937] leading-tight">{{ currentSection.kategoriNama }}</div>
            <div class="text-[11px] text-[#6B7280]">{{ currentSection.ageRange }}</div>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="juara-status-pill" :class="liveKualStatus.readyToTutup ? 'ready' : 'pending'">
              Kual: {{ liveKualStatus.lolos }}/ {{ liveKualStatus.total }}
            </span>
            <template v-if="faseEnabled">
              <span class="juara-status-pill" :class="liveSemiStatus.readyToTutup ? 'ready' : 'pending'">
                Semi: {{ liveSemiStatus.lolos }}/ {{ liveSemiStatus.total }}
              </span>
            </template>
            <button
              type="button"
              class="juara-cetak-btn"
              :disabled="isCetakBusy"
              :title="`Download gambar daftar peserta ${currentSection.kategoriNama}`"
              :aria-label="`Download gambar daftar peserta kategori ${currentSection.kategoriNama}`"
              @click="cetakSekarang()"
            >
              <i :class="['fas', isCetakBusy ? 'fa-spinner fa-spin' : 'fa-image']" />
              <span class="juara-cetak-text">{{ isCetakBusy ? "Render..." : "Cetak" }}</span>
            </button>
          </div>
        </div>

        <div class="juara-section">
          <!-- Phase content -->
          <template v-if="getPhase(currentSection) === 'kual'">
            <div class="bg-[#FFFBEB] border-b border-[#FEF3C7] p-3 flex items-center justify-between flex-wrap gap-2">
              <div class="text-[12px] text-[#92400E]">
                <i class="fas fa-hourglass-half" /> <strong>Kualifikasi:</strong> Tandai Lolos/Gugur setiap peserta. Tutup setelah semua di-decide.
              </div>
              <div v-if="!isLocked" class="flex items-center gap-2">
                <span v-if="liveKualStatus.pending > 0" class="text-[11px] text-[#92400E] italic">
                  <i class="fas fa-circle-info" /> {{ liveKualStatus.pending }} peserta pending
                </span>
                <button class="btn btn-sm" style="width: auto; background: #92400E; color: white" :disabled="!liveKualStatus.readyToTutup || busyAction === 'tutup-kual-' + currentSection.kategoriId" @click="tutupKual(currentSection.kategoriId)">
                  <i class="fas fa-lock" /> Tutup Kualifikasi
                </button>
              </div>
            </div>
            <!-- Grouped list: Pending → Lolos → Gugur (kual). Each group is its own tinted box. -->
            <div v-for="group in kualGroups" :key="group.key">
              <div v-if="group.items.length > 0" class="rounded-2xl border-2 mt-3 overflow-hidden" :style="{ borderColor: group.border, backgroundColor: group.bg }">
                <div class="flex items-center justify-between gap-2 px-3.5 py-2 border-b" :style="{ borderColor: group.border, backgroundColor: group.headerBg }">
                  <div class="flex items-center gap-2">
                    <i :class="['fas', group.icon]" :style="{ color: group.color, fontSize: '12px' }" />
                    <span class="text-[12px] font-extrabold uppercase tracking-wider" :style="{ color: group.color }">
                      {{ group.label }}
                    </span>
                  </div>
                  <span class="text-[11px] font-bold px-2 py-0.5 rounded-full" :style="{ color: group.color, backgroundColor: hexToRgba(group.color, 0.15) }">
                    {{ group.items.length }} peserta
                  </span>
                </div>
                <div class="p-2 space-y-1.5">
                  <div v-for="p in group.items" :key="p.id" class="juara-card">
                    <div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-[12px] flex-shrink-0">
                      {{ getInitials(p.nama) }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="juara-nama">{{ p.nama }}</div>
                      <div class="juara-meta">{{ p.umur }} th · {{ p.jenisKelamin === "L" ? "Laki-laki" : "Perempuan" }}</div>
                    </div>
                    <div class="juara-actions">
                      <button v-if="p.isFinalist !== 1" class="juara-btn" style="background: #DCFCE7; color: #15803D" :disabled="isLocked || busy === p.id" @click="setFinalistStatus(p.id, 1)">
                        <i class="fas fa-check" /> <span class="btn-icon-text">Lolos</span>
                      </button>
                      <button v-if="p.isFinalist !== 0" class="juara-btn" style="background: #FEE2E2; color: #991B1B" :disabled="isLocked || busy === p.id" @click="setFinalistStatus(p.id, 0)">
                        <i class="fas fa-xmark" /> <span class="btn-icon-text">Gugur</span>
                      </button>
                      <button v-if="p.isFinalist !== null" class="juara-btn" style="background: #F3F4F6; color: #6B7280" :disabled="isLocked || busy === p.id" @click="setFinalistStatus(p.id, null)">
                        <i class="fas fa-rotate-left" />
                      </button>
                      <span v-if="p.isFinalist === 1" class="juara-badge rank-1 filled">Lolos</span>
                      <span v-else-if="p.isFinalist === 0" class="juara-badge rank-2 filled">Gugur</span>
                      <span v-else class="juara-badge rank-2 empty">Pending</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="getPhase(currentSection) === 'semi' && faseEnabled">
            <div class="bg-[#EFF6FF] border-b border-[#DBEAFE] p-3 flex items-center justify-between flex-wrap gap-2">
              <div class="text-[12px] text-[#1E40AF]">
                <i class="fas fa-sitemap" /> <strong>Semi Final:</strong> Loloskan/Gugur finalis. Yang Gugur di Kualifikasi tidak muncul.
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <span v-if="liveSemiStatus.pending > 0" class="text-[11px] text-[#1E40AF] italic">
                  <i class="fas fa-circle-info" /> {{ liveSemiStatus.pending }} semi-finalis pending
                </span>
                <button class="btn btn-sm btn-secondary" style="width: auto" :disabled="busyAction === 'buka-kual-' + currentSection.kategoriId" @click="bukaKual(currentSection.kategoriId)">
                  <i class="fas fa-arrow-left" /> Buka Kual
                </button>
                <button class="btn btn-sm" style="width: auto; background: #1E40AF; color: white" :disabled="!liveSemiStatus.readyToTutup || busyAction === 'tutup-semi-' + currentSection.kategoriId" @click="tutupSemi(currentSection.kategoriId)">
                  <i class="fas fa-lock" /> Tutup Semi Final
                </button>
              </div>
            </div>
            <!-- Grouped list: Pending → Lolos → Gugur (semi). Each group is its own tinted box. -->
            <div v-for="group in semiGroups" :key="group.key">
              <div v-if="group.items.length > 0" class="rounded-2xl border-2 mt-3 overflow-hidden" :style="{ borderColor: group.border, backgroundColor: group.bg }">
                <div class="flex items-center justify-between gap-2 px-3.5 py-2 border-b" :style="{ borderColor: group.border, backgroundColor: group.headerBg }">
                  <div class="flex items-center gap-2">
                    <i :class="['fas', group.icon]" :style="{ color: group.color, fontSize: '12px' }" />
                    <span class="text-[12px] font-extrabold uppercase tracking-wider" :style="{ color: group.color }">
                      {{ group.label }}
                    </span>
                  </div>
                  <span class="text-[11px] font-bold px-2 py-0.5 rounded-full" :style="{ color: group.color, backgroundColor: hexToRgba(group.color, 0.15) }">
                    {{ group.items.length }} peserta
                  </span>
                </div>
                <div class="p-2 space-y-1.5">
                  <div v-for="p in group.items" :key="p.id" class="juara-card">
                    <div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-[12px] flex-shrink-0">
                      {{ getInitials(p.nama) }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="juara-nama">{{ p.nama }}</div>
                      <div class="juara-meta">{{ p.umur }} th · {{ p.jenisKelamin === "L" ? "Laki-laki" : "Perempuan" }}</div>
                    </div>
                    <div class="juara-actions">
                      <button v-if="p.isSemiFinalist !== 1" class="juara-btn" style="background: #DCFCE7; color: #15803D" :disabled="isLocked || busy === p.id" @click="setSemiFinalistStatus(p.id, 1)">
                        <i class="fas fa-check" /> <span class="btn-icon-text">Lolos</span>
                      </button>
                      <button v-if="p.isSemiFinalist !== 0" class="juara-btn" style="background: #FEE2E2; color: #991B1B" :disabled="isLocked || busy === p.id" @click="setSemiFinalistStatus(p.id, 0)">
                        <i class="fas fa-xmark" /> <span class="btn-icon-text">Gugur</span>
                      </button>
                      <button v-if="p.isSemiFinalist !== null" class="juara-btn" style="background: #F3F4F6; color: #6B7280" :disabled="isLocked || busy === p.id" @click="setSemiFinalistStatus(p.id, null)">
                        <i class="fas fa-rotate-left" />
                      </button>
                      <span v-if="p.isSemiFinalist === 1" class="juara-badge rank-1 filled">Lolos</span>
                      <span v-else-if="p.isSemiFinalist === 0" class="juara-badge rank-2 filled">Gugur</span>
                      <span v-else class="juara-badge rank-2 empty">Pending</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="bg-[#F0FDF4] border-b border-[#D1FAE5] p-3 flex items-center justify-between flex-wrap gap-2">
              <div class="text-[12px] text-[#065F46]">
                <i class="fas fa-trophy" /> <strong>Final:</strong> Pilih Juara 1/2/3 dari finalis (atau semi-finalis untuk 3-fase).
              </div>
              <button v-if="faseEnabled" class="btn btn-sm btn-secondary" style="width: auto" :disabled="busyAction === 'buka-semi-' + currentSection.kategoriId" @click="bukaSemi(currentSection.kategoriId)">
                <i class="fas fa-arrow-left" /> Buka Semi
              </button>
            </div>
            <!-- Final phase: 2 groups — Kandidat Juara (with rank buttons) + Gugur (no buttons, just badge). -->
            <div v-for="group in finalGroups" :key="group.key">
              <div v-if="group.items.length > 0" class="rounded-2xl border-2 mt-3 overflow-hidden" :style="{ borderColor: group.border, backgroundColor: group.bg }">
                <div class="flex items-center justify-between gap-2 px-3.5 py-2 border-b" :style="{ borderColor: group.border, backgroundColor: group.headerBg }">
                  <div class="flex items-center gap-2">
                    <i :class="['fas', group.icon]" :style="{ color: group.color, fontSize: '12px' }" />
                    <span class="text-[12px] font-extrabold uppercase tracking-wider" :style="{ color: group.color }">
                      {{ group.label }}
                    </span>
                  </div>
                  <span class="text-[11px] font-bold px-2 py-0.5 rounded-full" :style="{ color: group.color, backgroundColor: hexToRgba(group.color, 0.15) }">
                    {{ group.items.length }} peserta
                  </span>
                </div>
                <div class="p-2 space-y-1.5">
                  <template v-for="p in group.items" :key="p.id">
                    <!-- Eligible: full row with rank buttons -->
                    <div v-if="group.key === 'eligible'" :class="['juara-card', p.juaraRank ? 'is-juara-' + p.juaraRank : '']">
                      <span v-if="p.juaraRank" :class="['juara-medal', 'medal-' + p.juaraRank]">
                        <template v-if="p.juaraRank === 1">🥇</template>
                        <template v-else-if="p.juaraRank === 2">🥈</template>
                        <template v-else>🥉</template>
                      </span>
                      <div v-else class="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-[12px] flex-shrink-0">
                        {{ getInitials(p.nama) }}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="juara-nama">{{ p.nama }}</div>
                        <div class="juara-meta">{{ p.umur }} th · {{ p.jenisKelamin === "L" ? "Laki-laki" : "Perempuan" }}</div>
                      </div>
                      <div class="juara-actions">
                        <button :class="['juara-rank-btn rank-1', { active: p.juaraRank === 1 }]" :disabled="isLocked || busy === p.id" title="Juara 1" @click="setRank(p.id, 1)">
                          <span class="rank-icon">🥇</span>
                          <span class="rank-num">1</span>
                        </button>
                        <button :class="['juara-rank-btn rank-2', { active: p.juaraRank === 2 }]" :disabled="isLocked || busy === p.id" title="Juara 2" @click="setRank(p.id, 2)">
                          <span class="rank-icon">🥈</span>
                          <span class="rank-num">2</span>
                        </button>
                        <button :class="['juara-rank-btn rank-3', { active: p.juaraRank === 3 }]" :disabled="isLocked || busy === p.id" title="Juara 3" @click="setRank(p.id, 3)">
                          <span class="rank-icon">🥉</span>
                          <span class="rank-num">3</span>
                        </button>
                        <button v-if="p.juaraRank" class="juara-clear-btn" :disabled="isLocked || busy === p.id" title="Hapus juara" @click="clearRank(p.id)">
                          <i class="fas fa-xmark" />
                        </button>
                      </div>
                    </div>
                    <!-- Gugur: no rank buttons, just badge + name -->
                    <div v-else class="juara-card">
                      <div class="w-9 h-9 rounded-full bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center font-bold text-[12px] flex-shrink-0">
                        {{ getInitials(p.nama) }}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="juara-nama">{{ p.nama }}</div>
                        <div class="juara-meta">{{ p.umur }} th · {{ p.jenisKelamin === "L" ? "Laki-laki" : "Perempuan" }}</div>
                      </div>
                      <div class="juara-actions" style="width: auto">
                        <span class="juara-badge rank-2 filled">Gugur</span>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>

      <!-- Selesaikan Lomba -->
      <div v-if="state && !isLocked" class="mt-5 card p-4 flex items-center justify-between flex-wrap gap-3">
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-bold text-[#1F2937]">Selesaikan Lomba</h3>
          <p class="text-[12px] text-[#6B7280] mt-0.5">Juara 1+2 harus ada di semua kategori eligible. Status lomba di-pin ke "Selesai" + tampil di publik.</p>
        </div>
        <button class="btn btn-primary" style="width: auto" :disabled="!state.readiness?.allReady || busyAction === 'selesai'" @click="selesaikanLomba">
          <i class="fas fa-flag-checkered" /> Selesaikan Lomba
        </button>
      </div>
    </template>
  </AdminShell>

  <!-- Hidden printable area — only rendered while user clicks "Cetak" to capture as PNG.
       Lives off-screen (left: -10000px) so it doesn't affect the page layout. -->
  <div
    v-if="hiddenPrintData"
    aria-hidden="true"
    style="position: fixed; left: -10000px; top: 0; pointer-events: none;"
  >
    <div ref="hiddenPrint" class="juara-print-card">
      <div class="juara-print-header">
        <span class="juara-print-emoji">{{ hiddenPrintData.lombaEmoji }}</span>
        <h1 class="juara-print-title">{{ hiddenPrintData.lombaNama }}</h1>
      </div>
      <div class="juara-print-body">
        <p class="juara-print-kategori">
          <strong>Kategori:</strong> {{ hiddenPrintData.kategoriNama }}<span v-if="hiddenPrintData.ageRange"> · {{ hiddenPrintData.ageRange }}</span>
        </p>
        <p class="juara-print-meta">
          {{ hiddenPrintData.peserta.length }} peserta · Dicetak {{ hiddenPrintData.tanggalCetak }}
        </p>
        <table class="juara-print-table">
          <thead>
            <tr>
              <th class="juara-print-th-no">No</th>
              <th class="juara-print-th-nama">Nama Peserta</th>
              <th class="juara-print-th-umur">Umur</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="hiddenPrintData.peserta.length === 0">
              <td colspan="3" class="juara-print-empty">Belum ada peserta di kategori ini.</td>
            </tr>
            <tr v-for="(p, i) in hiddenPrintData.peserta" :key="p.id">
              <td class="juara-print-td-no">{{ i + 1 }}</td>
              <td class="juara-print-td-nama">{{ p.nama }}</td>
              <td class="juara-print-td-umur">{{ p.umur }} th</td>
            </tr>
          </tbody>
        </table>
        <p class="juara-print-footer">Daftar Peserta · {{ hiddenPrintData.lombaNama }} · {{ hiddenPrintData.kategoriNama }}</p>
      </div>
    </div>
  </div>
</template>

<style>
/* Off-screen printable card. Inline-styled via class names so html2canvas can
   resolve the computed styles. Background and width match the cetak spec. */
.juara-print-card {
  background: #FFFFFF;
  border: 1px solid #F3F4F6;
  border-radius: 8px;
  overflow: hidden;
  width: 720px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  color: #1F2937;
}
.juara-print-header {
  background: linear-gradient(135deg, #FEF2F2 0%, #FDF5F5 100%);
  border-left: 4px solid #E11D1D;
  padding: 18px 24px;
  display: flex; align-items: center; gap: 12px;
}
.juara-print-emoji { font-size: 28px; line-height: 1; }
.juara-print-title { font-size: 26px; font-weight: 800; color: #E11D1D; line-height: 1.1; margin: 0; }
.juara-print-body { padding: 20px 24px 24px; }
.juara-print-kategori { font-size: 14px; color: #1F2937; margin: 0 0 4px; font-weight: 600; }
.juara-print-meta { font-size: 12px; color: #6B7280; margin: 0 0 18px; }
.juara-print-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 4px; }
.juara-print-table th, .juara-print-table td { padding: 11px 14px; text-align: left; border-bottom: 1px solid #E5E7EB; vertical-align: middle; }
.juara-print-table thead th { background: #E11D1D; color: #FFFFFF; font-weight: 700; font-size: 13px; border-bottom: none; }
.juara-print-table tbody tr:last-child td { border-bottom: none; }
.juara-print-table tbody tr:nth-child(even) td { background: #FAFAFA; }
.juara-print-th-no, .juara-print-td-no { width: 60px; text-align: center; font-variant-numeric: tabular-nums; }
.juara-print-th-umur, .juara-print-td-umur { width: 80px; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.juara-print-td-nama { font-weight: 600; color: #1F2937; font-size: 14px; word-break: break-word; }
.juara-print-empty { text-align: center; color: #9CA3AF; padding: 28px 14px; font-size: 13px; }
.juara-print-footer { margin: 18px 0 0; padding-top: 14px; border-top: 1px dashed #E5E7EB; text-align: center; font-size: 11px; color: #9CA3AF; }
</style>
