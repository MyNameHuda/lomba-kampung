<script setup lang="ts">
// Admin peserta per-lomba detail — Vue 3 port of app/admin/peserta/[lombaId]/page.tsx + peserta-client.tsx.
import AdminShell from "~/components/AdminShell.vue";
import DownloadExcelButton from "~/components/DownloadExcelButton.vue";
import { useNotify } from "~/composables/useNotify";
import { groupKategoriByPublicName } from "~/utils/format";

type PesertaRow = {
  id: number;
  nomor: string;
  nama: string;
  umur: number;
  jenisKelamin: "L" | "P";
  kategori: string;
  kategoriColor: string;
  hadir: boolean;
};

const route = useRoute();
const lombaId = computed(() => Number(route.params.lombaId));

const { data, refresh } = await useFetch<{
  lomba: { id: number; nama: string; emoji: string; status: string; faseEnabled: boolean };
  kats: Array<{ id: string; nama: string; colorBg: string; colorText: string; colorBorder: string }>;
  byKategori: Record<string, PesertaRow[]>;
}>(() => `/api/admin/peserta-detail/${lombaId.value}`, { credentials: "include" });

useHead(() => ({ title: `Peserta ${data.value?.lomba?.nama || ""} — Admin` }));

const sections = computed(() => {
  if (!data.value) return [];
  const byKat = data.value.byKategori;
  const eligible = Object.keys(byKat);
  const groups = groupKategoriByPublicName(eligible);
  return groups.map((g) => {
    const flat = g.kategoriIds.flatMap((kid) => byKat[kid] || []);
    return {
      publicName: g.publicName,
      kategoriIds: g.kategoriIds,
      peserta: flat.sort((a, b) => a.umur - b.umur || a.nama.localeCompare(b.nama)),
      sampleColor: (data.value!.kats.find((k) => k.id === g.kategoriIds[0]) as any)?.colorBorder || "#E5E7EB",
    };
  });
});

// === UI state: search + filters ===
const search = ref("");
const genderFilter = ref<"all" | "L" | "P">("all");
const statusFilter = ref<"all" | "hadir" | "absen">("all");

const filteredSections = computed(() => {
  const q = search.value.trim().toLowerCase();
  return sections.value
    .map((s) => ({
      ...s,
      peserta: s.peserta.filter((p) => {
        if (q && !(p.nama.toLowerCase().includes(q) || p.nomor.toLowerCase().includes(q))) return false;
        if (genderFilter.value !== "all" && p.jenisKelamin !== genderFilter.value) return false;
        if (statusFilter.value === "hadir" && !p.hadir) return false;
        if (statusFilter.value === "absen" && p.hadir) return false;
        return true;
      }),
    }))
    .filter((s) => s.peserta.length > 0);
});

const totalPeserta = computed(() => sections.value.reduce((sum, s) => sum + s.peserta.length, 0));
const totalHadir = computed(() => sections.value.reduce((sum, s) => sum + s.peserta.filter((p) => p.hadir).length, 0));
const totalAbsen = computed(() => totalPeserta.value - totalHadir.value);
const filteredCount = computed(() => filteredSections.value.reduce((sum, s) => sum + s.peserta.length, 0));
const filterActive = computed(() => search.value.trim() !== "" || genderFilter.value !== "all" || statusFilter.value !== "all");

const hadirPct = computed(() => (totalPeserta.value > 0 ? Math.round((totalHadir.value / totalPeserta.value) * 100) : 0));

function sectionStats(peserta: PesertaRow[]) {
  const had = peserta.filter((p) => p.hadir).length;
  return { had, tot: peserta.length };
}

// Compact nomor — show last 4 digits with hash prefix
function shortNomor(full: string) {
  const m = full.match(/(\d{4})$/);
  return m ? `#${m[1]}` : full;
}

const notify = useNotify();
async function toggleHadir(p: PesertaRow) {
  try {
    await $fetch(`/api/admin/pendaftar/${p.id}`, {
      method: "PATCH",
      body: { hadir: !p.hadir },
      credentials: "include",
    });
    notify.success(p.hadir ? `${p.nama} ditandai absen` : `${p.nama} ditandai hadir`);
    await refresh();
  } catch {
    notify.error("Gagal ubah status hadir");
  }
}
async function deleteP(p: PesertaRow) {
  const ok = await notify.confirm({
    title: "Hapus Peserta",
    message: `Hapus ${p.nama}? Data tidak bisa dikembalikan.`,
    variant: "danger",
    confirmText: "Hapus",
  });
  if (!ok) return;
  try {
    await $fetch(`/api/admin/pendaftar/${p.id}`, { method: "DELETE", credentials: "include" });
    notify.success("Peserta dihapus");
    await refresh();
  } catch {
    notify.error("Gagal hapus");
  }
}

