<script setup lang="ts">
// Admin Lomba CRUD — Vue 3 port of app/admin/lomba/page.tsx + lomba-client.tsx + lomba-modal.tsx.
// Full inline form (modal) for create/edit lomba with kategori, PJ list, jadwal.
import AdminShell from "~/components/AdminShell.vue";
import KatTag from "~/components/KatTag.vue";
import { useNotify } from "~/composables/useNotify";
import { APP_CONFIG } from "~/utils/constants";
import { formatTanggalLomba, displayKategoriName, groupKategoriByPublicName, dateStrToTs, tsToUtcDateStr } from "~/utils/format";

useHead({ title: "Manajemen Lomba — Admin" });

const { data, refresh } = await useFetch<any>("/api/admin/lomba?withCounts=1", { credentials: "include" });

const items = ref<any[]>(data.value?.lomba ?? []);
const counts = computed<Record<number, number>>(() => data.value?.counts ?? {});
const juaraSummary = computed<Record<number, { totalJuara: number; allReady: boolean }>>(() => data.value?.juaraSummary ?? {});
const kats = computed(() => data.value?.kats ?? []);

const search = ref("");
const statusFilter = ref<"all" | "aktif" | "selesai" | "draft">("all");
const sortBy = ref<"urutan" | "nama" | "peserta">("urutan");

const visibleItems = computed(() => {
  const q = search.value.trim().toLowerCase();
  let result = items.value.filter((l: any) => {
    if (q && !l.nama.toLowerCase().includes(q)) return false;
    if (statusFilter.value !== "all" && l.status !== statusFilter.value) return false;
    return true;
  });
  return [...result].sort((a: any, b: any) => {
    if (sortBy.value === "nama") return a.nama.localeCompare(b.nama);
    if (sortBy.value === "peserta") return (counts.value[b.id] || 0) - (counts.value[a.id] || 0);
    return a.urutan - b.urutan;
  });
});

const STATUS_LABEL: any = { all: "Semua", aktif: "Aktif", selesai: "Selesai", draft: "Draft" };
const STATUS_BADGE: any = {
  aktif: "status-approved",
  selesai: "status-hadir",
  draft: "status-pending",
};
const EMOJI_OPTIONS = ["🏆", "🍪", "🏃", "🪢", "🌴", "💧", "🎤", "🪑", "🥚", "🎯", "🏐", "🎲", "🎨", "🎭", "📚", "🚌"];

const notify = useNotify();
const busy = ref<number | null>(null);

// Modal state
const editing = ref<any | null>(null);
const creating = ref(false);

function openCreate() {
  editing.value = null;
  creating.value = true;
}
function openEdit(l: any) {
  editing.value = l;
  creating.value = false;
}
function closeModal() {
  creating.value = false;
  editing.value = null;
}

async function saveLomba(formData: any) {
  try {
    if (editing.value?.id) {
      await $fetch(`/api/admin/lomba/${editing.value.id}`, { method: "PATCH", body: formData, credentials: "include" });
      notify.success("Lomba berhasil diperbarui");
    } else {
      await $fetch("/api/admin/lomba", { method: "POST", body: formData, credentials: "include" });
      notify.success("Lomba berhasil ditambahkan");
    }
    closeModal();
    await refresh();
    items.value = data.value?.lomba ?? [];
  } catch (e: any) {
    notify.error(e?.data?.statusMessage || "Gagal menyimpan lomba");
  }
}

async function deleteLomba(l: any) {
  const ok = await notify.confirm({
    title: "Hapus Lomba", message: `Hapus "${l.nama}"?\n\nSemua peserta yang terkait akan ikut terhapus.`,
    confirmText: "Hapus", variant: "danger",
  });
  if (!ok) return;
  busy.value = l.id;
  try {
    await $fetch(`/api/admin/lomba/${l.id}`, { method: "DELETE", credentials: "include" });
    notify.success(`Lomba "${l.nama}" dihapus`);
    await refresh();
    items.value = data.value?.lomba ?? [];
  } catch {
    notify.error("Gagal hapus lomba");
  } finally {
    busy.value = null;
  }
}

