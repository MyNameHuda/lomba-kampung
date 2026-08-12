<script setup lang="ts">
// Admin peserta list — Vue 3 port of app/admin/peserta/page.tsx + peserta-list-client.tsx.
import AdminShell from "~/components/AdminShell.vue";

useHead({ title: "Peserta — Admin" });

type Lomba = {
  id: number;
  nama: string;
  emoji: string;
  status: string;
  count: number;
  pending: number;
  total: number;
};

const { data } = await useFetch<{ items: Lomba[] }>(
  "/api/admin/peserta-list",
  { credentials: "include" }
);
const items = computed(() => data.value?.items ?? []);

// === UI state: search + status filter + sort ===
const search = ref("");
const statusFilter = ref<"all" | "aktif" | "selesai" | "draft" | "closed">("all");
const sortKey = ref<"count" | "nama" | "status">("count");

const statusOpts = computed(() => [
  { key: "all" as const, label: "Semua", count: items.value.length },
  { key: "aktif" as const, label: "Aktif", count: items.value.filter((l) => l.status === "aktif").length },
  { key: "selesai" as const, label: "Selesai", count: items.value.filter((l) => l.status === "selesai").length },
  { key: "draft" as const, label: "Draft", count: items.value.filter((l) => l.status === "draft").length },
]);

const sortOpts: Array<{ key: "count" | "nama" | "status"; label: string }> = [
  { key: "count", label: "Paling Rame" },
  { key: "nama", label: "A-Z" },
  { key: "status", label: "Status" },
];

const visibleItems = computed(() => {
  const q = search.value.trim().toLowerCase();
  let result = items.value;
  if (q) result = result.filter((l) => l.nama.toLowerCase().includes(q));
  if (statusFilter.value !== "all") {
    result = result.filter((l) => l.status === statusFilter.value);
  }
  // Sort
  const sorted = [...result];
  if (sortKey.value === "count") {
    sorted.sort((a, b) => b.count - a.count || a.nama.localeCompare(b.nama));
  } else if (sortKey.value === "nama") {
    sorted.sort((a, b) => a.nama.localeCompare(b.nama));
  } else if (sortKey.value === "status") {
    sorted.sort((a, b) => a.status.localeCompare(b.status) || b.count - a.count);
  }
  return sorted;
});

// === Aggregate stats ===
const totalPeserta = computed(() => items.value.reduce((s, l) => s + l.count, 0));
const totalPending = computed(() => items.value.reduce((s, l) => s + l.pending, 0));
const kosongCount = computed(() => items.value.filter((l) => l.count === 0 && l.pending === 0).length);
const filterActive = computed(() => search.value !== "" || statusFilter.value !== "all");

function resetFilters() {
  search.value = "";
  statusFilter.value = "all";
}

// Status → CSS class mapping (semantically correct colors)
function statusClass(status: string): string {
  if (status === "aktif") return "status-approved"; // green
  if (status === "selesai") return "status-hadir"; // blue
  if (status === "closed" || status === "ditolak") return "status-rejected"; // red
  return "status-pending"; // draft, etc. → amber
}
</script>

