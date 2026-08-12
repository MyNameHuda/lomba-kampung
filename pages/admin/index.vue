<script setup lang="ts">
// Admin dashboard — Vue 3 port of app/admin/page.tsx.
import AdminShell from "~/components/AdminShell.vue";
import DownloadExcelButton from "~/components/DownloadExcelButton.vue";
import { timeAgo, shortNomor } from "~/utils/format";

useHead({ title: "Dashboard — Admin" });

const { data } = await useFetch<{
  cfg: { appName: string; kampungName: string; tahunAktif: string } | null;
  stats: { lombaAktif: number; totalPendaftar: number; pending: number; disetujui: number; ditolak: number; hadir: number };
  recent: Array<{ id: number; nama: string; status: string; createdAt: number; nomor: string; lombaId: number }>;
  lombaWithCount: Array<{ id: number; nama: string; emoji: string; status: string; count: number }>;
}>("/api/admin/dashboard", { credentials: "include" });

const stats = computed(() => data.value?.stats);
const recent = computed(() => data.value?.recent ?? []);
const lombaWithCount = computed(() => data.value?.lombaWithCount ?? []);

const kampungName = computed(() => data.value?.cfg?.kampungName || "Kampung Kadu Jaya");

// Welcome line — Indonesian long date
const greetingDate = computed(() =>
  new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date())
);

// Percentages for primary stats
const disetujuiPct = computed(() => {
  if (!stats.value || stats.value.totalPendaftar === 0) return 0;
  return Math.round((stats.value.disetujui / stats.value.totalPendaftar) * 100);
});
const hadirPct = computed(() => {
  if (!stats.value || stats.value.disetujui === 0) return 0;
  return Math.round((stats.value.hadir / stats.value.disetujui) * 100);
});

// Lomba lookup by id (for the Lomba column in recent pendaftar)
const lombaById = (id: number) => lombaWithCount.value.find((l) => l.id === id);
</script>

