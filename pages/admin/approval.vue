<script setup lang="ts">
// Admin approval queue — Vue 3 port of app/admin/approval/approval-client.tsx.
import AdminShell from "~/components/AdminShell.vue";
import { useNotify } from "~/composables/useNotify";
import { getInitials, timeAgo, shortNomor } from "~/utils/format";
import type { LombaSlim, KategoriSlim } from "~/utils/types";

useHead({ title: "Approval Pendaftar — Admin" });

interface PendaftarRow {
  id: number; nomor: string; nama: string;
  status: "pending" | "disetujui" | "ditolak";
  lombaId: number; lombaNama: string; lombaEmoji: string;
  kategoriNama: string; kategoriColor: string;
  jenisKelamin: "L" | "P"; umur: number;
  createdAt: number;
}

const { data, refresh } = await useFetch<{ items: PendaftarRow[]; kats: KategoriSlim[]; lomba: LombaSlim[] }>(
  "/api/admin/approval-list",
  { credentials: "include" }
);

const items = ref<PendaftarRow[]>(data.value?.items ?? []);
const katMap = computed(() => new Map((data.value?.kats ?? []).map((k) => [k.id, k])));
const lombaMap = computed(() => new Map((data.value?.lomba ?? []).map((l) => [l.id, l])));

// === UI state ===
const search = ref("");
const filterLomba = ref<number | "all">("all");
const selected = ref<Set<number>>(new Set());

const visibleItems = computed(() => {
  const q = search.value.trim().toLowerCase();
  return items.value.filter((p) => {
    if (filterLomba.value !== "all" && p.lombaId !== filterLomba.value) return false;
    if (q && !p.nama.toLowerCase().includes(q) && !p.nomor.toLowerCase().includes(q)) return false;
    return true;
  });
});

const allSelected = computed(() => visibleItems.value.length > 0 && visibleItems.value.every((p) => selected.value.has(p.id)));
const someSelected = computed(() => visibleItems.value.some((p) => selected.value.has(p.id)) && !allSelected.value);

// Lomba filter pills (Semua + each lomba with count)
const lombaFilterOpts = computed(() => {
  const opts: Array<{ key: number | "all"; label: string; count: number; emoji?: string }> = [
    { key: "all", label: "Semua", count: items.value.length },
  ];
  for (const l of lombaMap.value.values()) {
    opts.push({
      key: l.id,
      label: l.nama,
      count: items.value.filter((p) => p.lombaId === l.id).length,
      emoji: l.emoji,
    });
  }
  return opts;
});

const uniqueLombaCount = computed(() => new Set(items.value.map((p) => p.lombaId)).size);
const filterActive = computed(() => search.value !== "" || filterLomba.value !== "all");

function toggleAll() {
  if (allSelected.value) {
    for (const p of visibleItems.value) selected.value.delete(p.id);
  } else {
    for (const p of visibleItems.value) selected.value.add(p.id);
  }
  selected.value = new Set(selected.value);
}
function toggleOne(id: number) {
  if (selected.value.has(id)) selected.value.delete(id);
  else selected.value.add(id);
  selected.value = new Set(selected.value);
}
function selectOnly(id: number) {
  selected.value = new Set([id]);
}

function resetFilters() {
  search.value = "";
  filterLomba.value = "all";
}

const notify = useNotify();
const busy = ref(false);