async function toggleStatus(l: any) {
  const next = l.status === "aktif" ? "selesai" : "aktif";
  busy.value = l.id;
  try {
    await $fetch(`/api/admin/lomba/${l.id}`, { method: "PATCH", body: { status: next }, credentials: "include" });
    items.value = items.value.map((x: any) => x.id === l.id ? { ...x, status: next } : x);
    notify.success(`Status lomba diubah ke ${next}`);
  } catch {
    notify.error("Gagal update status");
  } finally {
    busy.value = null;
  }
}

// Selesaikan perlombaan via the dedicated /selesai endpoint, which gates on
// juara readiness (Juara 1+2 must exist in every eligible kategori). This is
// the canonical "finalize" flow — the toggleStatus() path above is a quick
// status flip that skips readiness checks. After a successful finalize, we
// re-fetch so juaraSummary + counts stay in sync.
async function selesaikanLomba(l: any) {
  const ready = juaraSummary.value[l.id]?.allReady;
  const ok = await notify.confirm({
    title: "Selesaikan Perlombaan",
    message: ready
      ? `Yakin selesaikan "${l.nama}"?\n\nJuara 1+2+3 diumumkan ke publik. Tidak bisa di-undo.`
      : `Yakin selesaikan "${l.nama}" sekarang?\n\n⚠️ Juara 1/2 belum lengkap di beberapa kategori. Status akan di-pin ke "Selesai" namun publik mungkin melihat kategori tanpa Juara 1/2.`,
    confirmText: "Selesaikan",
    variant: "danger",
  });
  if (!ok) return;
  busy.value = l.id;
  try {
    await $fetch(`/api/admin/lomba/${l.id}/selesai`, { method: "POST", credentials: "include" });
    notify.success(`Perlombaan "${l.nama}" diselesaikan`);
    await refresh();
    items.value = data.value?.lomba ?? [];
  } catch (e: any) {
    notify.error(e?.data?.statusMessage || "Gagal selesaikan perlombaan");
  } finally {
    busy.value = null;
  }
}

// Buka kembali lomba yang sudah selesai. Status flip selesai → aktif via
// PATCH (the same path toggleStatus() uses, but inverted). Use case: admin
// realizes they picked the wrong juara after finalizing — they reopen, fix
// the winners on /admin/lomba/[id]/juara, then re-selesaikan. Juara page
// auto-unlocks when status flips back to "aktif" (it checks isLocked via the
// lomba.status field, see juara.vue).
async function bukaKembaliLomba(l: any) {
  const ok = await notify.confirm({
    title: "Buka Kembali Lomba",
    message: `Buka kembali "${l.nama}"?\n\nStatus kembali ke "Aktif". Juara yang sudah diumumkan ke publik akan tersembunyi lagi sampai Anda selesaikan ulang lomba ini.`,
    confirmText: "Buka Kembali",
    variant: "default",
  });
  if (!ok) return;
  busy.value = l.id;
  try {
    await $fetch(`/api/admin/lomba/${l.id}`, { method: "PATCH", body: { status: "aktif" }, credentials: "include" });
    items.value = items.value.map((x: any) => x.id === l.id ? { ...x, status: "aktif" } : x);
    notify.success(`"${l.nama}" dibuka kembali — juara bisa diedit ulang`);
  } catch {
    notify.error("Gagal buka kembali lomba");
  } finally {
    busy.value = null;
  }
}

// Dedupe jadwal across a group of kategori IDs (e.g. k_anak_l + k_anak_p
// collapsed under "Anak" both share the same tanggal — render only once).
// If L and P have different tanggal, both are shown (sorted ascending).
function uniqueJadwalsForGroup(l: any, kategoriIds: string[]) {
  const seen = new Set<number>();
  const out: { kategoriId: string; tanggal: number; jam: string | null }[] = [];
  for (const kid of kategoriIds) {
    const j = l.jadwalByKategori?.[kid];
    if (!j || j.tanggal == null) continue;
    if (seen.has(j.tanggal)) continue;
    seen.add(j.tanggal);
    out.push(j);
  }
  return out.sort((a, b) => a.tanggal - b.tanggal);
}
</script>