<template>
  <AdminShell title="Dashboard" breadcrumb="Dashboard" active-nav="/admin" app-name="Lomba Kampung" :kampung-name="kampungName">
    <!-- Welcome row -->
    <div class="mb-4 flex items-baseline justify-between flex-wrap gap-2">
      <div>
        <h2 class="text-[18px] font-bold text-[#1F2937] leading-tight">
          Halo, Admin <span aria-hidden="true">👋</span>
        </h2>
        <p class="text-[12px] text-[#6B7280] mt-0.5">{{ greetingDate }}</p>
      </div>
    </div>

    <!-- Critical alert — muncul cuma kalau ada pending/ditolak yang perlu perhatian -->
    <div
      v-if="stats && (stats.pending > 0 || stats.ditolak > 0)"
      class="alert-row mb-4"
      role="status"
    >
      <i class="fas fa-bell" />
      <div class="flex-1">
        <template v-if="stats.pending > 0">
          <strong>{{ stats.pending }} pendaftar</strong> butuh approval
        </template>
        <template v-if="stats.pending > 0 && stats.ditolak > 0"> · </template>
        <template v-if="stats.ditolak > 0">
          <strong>{{ stats.ditolak }} ditolak</strong> bulan ini
        </template>
      </div>
      <NuxtLink
        v-if="stats.pending > 0"
        to="/admin/approval"
        class="alert-link"
      >
        Review <i class="fas fa-arrow-right" />
      </NuxtLink>
    </div>

    <!-- Primary stats (3 besar, clickable) -->
    <div v-if="stats" class="stats-grid">
      <NuxtLink to="/admin/peserta" class="stat-card info stat-card-clickable">
        <div class="icon"><i class="fas fa-users" /></div>
        <div>
          <div class="label">Total Pendaftar</div>
          <div class="value">{{ stats.totalPendaftar }}</div>
          <div class="sublabel">dari {{ lombaWithCount.length }} lomba</div>
        </div>
      </NuxtLink>
      <NuxtLink to="/admin/peserta" class="stat-card success stat-card-clickable">
        <div class="icon"><i class="fas fa-check" /></div>
        <div>
          <div class="label">Disetujui</div>
          <div class="value">{{ stats.disetujui }}</div>
          <div class="sublabel">{{ disetujuiPct }}% dari total</div>
        </div>
      </NuxtLink>
      <NuxtLink to="/admin/peserta" class="stat-card primary stat-card-clickable">
        <div class="icon"><i class="fas fa-user-check" /></div>
        <div>
          <div class="label">Hadir</div>
          <div class="value">{{ stats.hadir }}</div>
          <div class="sublabel">{{ hadirPct }}% dari disetujui</div>
        </div>
      </NuxtLink>
    </div>

    <!-- Secondary stats (3 kecil, alert kalau > 0) -->
    <div v-if="stats" class="grid grid-cols-3 gap-3 mb-5">
      <NuxtLink to="/admin/lomba" class="stat-mini">
        <i class="fas fa-trophy" />
        <div>
          <div class="stat-mini-label">Lomba Aktif</div>
          <div class="stat-mini-value">{{ stats.lombaAktif }}</div>
        </div>
      </NuxtLink>
      <NuxtLink
        to="/admin/approval"
        :class="['stat-mini', stats.pending > 0 ? 'stat-mini-alert' : '']"
      >
        <i class="fas fa-hourglass-half" />
        <div>
          <div class="stat-mini-label">Pending</div>
          <div class="stat-mini-value">{{ stats.pending }}</div>
        </div>
      </NuxtLink>
      <NuxtLink
        to="/admin/approval"
        :class="['stat-mini', stats.ditolak > 0 ? 'stat-mini-alert' : '']"
      >
        <i class="fas fa-xmark" />
        <div>
          <div class="stat-mini-label">Ditolak</div>
          <div class="stat-mini-value">{{ stats.ditolak }}</div>
        </div>
      </NuxtLink>
    </div>

    <!-- Aksi Cepat — 5 tiles konsisten dalam 1 row -->
    <div class="mb-5">
      <h3 class="text-sm font-bold mb-3 text-[#1F2937]">Aksi Cepat</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <NuxtLink to="/admin/lomba" class="quick-tile success">
          <div class="qicon"><i class="fas fa-trophy" /></div>
          <div class="qlbl">Lomba</div>
        </NuxtLink>
        <NuxtLink to="/admin/approval" class="quick-tile warn">
          <div class="qicon"><i class="fas fa-user-check" /></div>
          <div class="qlbl">Approval</div>
        </NuxtLink>
        <NuxtLink to="/admin/peserta" class="quick-tile info">
          <div class="qicon"><i class="fas fa-users" /></div>
          <div class="qlbl">Peserta</div>
        </NuxtLink>
        <NuxtLink
          to="/admin/input-manual"
          class="quick-tile"
          style="background: #FEF3C7; border-color: #FCD34D"
        >
          <div class="qicon" style="background: white">
            <i class="fas fa-user-plus text-[#B45309]" />
          </div>
          <div class="qlbl">Input Manual</div>
        </NuxtLink>
        <DownloadExcelButton variant="tile" label="Download Excel" />
      </div>
    </div>

    <!-- Bottom: Pendaftar Terbaru (2/3) + Per Lomba (1/3) -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Pendaftar Terbaru -->
      <div class="lg:col-span-2">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-bold text-[#1F2937]">Pendaftar Terbaru</h3>
          <NuxtLink
            v-if="recent.length > 0"
            to="/admin/peserta"
            class="text-[11px] text-primary font-semibold hover:underline inline-flex items-center gap-1"
          >
            Lihat semua <i class="fas fa-arrow-right" style="font-size: 9px" />
          </NuxtLink>
        </div>
        <div v-if="recent.length === 0" class="card p-8 text-center text-[#6B7280]">
          <i class="fas fa-user-plus text-4xl text-[#D1D5DB] mb-2 block" />
          <strong class="block text-[#1F2937]">Belum ada pendaftar</strong>
          <p class="text-[12px] mt-1">Share halaman publik untuk warga mendaftar</p>
        </div>
        <template v-else>
          <!-- Desktop / tablet: table view -->
          <div class="hidden md:block card overflow-x-auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Nama</th>
                  <th>Lomba</th>
                  <th>Status</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in recent" :key="p.id">
                  <td
                    data-label="Nomor"
                    class="cell-primary font-mono text-[12px] text-[#374151] tracking-tight"
                    :title="p.nomor"
                  >
                    {{ shortNomor(p.nomor) }}
                  </td>
                  <td data-label="Nama" class="font-semibold">{{ p.nama }}</td>
                  <td data-label="Lomba" class="text-[12px]">
                    <span v-if="lombaById(p.lombaId)" class="inline-flex items-center gap-1.5">
                      <span aria-hidden="true">{{ lombaById(p.lombaId)!.emoji }}</span>
                      <span class="text-[#374151] truncate max-w-[160px] inline-block align-middle">
                        {{ lombaById(p.lombaId)!.nama }}
                      </span>
                    </span>
                    <span v-else class="text-[#9CA3AF]">—</span>
                  </td>
                  <td data-label="Status">
                    <span
                      :class="[
                        'status-badge',
                        p.status === 'disetujui' ? 'status-approved' :
                        p.status === 'ditolak' ? 'status-rejected' : 'status-pending',
                      ]"
                    >
                      <i class="fas fa-circle" style="font-size: 6px" />
                      {{ p.status }}
                    </span>
                  </td>
                  <td data-label="Waktu" class="text-[12px] text-[#6B7280] whitespace-nowrap">
                    {{ timeAgo(new Date(p.createdAt * 1000).toISOString()) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Mobile: card list (each card is tappable, opens lomba detail) -->
          <div class="md:hidden space-y-2">
            <NuxtLink
              v-for="p in recent"
              :key="p.id"
              :to="`/admin/peserta/${p.lombaId}`"
              class="recent-card"
              :aria-label="`Lihat pendaftar ${p.nama}, ${p.status}, ${lombaById(p.lombaId)?.nama ?? ''}`"
            >
              <div class="recent-card-head">
                <span class="recent-card-nomor" :title="p.nomor">{{ shortNomor(p.nomor) }}</span>
                <span
                  :class="[
                    'status-badge',
                    p.status === 'disetujui' ? 'status-approved' :
                    p.status === 'ditolak' ? 'status-rejected' : 'status-pending',
                  ]"
                >
                  <i class="fas fa-circle" style="font-size: 6px" />
                  {{ p.status }}
                </span>
              </div>
              <div class="recent-card-name">{{ p.nama }}</div>
              <div v-if="lombaById(p.lombaId)" class="recent-card-lomba">
                <span aria-hidden="true">{{ lombaById(p.lombaId)!.emoji }}</span>
                <span class="recent-card-lomba-name">{{ lombaById(p.lombaId)!.nama }}</span>
              </div>
              <div v-else class="recent-card-lomba">
                <span class="text-[#9CA3AF]">—</span>
              </div>
              <div class="recent-card-foot">
                <span>
                  <i class="far fa-clock" style="font-size: 10px" />
                  {{ timeAgo(new Date(p.createdAt * 1000).toISOString()) }}
                </span>
                <i class="fas fa-chevron-right recent-card-arrow" />
              </div>
            </NuxtLink>
          </div>
        </template>
      </div>

      <!-- Per Lomba -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-bold text-[#1F2937]">Per Lomba</h3>
          <NuxtLink
            to="/admin/lomba"
            class="text-[11px] text-primary font-semibold hover:underline inline-flex items-center gap-1"
          >
            Kelola <i class="fas fa-arrow-right" style="font-size: 9px" />
          </NuxtLink>
        </div>
        <div v-if="lombaWithCount.length === 0" class="card p-6 text-center text-[#6B7280] text-[12px]">
          <i class="fas fa-trophy text-3xl text-[#D1D5DB] mb-2 block" />
          Belum ada lomba.
          <NuxtLink to="/admin/lomba" class="text-primary underline font-semibold block mt-1">
            Buat lomba pertama
          </NuxtLink>
        </div>
        <div v-else class="space-y-2">
          <NuxtLink
            v-for="l in lombaWithCount"
            :key="l.id"
            :to="`/admin/peserta/${l.id}`"
            class="lomba-mini-card"
          >
            <div class="lomba-mini-emoji">{{ l.emoji }}</div>
            <div class="flex-1 min-w-0">
              <div class="text-[13px] font-semibold text-[#1F2937] truncate leading-tight">{{ l.nama }}</div>
              <div :class="['lomba-mini-status', `lomba-mini-status-${l.status}`]">
                <i class="fas fa-circle" style="font-size: 5px" />
                {{ l.status }}
              </div>
            </div>
            <div class="text-right flex-shrink-0">
              <div class="text-lg font-bold text-[#1F2937] leading-none">{{ l.count }}</div>
              <div class="text-[10px] text-[#6B7280] uppercase tracking-wide">peserta</div>
            </div>
          </NuxtLink>
        </div>
      </div>
    </div>
  </AdminShell>
</template>