function resetFilters() {
  search.value = "";
  genderFilter.value = "all";
  statusFilter.value = "all";
}
</script>

<template>
  <AdminShell
    :title="data?.lomba?.nama || 'Peserta'"
    :breadcrumb="data?.lomba?.nama"
    active-nav="/admin/peserta"
  >
    <template #actions>
      <DownloadExcelButton
        variant="btn-secondary"
        label="Excel"
        :endpoint="`/api/admin/peserta-excel/${lombaId}`"
        title="Download Excel peserta disetujui lomba ini"
      />
      <NuxtLink :to="`/admin/lomba/${lombaId}/juara`" class="btn btn-sm btn-primary" style="width: auto">
        <i class="fas fa-trophy" /> Juara
      </NuxtLink>
    </template>

    <!-- Stats summary card (replaces long red banner) -->
    <div v-if="totalPeserta > 0" class="card p-4 mb-4">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex-1 min-w-[220px]">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Kehadiran</span>
            <span class="text-[11px] font-bold text-[#15803D]">{{ hadirPct }}%</span>
          </div>
          <div class="flex items-baseline gap-1.5 mb-2">
            <span class="text-2xl font-bold text-[#1F2937] leading-none">{{ totalHadir }}</span>
            <span class="text-[13px] text-[#6B7280]">/ {{ totalPeserta }} peserta hadir</span>
          </div>
          <div class="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500 ease-out"
              :class="hadirPct === 100 ? 'bg-[#15803D]' : 'bg-gradient-to-r from-[#15803D] to-[#22C55E]'"
              :style="{ width: `${hadirPct}%` }"
            />
          </div>
        </div>
        <div class="flex gap-2">
          <div class="text-center min-w-[70px] px-3 py-2 rounded-lg bg-[#F0FDF4] border border-[#DCFCE7]">
            <div class="text-[10px] font-bold uppercase tracking-wide text-[#15803D]">Hadir</div>
            <div class="text-xl font-bold text-[#15803D] leading-tight mt-0.5">{{ totalHadir }}</div>
          </div>
          <div
            class="text-center min-w-[70px] px-3 py-2 rounded-lg border"
            :class="totalAbsen > 0 ? 'bg-[#FEF2F2] border-[#FECACA]' : 'bg-[#F9FAFB] border-[#E5E7EB]'"
          >
            <div
              class="text-[10px] font-bold uppercase tracking-wide"
              :class="totalAbsen > 0 ? 'text-[#991B1B]' : 'text-[#9CA3AF]'"
            >
              Absen
            </div>
            <div
              class="text-xl font-bold leading-tight mt-0.5"
              :class="totalAbsen > 0 ? 'text-[#991B1B]' : 'text-[#9CA3AF]'"
            >
              {{ totalAbsen }}
            </div>
          </div>
        </div>
      </div>
      <p v-if="totalAbsen > 0" class="text-[12px] text-[#6B7280] mt-3 pt-3 border-t border-[#F3F4F6] flex items-start gap-2">
        <i class="fas fa-info-circle text-primary mt-0.5" />
        <span><strong class="text-[#374151]">{{ totalAbsen }}</strong> peserta belum ditandai hadir. Klik tombol <i class="fas fa-check text-[#15803D]" /> di baris mereka untuk absen.</span>
      </p>
    </div>

    <!-- Search + filter row -->
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
        <span class="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mr-0.5">Status</span>
        <button
          v-for="opt in [
            { key: 'all', label: 'Semua', count: totalPeserta },
            { key: 'hadir', label: 'Hadir', count: totalHadir },
            { key: 'absen', label: 'Absen', count: totalAbsen },
          ]"
          :key="opt.key"
          :class="['filter-pill', statusFilter === opt.key ? 'filter-pill-active' : '']"
          :aria-pressed="statusFilter === opt.key"
          @click="statusFilter = opt.key as any"
        >
          {{ opt.label }}
          <span class="filter-pill-count">{{ opt.count }}</span>
        </button>
        <span class="w-px h-5 bg-[#E5E7EB] mx-1.5" />
        <span class="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mr-0.5">JK</span>
        <button
          v-for="opt in [
            { key: 'all', label: 'Semua' },
            { key: 'L', label: 'L' },
            { key: 'P', label: 'P' },
          ]"
          :key="opt.key"
          :class="['filter-pill', genderFilter === opt.key ? 'filter-pill-active' : '']"
          :aria-pressed="genderFilter === opt.key"
          @click="genderFilter = opt.key as any"
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
      <div v-if="filterActive" class="text-[11px] text-[#6B7280]">
        Menampilkan <strong class="text-[#1F2937]">{{ filteredCount }}</strong> dari {{ totalPeserta }} peserta
      </div>
    </div>

    <!-- Empty state: zero approved peserta → link to /admin/approval -->
    <div v-if="totalPeserta === 0" class="card p-10 text-center">
      <div class="w-16 h-16 rounded-full bg-gradient-to-br from-[#FCE0E0] to-[#FBE0E0] mx-auto mb-3 flex items-center justify-center text-3xl">
        <i class="fas fa-user-check text-primary" />
      </div>
      <strong class="block text-[#1F2937] text-base mb-1">Belum ada peserta disetujui</strong>
      <p class="text-[12px] text-[#6B7280] mb-4 max-w-[300px] mx-auto">
        Peserta yang baru mendaftar atau menunggu review tampil di halaman Approval.
      </p>
      <NuxtLink to="/admin/approval" class="btn btn-primary" style="width: auto">
        <i class="fas fa-clipboard-check" /> Buka Approval
      </NuxtLink>
    </div>

    <!-- Empty state: search filtered out everything -->
    <div v-else-if="filteredSections.length === 0" class="card p-10 text-center text-[#6B7280]">
      <i class="fas fa-search text-5xl text-[#D1D5DB] mb-3 block" />
      <strong class="block text-[#1F2937] text-base mb-1">Tidak ada hasil</strong>
      <p class="text-[12px]">
        Coba kata kunci lain, atau
        <button class="text-primary underline font-semibold" @click="resetFilters">reset filter</button>.
      </p>
    </div>

    <div v-else class="space-y-4">
      <div v-for="s in filteredSections" :key="s.publicName">
        <div class="flex items-center gap-2 mb-2 px-1">
          <h4 class="text-[12px] font-bold text-[#1F2937] uppercase tracking-wide">{{ s.publicName }}</h4>
          <span class="text-[10px] font-bold bg-[#F3F4F6] text-[#6B7280] px-2 py-0.5 rounded-full">{{ s.peserta.length }} orang</span>
          <span
            v-if="sectionStats(s.peserta).had > 0"
            class="text-[10px] font-bold bg-[#DCFCE7] text-[#15803D] px-2 py-0.5 rounded-full inline-flex items-center gap-1"
            :title="`${sectionStats(s.peserta).had} dari ${s.peserta.length} sudah hadir`"
          >
            <i class="fas fa-check" style="font-size: 8px" /> {{ sectionStats(s.peserta).had }} hadir
          </span>
        </div>
        <div class="card overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Nomor</th>
                <th>Nama</th>
                <th>JK</th>
                <th>Umur</th>
                <th>Status</th>
                <th class="cell-actions">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in s.peserta" :key="p.id">
                <td
                  data-label="Nomor"
                  class="cell-primary font-mono text-[12px] text-[#374151] tracking-tight"
                  :title="p.nomor"
                >
                  {{ shortNomor(p.nomor) }}
                </td>
                <td data-label="Nama" class="font-semibold">{{ p.nama }}</td>
                <td data-label="JK">
                  <span
                    :class="['jk-pill', p.jenisKelamin === 'L' ? 'jk-pill-l' : 'jk-pill-p']"
                    :title="p.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'"
                  >
                    <i :class="['fas', p.jenisKelamin === 'L' ? 'fa-mars' : 'fa-venus']" />
                    <span class="font-bold">{{ p.jenisKelamin }}</span>
                  </span>
                </td>
                <td data-label="Umur">{{ p.umur }} th</td>
                <td data-label="Status">
                  <span :class="['status-badge', p.hadir ? 'status-hadir' : 'status-rejected']">
                    <i :class="['fas', p.hadir ? 'fa-check' : 'fa-exclamation-circle']" style="font-size: 8px" />
                    {{ p.hadir ? 'Hadir' : 'Absen' }}
                  </span>
                </td>
                <td data-label="Aksi" class="cell-actions">
                  <div class="row-actions">
                    <button
                      :class="['icon-action', p.hadir ? 'reject' : 'approve']"
                      :title="p.hadir ? 'Batalkan kehadiran' : 'Tandai hadir'"
                      :aria-label="p.hadir ? `Batalkan kehadiran ${p.nama}` : `Tandai ${p.nama} hadir`"
                      @click="toggleHadir(p)"
                    >
                      <i :class="['fas', p.hadir ? 'fa-times' : 'fa-check']" />
                    </button>
                    <button
                      class="icon-action danger"
                      :title="`Hapus ${p.nama}`"
                      :aria-label="`Hapus ${p.nama}`"
                      @click="deleteP(p)"
                    >
                      <i class="fas fa-trash" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </AdminShell>
</template>