<template>
  <AdminShell title="Daftar Peserta" breadcrumb="Peserta" active-nav="/admin/peserta">
    <p class="text-[13px] text-[#6B7280] mb-4">Pilih lomba untuk kelola pendaftar, tandai hadir, atau input juara.</p>

    <!-- Stats summary -->
    <div v-if="items.length > 0" class="card p-4 mb-4">
      <div class="flex items-center gap-5 flex-wrap">
        <div>
          <div class="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">Lomba</div>
          <div class="text-2xl font-bold text-[#1F2937] leading-none mt-1">{{ items.length }}</div>
        </div>
        <div class="w-px h-10 bg-[#E5E7EB]" />
        <div>
          <div class="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">Peserta</div>
          <div class="text-2xl font-bold text-[#15803D] leading-none mt-1">{{ totalPeserta }}</div>
        </div>
        <template v-if="totalPending > 0">
          <div class="w-px h-10 bg-[#E5E7EB]" />
          <div>
            <div class="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">Pending</div>
            <div class="text-2xl font-bold text-[#B45309] leading-none mt-1">{{ totalPending }}</div>
          </div>
        </template>
        <div v-if="kosongCount > 0" class="ml-auto text-[12px] text-[#9CA3AF] italic">
          <i class="fas fa-info-circle" /> {{ kosongCount }} lomba belum ada pendaftar
        </div>
      </div>
    </div>

    <!-- Search + filter + sort -->
    <div class="mb-3 space-y-2">
      <div class="relative">
        <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-sm" />
        <input
          v-model="search"
          type="text"
          placeholder="Cari lomba..."
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
        <span class="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mr-0.5">Status</span>
        <button
          v-for="opt in statusOpts"
          :key="opt.key"
          :class="['filter-pill', statusFilter === opt.key ? 'filter-pill-active' : '']"
          :aria-pressed="statusFilter === opt.key"
          @click="statusFilter = opt.key"
        >
          {{ opt.label }}
          <span class="filter-pill-count">{{ opt.count }}</span>
        </button>
        <span class="w-px h-5 bg-[#E5E7EB] mx-1.5" />
        <span class="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mr-0.5">Sort</span>
        <button
          v-for="opt in sortOpts"
          :key="opt.key"
          :class="['filter-pill', sortKey === opt.key ? 'filter-pill-active' : '']"
          :aria-pressed="sortKey === opt.key"
          @click="sortKey = opt.key"
        >
          {{ opt.label }}
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

    <!-- Empty state: zero lomba in DB at all -->
    <div v-if="items.length === 0" class="card p-10 text-center text-[#6B7280]">
      <i class="fas fa-trophy text-5xl text-[#D1D5DB] mb-3 block" />
      <strong class="block text-[#1F2937] text-base mb-1">Belum ada lomba</strong>
      <p class="text-[12px]">
        Buka <NuxtLink to="/admin/lomba" class="text-primary underline font-semibold">Manajemen Lomba</NuxtLink>
        untuk mulai.
      </p>
    </div>

    <!-- Empty state: filter/search filtered out everything -->
    <div v-else-if="visibleItems.length === 0" class="card p-10 text-center text-[#6B7280]">
      <i class="fas fa-search text-5xl text-[#D1D5DB] mb-3 block" />
      <strong class="block text-[#1F2937] text-base mb-1">Tidak ada lomba yang cocok</strong>
      <p class="text-[12px]">
        Coba kata kunci atau filter lain, atau
        <button class="text-primary underline font-semibold" @click="resetFilters">reset filter</button>.
      </p>
    </div>

    <!-- Lomba grid (3-col on xl screens) -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
      <NuxtLink
        v-for="l in visibleItems"
        :key="l.id"
        :to="`/admin/peserta/${l.id}`"
        class="bg-white border border-[#E5E7EB] rounded-xl p-4 hover:border-primary hover:shadow-md transition-all no-underline text-inherit block"
      >
        <div class="flex items-center gap-3 mb-3">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">
            {{ l.emoji }}
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-[15px] text-[#1F2937] leading-tight break-words">{{ l.nama }}</h3>
            <span :class="['status-badge mt-1', statusClass(l.status)]">
              <i class="fas fa-circle" style="font-size: 6px" /> {{ l.status }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2 text-[12px] text-[#374151] flex-wrap">
          <!-- Disetujui count — primary metric -->
          <div v-if="l.count > 0" class="inline-flex items-center gap-1.5">
            <i class="fas fa-users text-[#6B7280]" />
            <span><strong class="text-[#1F2937]">{{ l.count }}</strong> peserta</span>
          </div>

          <!-- Pending indicator (visual cue, clickable separately to /admin/approval) -->
          <button
            v-if="l.pending > 0"
            type="button"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold hover:bg-amber-200 transition-colors border-0 cursor-pointer"
            :title="`${l.pending} peserta menunggu approval`"
            :aria-label="`Buka approval untuk ${l.pending} peserta menunggu`"
            @click.stop.prevent="$router.push('/admin/approval')"
          >
            <i class="fas fa-clock text-[8px]" aria-hidden="true" />
            {{ l.pending }} menunggu
          </button>

          <!-- Empty hint for lomba with no pendaftar at all -->
          <div
            v-if="l.count === 0 && l.pending === 0"
            class="inline-flex items-center gap-1.5 text-[#9CA3AF] italic"
          >
            <i class="fas fa-user-plus text-[10px]" aria-hidden="true" />
            <span>Belum ada pendaftar</span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </AdminShell>
</template>