async function bulkAction(action: "approve" | "reject" | "delete") {
  if (selected.value.size === 0) {
    notify.warning("Pilih minimal 1 pendaftar");
    return;
  }
  busy.value = true;
  try {
    await $fetch("/api/admin/pendaftar/bulk", {
      method: "POST",
      body: { action, ids: Array.from(selected.value) },
      credentials: "include",
    });
    notify.success(`${selected.value.size} pendaftar di-${action === "approve" ? "setujui" : action === "reject" ? "tolak" : "hapus"}`);
    selected.value = new Set();
    await refresh();
    items.value = data.value?.items ?? [];
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } };
    notify.error(err.data?.statusMessage || "Gagal");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AdminShell title="Approval Pendaftar" breadcrumb="Approval" active-nav="/admin/approval">
    <!-- Welcome row -->
    <div class="mb-4 flex items-baseline justify-between flex-wrap gap-2">
      <div>
        <h2 class="text-[18px] font-bold text-[#1F2937] leading-tight">Review Pendaftar</h2>
        <p class="text-[12px] text-[#6B7280] mt-0.5">Setujui atau tolak pendaftar. Data akan masuk ke peserta setelah disetujui.</p>
      </div>
    </div>

    <!-- Stats summary -->
    <div v-if="items.length > 0" class="card p-4 mb-4">
      <div class="flex items-center gap-5 flex-wrap">
        <div>
          <div class="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">Pending</div>
          <div class="text-2xl font-bold text-[#B45309] leading-none mt-1">{{ items.length }}</div>
        </div>
        <div class="w-px h-10 bg-[#E5E7EB]" />
        <div>
          <div class="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">Lomba</div>
          <div class="text-2xl font-bold text-[#1F2937] leading-none mt-1">{{ uniqueLombaCount }}</div>
        </div>
        <div
          v-if="selected.size > 0"
          class="ml-auto text-[12px] text-[#15803D] font-bold inline-flex items-center gap-1.5"
        >
          <i class="fas fa-check-square" /> {{ selected.size }} dipilih
        </div>
      </div>
    </div>

    <!-- Search + filter pills -->
    <div class="mb-3 space-y-2">
      <div class="relative">
        <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-sm" />
        <input
          v-model="search"
          type="text"
          placeholder="Cari nama / nomor..."
          class="w-full pl-10 pr-10 py-2.5 border border-[#E5E7EB] rounded-lg text-sm bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
        />
        <button
          v-if="search"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#6B7280] hover:text-[#1F2937] text-[11px] flex items-center justify-center transition-colors"
          title="Hapus pencarian"
          aria-label="Hapus pencarian"
          @click="search = ''"
        >
          <i class="fas fa-times" />
        </button>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mr-0.5">Lomba</span>
        <button
          v-for="opt in lombaFilterOpts"
          :key="opt.key"
          :class="['filter-pill', filterLomba === opt.key ? 'filter-pill-active' : '']"
          :aria-pressed="filterLomba === opt.key"
          @click="filterLomba = opt.key"
        >
          <span v-if="opt.emoji" aria-hidden="true">{{ opt.emoji }}</span>
          {{ opt.label }}
          <span class="filter-pill-count">{{ opt.count }}</span>
        </button>
        <button
          v-if="filterActive"
          class="ml-auto text-[11px] text-primary font-semibold hover:underline inline-flex items-center gap-1"
          @click="resetFilters"
        >
          <i class="fas fa-undo" /> Reset
        </button>
      </div>
    </div>

    <!-- Bulk action bar (sticky saat scroll) -->
    <div
      v-if="selected.size > 0"
      class="bg-[#FEF3C7] border border-[#FDE68A] rounded p-3 mb-3 flex items-center gap-2 flex-wrap sticky top-2 z-10"
    >
      <strong class="text-[12px] text-[#92400E] inline-flex items-center gap-1.5">
        <i class="fas fa-check-square" /> {{ selected.size }} dipilih
      </strong>
      <button class="btn btn-sm btn-success" style="width: auto" :disabled="busy" @click="bulkAction('approve')">
        <i class="fas fa-check" /> Setujui
      </button>
      <button class="btn btn-sm" style="width: auto; background: #DC2626; color: white" :disabled="busy" @click="bulkAction('reject')">
        <i class="fas fa-xmark" /> Tolak
      </button>
      <button class="btn btn-sm" style="width: auto; background: #6B7280; color: white" :disabled="busy" @click="bulkAction('delete')">
        <i class="fas fa-trash" /> Hapus
      </button>
    </div>

    <!-- Empty state: zero pending across all lomba -->
    <div v-if="items.length === 0" class="card p-10 text-center text-[#6B7280]">
      <div class="w-16 h-16 rounded-full bg-gradient-to-br from-[#DCFCE7] to-[#F0FDF4] mx-auto mb-3 flex items-center justify-center text-3xl">
        <i class="fas fa-check-circle text-[#15803D]" />
      </div>
      <strong class="block text-[#1F2937] text-base mb-1">Semua clear!</strong>
      <p class="text-[12px]">Tidak ada pendaftar yang butuh approval saat ini.</p>
    </div>

    <!-- Empty state: filter/search filtered out everything -->
    <div v-else-if="visibleItems.length === 0" class="card p-10 text-center text-[#6B7280]">
      <i class="fas fa-search text-5xl text-[#D1D5DB] mb-3 block" />
      <strong class="block text-[#1F2937] text-base mb-1">Tidak ada hasil</strong>
      <p class="text-[12px]">
        Coba kata kunci atau filter lain, atau
        <button class="text-primary underline font-semibold" @click="resetFilters">reset filter</button>.
      </p>
    </div>

    <!-- List grouped by lomba -->
    <div v-else class="space-y-3">
      <div class="bg-white border border-[#E5E7EB] rounded p-2.5 flex items-center gap-2">
        <input
          type="checkbox"
          class="cursor-pointer"
          :checked="allSelected"
          :indeterminate="someSelected"
          @change="toggleAll"
        />
        <span class="text-[12px] font-semibold text-[#1F2937]">Pilih semua ({{ visibleItems.length }})</span>
        <span
          v-if="selected.size > 0"
          class="text-[11px] text-[#6B7280] ml-auto"
        >
          • {{ selected.size }} dipilih dari {{ visibleItems.length }}
        </span>
      </div>

      <div v-for="lombaId in Array.from(new Set(visibleItems.map((p) => p.lombaId)))" :key="lombaId">
        <div class="lomba-section-header">
          <span class="ls-emoji">{{ lombaMap.get(lombaId)?.emoji }}</span>
          <span class="ls-nama">{{ lombaMap.get(lombaId)?.nama }}</span>
          <span class="ls-count">{{ visibleItems.filter((p) => p.lombaId === lombaId).length }}</span>
        </div>
        <div
          v-for="p in visibleItems.filter((p) => p.lombaId === lombaId)"
          :key="p.id"
          class="pendaftar-card"
          :style="{ '--accent': p.kategoriColor }"
        >
          <div class="pc-top">
            <input
              type="checkbox"
              class="cell-checkbox cursor-pointer"
              :checked="selected.has(p.id)"
              :aria-label="`Pilih ${p.nama}`"
              @change="toggleOne(p.id)"
            />
            <div class="pc-avatar">{{ getInitials(p.nama) }}</div>
            <div class="pc-identity">
              <div class="pc-nama">{{ p.nama }}</div>
              <div class="text-[11px] text-[#6B7280] font-mono">
                <span :title="p.nomor">{{ shortNomor(p.nomor) }}</span> · {{ p.umur }} th · {{ p.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan' }}
              </div>
            </div>
            <div class="pc-actions">
              <button
                class="icon-action success"
                title="Setujui"
                :aria-label="`Setujui ${p.nama}`"
                :disabled="busy"
                @click="async () => { selectOnly(p.id); await bulkAction('approve'); }"
              >
                <i class="fas fa-check" />
              </button>
              <button
                class="icon-action danger"
                title="Tolak"
                :aria-label="`Tolak ${p.nama}`"
                :disabled="busy"
                @click="async () => { selectOnly(p.id); await bulkAction('reject'); }"
              >
                <i class="fas fa-xmark" />
              </button>
              <button
                class="icon-action reject"
                title="Hapus"
                :aria-label="`Hapus ${p.nama}`"
                :disabled="busy"
                @click="async () => { selectOnly(p.id); await bulkAction('delete'); }"
              >
                <i class="fas fa-trash" />
              </button>
            </div>
          </div>
          <div class="pc-divider" />
          <div class="pc-meta">
            <span class="pc-meta-item">
              <i class="fas fa-tag" />
              <span>{{ p.kategoriNama }}</span>
            </span>
            <span class="pc-time">
              <i class="far fa-clock" />
              {{ timeAgo(new Date(p.createdAt * 1000).toISOString()) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </AdminShell>
</template>