<template>
  <AdminShell
    title="Manajemen Lomba"
    breadcrumb="Manajemen Lomba"
    active-nav="/admin/lomba"
  >
    <template #actions>
      <NuxtLink to="/admin/input-manual" class="btn btn-sm" style="background: #F59E0B; color: white; width: auto">
        <i class="fas fa-user-plus" /> Input Manual
      </NuxtLink>
    </template>

    <p class="text-[13px] text-[#6B7280] mb-4 text-center">Kelola lomba: tambah, edit, hapus, atau ubah status (aktif/selesai).</p>

    <!-- Toolbar -->
    <div class="flex flex-col sm:flex-row gap-3 mb-3">
      <div class="flex-1 relative">
        <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-sm" />
        <input v-model="search" type="text" placeholder="Cari nama lomba..." class="w-full pl-10 pr-10 py-2.5 border border-[#E5E7EB] rounded-lg text-sm bg-white" />
        <button v-if="search" type="button" class="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-[#9CA3AF]" @click="search = ''">
          <i class="fas fa-xmark text-[12px]" />
        </button>
      </div>
      <button class="btn btn-primary whitespace-nowrap" style="width: auto" @click="openCreate">
        <i class="fas fa-plus" /> Tambah Lomba
      </button>
    </div>

    <!-- Filter chips + sort -->
    <div class="flex items-center gap-2 mb-3 -mx-4 px-4 overflow-x-auto pb-1">
      <button
        v-for="s in (Object.keys(STATUS_LABEL) as any[])"
        :key="s"
        type="button"
        class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold border-2 transition-colors"
        :class="statusFilter === s ? 'bg-primary border-primary text-white' : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:border-primary hover:text-primary'"
        @click="statusFilter = s"
      >
        {{ STATUS_LABEL[s] }}
        <span :class="['text-[10px] font-semibold px-1.5 py-0.5 rounded-full', statusFilter === s ? 'bg-white/25' : 'bg-[#F3F4F6]']">
          {{ items.filter((l: any) => s === "all" || l.status === s).length }}
        </span>
      </button>
      <select v-model="sortBy" class="ml-auto shrink-0 px-3 py-1.5 border-2 border-[#E5E7EB] rounded-full text-[12px] font-semibold bg-white">
        <option value="urutan">Posisi</option>
        <option value="nama">Nama (A-Z)</option>
        <option value="peserta">Peserta Terbanyak</option>
      </select>
    </div>

    <div v-if="visibleItems.length === 0" class="card p-10 text-center text-[#6B7280]">
      <i :class="['fas', items.length === 0 ? 'fa-trophy' : 'fa-search', 'text-5xl text-[#D1D5DB] mb-3 block']" />
      <strong class="block text-[#1F2937] text-base mb-1">
        {{ items.length === 0 ? "Belum ada lomba" : "Tidak ada lomba yang cocok" }}
      </strong>
      <p class="text-[13px]">
        {{ items.length === 0 ? 'Klik "Tambah Lomba" untuk mulai.' : "Coba kata kunci lain atau ubah filter." }}
      </p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
      <article
        v-for="l in visibleItems"
        :key="l.id"
        class="bg-white border border-[#E5E7EB] rounded-xl p-4 hover:border-primary hover:shadow-md transition-all flex flex-col gap-3"
      >
        <!-- Header -->
        <div class="flex items-start gap-3">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">
            {{ l.emoji }}
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-[15px] text-[#1F2937] leading-tight mb-1.5 break-words">{{ l.nama }}</h3>
            <div class="flex flex-wrap items-center gap-1.5">
              <button class="status-badge" :class="STATUS_BADGE[l.status]" @click="toggleStatus(l)">
                <i class="fas fa-circle" style="font-size: 6px" /> {{ l.status }}
              </button>
              <span v-if="l.faseEnabled" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide bg-gradient-to-r from-[#DBEAFE] via-[#FEF3C7] to-[#F3E8FF] text-[#581C87] border border-[#9333EA]/30" title="3 fase">
                <i class="fas fa-sitemap" /> 3 Fase
              </span>
              <span v-else class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide bg-gradient-to-r from-[#FCE0E0] to-[#FECACA] text-[#9D1010] border border-[#E11D1D]/30" title="2 fase">
                <i class="fas fa-stream" /> 2 Fase
              </span>
            </div>
          </div>
        </div>

        <p v-if="l.deskripsi" class="text-[12px] text-[#6B7280] leading-relaxed line-clamp-2">{{ l.deskripsi }}</p>

        <!-- Tags -->
        <div v-if="(l.kategoriEligible || []).length > 0" class="flex flex-col gap-1.5">
          <div
            v-for="g in groupKategoriByPublicName(
              (l.kategoriEligible || []).filter((kid: string) => !!kats.find((k: any) => k.id === kid)),
              new Map(kats.map((k: any) => [k.id, k]))
            )"
            :key="g.publicName"
            class="flex items-center gap-2 flex-wrap"
          >
            <KatTag
              :nama="g.publicName"
              :color-bg="(kats.find((k: any) => k.id === g.kategoriIds[0]) as any)?.colorBg"
              :color-text="(kats.find((k: any) => k.id === g.kategoriIds[0]) as any)?.colorText"
              :color-border="(kats.find((k: any) => k.id === g.kategoriIds[0]) as any)?.colorBorder"
            />
            <template v-for="j in uniqueJadwalsForGroup(l, g.kategoriIds)" :key="`${g.publicName}-${j.tanggal}`">
              <span class="text-[10px] text-[#6B7280] flex items-center gap-1">
                <i class="far fa-calendar text-primary" />
                <span class="font-semibold text-[#374151]">{{ formatTanggalLomba(j.tanggal, "short") }}</span>
                <span v-if="j.jam" class="text-[#9CA3AF]">· {{ j.jam }}</span>
              </span>
            </template>
          </div>
        </div>

        <!-- Stats -->
        <div class="flex items-center gap-4 py-2.5 border-t border-b border-[#F3F4F6] text-[12px] text-[#374151]">
          <div class="flex items-center gap-1.5">
            <i class="fas fa-users text-[#6B7280]" />
            <span><strong class="text-[#1F2937]">{{ counts[l.id] || 0 }}</strong> pendaftar</span>
          </div>
          <div class="flex items-center gap-1.5">
            <i class="fas fa-trophy text-[#6B7280]" />
            <span><strong class="text-[#1F2937]">{{ juaraSummary[l.id]?.totalJuara || 0 }}</strong> juara</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="row-actions flex-wrap">
          <NuxtLink :to="`/admin/peserta/${l.id}`" class="icon-action info" title="Lihat peserta">
            <i class="fas fa-users" />
          </NuxtLink>
          <NuxtLink :to="`/admin/lomba/${l.id}/juara`" class="icon-action success" title="Pilih juara">
            <i class="fas fa-trophy" />
          </NuxtLink>
          <button
            v-if="l.status === 'aktif'"
            type="button"
            class="icon-action"
            :class="juaraSummary[l.id]?.allReady ? 'success' : 'warn'"
            :title="juaraSummary[l.id]?.allReady ? 'Selesaikan perlombaan (juara siap)' : 'Selesaikan perlombaan (juara belum lengkap)'"
            :disabled="busy === l.id"
            @click="selesaikanLomba(l)"
          >
            <i class="fas fa-flag-checkered" />
          </button>
          <button
            v-else-if="l.status === 'selesai'"
            type="button"
            class="icon-action info"
            title="Buka kembali lomba (juara bisa diedit ulang)"
            :disabled="busy === l.id"
            @click="bukaKembaliLomba(l)"
          >
            <i class="fas fa-lock-open" />
          </button>
          <button class="icon-action" title="Edit" @click="openEdit(l)">
            <i class="fas fa-pen" />
          </button>
          <button class="icon-action danger ml-auto" title="Hapus" :disabled="busy === l.id" @click="deleteLomba(l)">
            <i class="fas fa-trash" />
          </button>
        </div>
      </article>
    </div>

    <!-- Lomba Modal -->
    <LombaModal v-if="creating || editing" :editing="editing" :kats="kats" :next-urutan="(items.length || 0) + 1" @close="closeModal" @save="saveLomba" />
  </AdminShell>
</template>

