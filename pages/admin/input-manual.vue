<script setup lang="ts">
// Admin Input Manual — Vue 3 port of app/admin/input-manual/input-manual-client.tsx.
// Compact version: form + peserta list, with category chip + lomba picker (collapses
// k_anak_l + k_anak_p into a single "Anak" option). Local state for rapid input.
import AdminShell from "~/components/AdminShell.vue";
import { useNotify } from "~/composables/useNotify";
import { getInitials } from "~/utils/format";
import { SUMBER as SUMBER_CONST } from "~/utils/constants";

useHead({ title: "Input Manual — Admin" });

const VIRTUAL_ANAK_ID = "_anak_virtual";

const { data, refresh } = await useFetch<any>("/api/admin/input-manual-data", { credentials: "include" });

const lombaList = computed(() => data.value?.lombaList ?? []);
const kats = computed(() => data.value?.kats ?? []);
const pesertaByLomba = computed<Record<number, any[]>>(() => data.value?.pesertaByLomba ?? {});
const sourceByLomba = computed<Record<number, any[]>>(() => data.value?.sourceByLomba ?? {});

const lombaId = ref<number | null>(null);
const selectedKatGroup = ref<string>("");
const expandedGroup = ref<string>("");
const nama = ref("");
const jenisKelamin = ref<"L" | "P">("L");
const kategoriId = ref<string>("");
const umur = ref<number | null>(null);
const submitting = ref(false);
const pesertaList = ref<any[]>([]);
const sortMode = ref<"nama" | "umur">("nama");

const notify = useNotify();

// Group lomba by collapsed kategori. Data-driven: groups are derived from
// actual kats in DB (kats.value), not hardcoded. This means the picker
// always reflects the admin's current settings — if they rename/remove
// a kategori, the picker updates automatically.
//
// Collapse rule: k_anak_l + k_anak_p → single virtual "Anak" group (same
// age range, gender split is a picker concern handled at the sub-kat
// level). All other kats get their own group, keyed by kat.id, displayed
// as the kat's own nama + age range. Sort by urutan asc.
type KatGroupKey = string;

interface KatGroup {
  key: KatGroupKey;
  label: string;
  ageRange: string;
  barColor: string;
  avatarBg: string;
  headerBg: string;
  // FontAwesome class for the avatar (e.g. "fa-child"). Fallback to
  // "fa-tag" if the underlying kategori has no icon set.
  icon: string;
  // The actual kategori ids in this group. For collapsed "Anak" this is
  // [k_anak_l, k_anak_p]; for solo groups it's [that kat's id].
  katIds: string[];
}

function formatAgeRange(min: number, max: number): string {
  if (max >= 999) return `${min}+ tahun`;
  return `${min}–${max} tahun`;
}

// Visual palette: cycle through these colors per group in display order.
// Each group gets a stable color based on its index, so adding/removing
// a kategori doesn't shuffle colors of existing groups.
const GROUP_PALETTE = [
  { barColor: "bg-blue-500", avatarBg: "bg-blue-100 text-blue-600", headerBg: "bg-blue-50" },
  { barColor: "bg-green-500", avatarBg: "bg-green-100 text-green-600", headerBg: "bg-green-50" },
  { barColor: "bg-orange-500", avatarBg: "bg-orange-100 text-orange-600", headerBg: "bg-orange-50" },
  { barColor: "bg-pink-500", avatarBg: "bg-pink-100 text-pink-600", headerBg: "bg-pink-50" },
  { barColor: "bg-purple-500", avatarBg: "bg-purple-100 text-purple-600", headerBg: "bg-purple-50" },
  { barColor: "bg-cyan-500", avatarBg: "bg-cyan-100 text-cyan-600", headerBg: "bg-cyan-50" },
  { barColor: "bg-amber-500", avatarBg: "bg-amber-100 text-amber-600", headerBg: "bg-amber-50" },
  { barColor: "bg-emerald-500", avatarBg: "bg-emerald-100 text-emerald-600", headerBg: "bg-emerald-50" },
];

const katGroups = computed<KatGroup[]>(() => {
  const sorted = [...kats.value].sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0));
  const groups: KatGroup[] = [];
  // Collapse k_anak_l + k_anak_p into a single "Anak" group.
  const sampleAnak = sorted.find((k) => k.id === "k_anak_l");
  if (sampleAnak) {
    groups.push({
      key: "__virtual_anak",
      label: "Anak",
      ageRange: formatAgeRange(sampleAnak.min, sampleAnak.max),
      ...GROUP_PALETTE[groups.length % GROUP_PALETTE.length],
      icon: sampleAnak.icon || "fa-child",
      katIds: ["k_anak_l", "k_anak_p"],
    });
  }
  // Other kats each get their own group.
  for (const k of sorted) {
    if (k.id === "k_anak_l" || k.id === "k_anak_p") continue;
    groups.push({
      key: k.id,
      label: k.nama,
      ageRange: formatAgeRange(k.min, k.max),
      ...GROUP_PALETTE[groups.length % GROUP_PALETTE.length],
      icon: k.icon || "fa-tag",
      katIds: [k.id],
    });
  }
  return groups;
});

const lombaByKatGroup = computed<Record<KatGroupKey, any[]>>(() => {
  const groups: Record<string, any[]> = {};
  for (const g of katGroups.value) groups[g.key] = [];
  for (const l of lombaList.value) {
    const eligible: string[] = l.kategoriEligible || [];
    // Place lomba in EVERY group whose katIds intersect eligible, so a lomba
    // spanning Anak + Remaja shows up in both pickers (no info hiding).
    for (const g of katGroups.value) {
      if (g.katIds.some((kid) => eligible.includes(kid))) {
        groups[g.key].push(l);
      }
    }
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0));
  }
  return groups;
});

// === Cascading dropdown: Kategori (group) → Lomba (filtered) ===
// Step 1: pick age group. Step 2: pick lomba in that group.
const availableGroups = computed(() =>
  katGroups.value.filter((g) => lombaByKatGroup.value[g.key]?.length > 0)
);

const filteredLombaList = computed(() => {
  if (!selectedKatGroup.value) return [];
  return lombaByKatGroup.value[selectedKatGroup.value] || [];
});

// When group changes, clear lomba if it's not in the new group
watch(selectedKatGroup, (newGroup) => {
  if (!newGroup) {
    lombaId.value = null;
    return;
  }
  const stillValid = filteredLombaList.value.some((l: any) => l.id === lombaId.value);
  if (!stillValid) lombaId.value = null;
});

// Auto-pick first lomba when group is selected and no lomba chosen yet
watch(filteredLombaList, (list) => {
  if (selectedKatGroup.value && list.length > 0 && lombaId.value === null) {
    // Prefer "aktif" lomba for first selection
    const firstAktif = list.find((l: any) => l.status === "aktif");
    lombaId.value = firstAktif ? firstAktif.id : list[0].id;
  }
}, { immediate: true });

const selectedLomba = computed(() => lombaList.value.find((l: any) => l.id === lombaId.value) || null);

const eligibleKats = computed(() => {
  if (!selectedLomba.value) return [];
  const set = new Set(selectedLomba.value.kategoriEligible);
  const base = kats.value.filter((k: any) => set.has(k.id));
  const hasL = base.some((k: any) => k.id === "k_anak_l");
  const hasP = base.some((k: any) => k.id === "k_anak_p");
  if (hasL && hasP) {
    const sample = base.find((k: any) => k.id === "k_anak_l");
    return [
      ...base.filter((k: any) => k.id !== "k_anak_l" && k.id !== "k_anak_p"),
      { ...sample, id: VIRTUAL_ANAK_ID, nama: "Anak" },
    ];
  }
  return base;
});

const selectedKat = computed(() => eligibleKats.value.find((k: any) => k.id === kategoriId.value) || null);
const skipUmur = computed(() => selectedKat.value?.autoAge ?? false);

// When lombaId changes, seed sub-kategori + umur and refresh the local
// peserta list in one place. Two side-effects, one watcher — keeps the
// form and list in lockstep with the picker.
watch(() => lombaId.value, () => {
  const first = eligibleKats.value[0];
  if (first) {
    kategoriId.value = first.id;
    umur.value = first.autoAge ? first.min : null;
  } else {
    kategoriId.value = "";
    umur.value = null;
  }
  pesertaList.value = (pesertaByLomba.value[lombaId.value!] || []).slice();
}, { immediate: true });

onMounted(() => {
  // Auto-pick the first available group; the watch on filteredLombaList
  // will then auto-pick the first lomba in that group. Also auto-expand
  // the first group so the user immediately sees its lomba list.
  const firstGroup = availableGroups.value[0];
  if (firstGroup) {
    selectedKatGroup.value = firstGroup.key;
    expandedGroup.value = firstGroup.key;
  }
});

// === Unified accordion picker ===
// Clicking a group header toggles its expansion. Tapping a lomba in the
// expanded list picks it and ensures the group is the active one (so the
// "Pilih Sub-Kategori" form below renders the right eligible sub-kats).
function toggleGroup(key: string) {
  if ((lombaByKatGroup.value[key] || []).length === 0) return; // empty group → no-op
  if (expandedGroup.value === key) {
    // Collapse current group; do NOT touch selectedKatGroup / lombaId,
    // so the user's form state stays intact when they "minimize" the picker.
    expandedGroup.value = "";
    return;
  }
  expandedGroup.value = key;
  selectedKatGroup.value = key;
}

function pickLomba(l: any, grpKey: string) {
  // Ensure group is the active one (in case lomba was picked while a
  // different card is visually expanded — shouldn't happen with the
  // current UI, but keeps the contract explicit).
  selectedKatGroup.value = grpKey;
  expandedGroup.value = grpKey;
  lombaId.value = l.id;
}

function selectKategori(id: string) {
  kategoriId.value = id;
  const k = eligibleKats.value.find((x: any) => x.id === id);
  if (k) umur.value = k.autoAge ? k.min : null;
  else umur.value = null;
}

// Age chips for the selected sub-kategori (e.g. 5..11 → [5,6,7,8,9,10,11])
const eligibleAges = computed(() => {
  if (!selectedKat.value || skipUmur.value) return [];
  const arr: number[] = [];
  for (let i = selectedKat.value.min; i <= selectedKat.value.max; i++) arr.push(i);
  return arr;
});

// Filter peserta list to match the currently selected sub-kategori + gender.
// When "Anak" (virtual) is selected, both k_anak_l + k_anak_p are eligible
// and the gender radio narrows to the matching one. Other sub-kategori
// (e.g. Remaja, Ibu-Ibu) already encode gender in the kategoriId, so the
// filter is just a kategoriId match. When no sub-kat is picked yet, show all.
const filteredPesertaList = computed(() => {
  if (!kategoriId.value) return pesertaList.value;
  if (kategoriId.value === VIRTUAL_ANAK_ID) {
    // For virtual "Anak", the gender radio maps 1:1 to a real kategoriId.
    // Use that exact id to filter — don't rely on jenisKelamin alone,
    // because other kats (e.g. k_dewasa_p = Ibu-Ibu) also have jenisKelamin="L"
    // and would otherwise leak into the "Anak Laki-laki" view.
    const targetKatId = jenisKelamin.value === "L" ? "k_anak_l" : "k_anak_p";
    return pesertaList.value.filter((p: any) => p.kategoriId === targetKatId);
  }
  return pesertaList.value.filter((p: any) => p.kategoriId === kategoriId.value);
});

// Human-readable label for the active filter, used in the list header
// so the admin sees at a glance why the list is narrower than the total.
const filterLabel = computed(() => {
  if (!kategoriId.value) return null;
  const k = eligibleKats.value.find((x: any) => x.id === kategoriId.value);
  const baseName = k?.nama ?? "—";
  if (kategoriId.value === VIRTUAL_ANAK_ID) {
    return `${baseName} (${jenisKelamin.value === "L" ? "Laki-laki" : "Perempuan"})`;
  }
  return baseName;
});

const sortedPeserta = computed(() => {
  const list = [...filteredPesertaList.value];
  if (sortMode.value === "umur") {
    list.sort((a, b) => a.umur - b.umur || a.nama.localeCompare(b.nama));
  } else {
    list.sort((a, b) => a.nama.localeCompare(b.nama));
  }
  return list;
});

async function submit(e: Event) {
  e.preventDefault();
  if (!nama.value.trim() || !lombaId.value || !kategoriId.value || (!skipUmur.value && !umur.value)) {
    notify.warning("Semua field wajib diisi");
    return;
  }
  submitting.value = true;
  try {
    const realKategoriId = kategoriId.value === VIRTUAL_ANAK_ID
      ? (jenisKelamin.value === "L" ? "k_anak_l" : "k_anak_p")
      : kategoriId.value;
    const res = await $fetch<{ id: number; nomor: string }>("/api/admin/pendaftar", {
      method: "POST",
      body: {
        nama: nama.value.trim(),
        jenisKelamin: jenisKelamin.value,
        kategoriId: realKategoriId,
        umur: umur.value ?? selectedKat.value?.min ?? 0,
        lombaId: lombaId.value,
        hadir: true,
      },
      credentials: "include",
    });
    notify.success(`Berhasil! Nomor: ${res.nomor}`);
    const newP = {
      id: res.id, nomor: res.nomor, nama: nama.value.trim(),
      umur: umur.value ?? selectedKat.value?.min ?? 0,
      jenisKelamin: jenisKelamin.value,
      kategoriId: realKategoriId,
      kategori: kats.value.find((k: any) => k.id === realKategoriId)?.nama ?? realKategoriId,
      hadir: true, sumber: "manual",
      createdAt: Math.floor(Date.now() / 1000),
    };
    pesertaList.value = [...pesertaList.value, newP];
    nama.value = "";
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } };
    notify.error(err.data?.statusMessage || "Gagal");
  } finally {
    submitting.value = false;
  }
}

async function deleteP(p: any) {
  const ok = await notify.confirm({ title: "Hapus Peserta", message: `Hapus ${p.nama} (${p.nomor})?`, variant: "danger", confirmText: "Hapus" });
  if (!ok) return;
  try {
    await $fetch(`/api/admin/pendaftar/${p.id}`, { method: "DELETE", credentials: "include" });
    pesertaList.value = pesertaList.value.filter((x) => x.id !== p.id);
    notify.success("Peserta dihapus");
  } catch {
    notify.error("Gagal hapus");
  }
}

// Copy from other lomba
const copySource = ref<any | null>(null);
const copying = ref(false);
const showCopyPicker = ref(false);
const copyPickerSearch = ref("");
const sourceLomba = computed(() => {
  if (!lombaId.value) return [];
  return sourceByLomba.value[lombaId.value] || [];
});
// Filtered list for the picker modal (case-insensitive name match).
const filteredSourceLomba = computed(() => {
  const q = copyPickerSearch.value.trim().toLowerCase();
  if (!q) return sourceLomba.value;
  return sourceLomba.value.filter((s: any) => s.nama.toLowerCase().includes(q));
});
// Pick a source from the picker: close picker, set copySource which
// triggers the existing confirm modal (two-step UX prevents misclicks).
function pickSource(s: any) {
  showCopyPicker.value = false;
  copyPickerSearch.value = "";
  copySource.value = s;
}
function openCopyPicker() {
  // Refresh first so the list reflects the latest target lomba state.
  copyPickerSearch.value = "";
  showCopyPicker.value = true;
}

async function runCopy() {
  if (!copySource.value || !selectedLomba.value) return;
  copying.value = true;
  try {
    const res = await $fetch<any>(`/api/admin/lomba/${selectedLomba.value.id}/copy-from`, {
      method: "POST",
      body: { sourceLombaId: copySource.value.id },
      credentials: "include",
    });
    notify.success(`${res.copied} disalin · ${res.skippedDuplicate} duplikat · ${res.skippedKategori} kategori skip`);
    copySource.value = null;
    await refresh();
    pesertaList.value = (pesertaByLomba.value[lombaId.value!] || []).slice();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } };
    notify.error(err.data?.statusMessage || "Gagal menyalin");
  } finally {
    copying.value = false;
  }
}
</script>

<template>
  <AdminShell title="Input Manual Peserta" breadcrumb="Input Manual" active-nav="/admin/input-manual">

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
      <!-- Left: form -->
      <div class="lg:col-span-2 space-y-5">
        <!-- Lomba confirmation headline — sticks at top of form column so the
             admin always knows exactly which lomba they're about to add
             participants to. Picker sits right below for 1-tap change. -->
        <div
          v-if="selectedLomba"
          :key="selectedLomba.id"
          class="rounded-2xl overflow-hidden border-2 shadow-sm transition-all"
          :class="[
            selectedLomba.status === 'aktif'
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
              : selectedLomba.status === 'selesai'
                ? 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200'
                : 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200',
          ]"
          role="status"
          aria-live="polite"
        >
          <!-- Top color bar -->
          <div
            :class="[
              'h-1.5',
              selectedLomba.status === 'aktif'
                ? 'bg-green-500'
                : selectedLomba.status === 'selesai'
                  ? 'bg-gray-400'
                  : 'bg-amber-500',
            ]"
          />

          <div class="p-4">
            <div class="flex items-start gap-3">
              <!-- Big emoji -->
              <div class="text-[34px] flex-shrink-0 leading-none mt-0.5" aria-hidden="true">
                {{ selectedLomba.emoji || "🎯" }}
              </div>

              <!-- Title + subtitle -->
              <div class="flex-1 min-w-0">
                <div class="text-[10px] font-extrabold text-[#6B7280] uppercase tracking-wider mb-0.5">
                  <i class="fas fa-bullseye text-[9px]" /> Sedang menambah peserta untuk
                </div>
                <div class="text-[18px] font-extrabold text-[#1F2937] leading-tight break-words">
                  {{ selectedLomba.nama }}
                </div>
              </div>

              <!-- Status pill -->
              <span
                :class="[
                  'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 flex items-center gap-1',
                  selectedLomba.status === 'aktif'
                    ? 'bg-green-500 text-white'
                    : selectedLomba.status === 'selesai'
                      ? 'bg-gray-500 text-white'
                      : 'bg-amber-500 text-white',
                ]"
              >
                <i
                  :class="[
                    'fas text-[8px]',
                    selectedLomba.status === 'aktif'
                      ? 'fa-circle-check'
                      : selectedLomba.status === 'selesai'
                        ? 'fa-flag-checkered'
                        : 'fa-pen-to-square',
                  ]"
                  aria-hidden="true"
                />
                {{ selectedLomba.status }}
              </span>
            </div>

            <!-- Quick stats row -->
            <div class="mt-3 pt-3 border-t border-black/5 flex items-center gap-x-4 gap-y-1 text-[11px] text-[#4B5563] flex-wrap">
              <div class="inline-flex items-center gap-1.5">
                <i class="fas fa-users text-[#6B7280]" aria-hidden="true" />
                <strong class="text-[#1F2937]">{{ pesertaList.length }}</strong>
                <span>peserta saat ini</span>
              </div>
              <div class="inline-flex items-center gap-1.5">
                <i class="fas fa-tag text-[#6B7280]" aria-hidden="true" />
                <strong class="text-[#1F2937]">{{ eligibleKats.length }}</strong>
                <span>sub-kategori eligible</span>
              </div>
              <div
                v-if="selectedLomba.status !== 'aktif'"
                class="inline-flex items-center gap-1.5 text-amber-700 font-semibold sm:ml-auto"
              >
                <i class="fas fa-triangle-exclamation text-[10px]" aria-hidden="true" />
                <span>{{ selectedLomba.status === 'selesai' ? 'Lomba sudah selesai' : 'Lomba masih draft' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state when no lomba picked yet -->
        <div
          v-else
          class="rounded-2xl border-2 border-dashed border-[#E5E7EB] bg-[#F9FAFB] p-4"
        >
          <div class="flex items-center gap-3 text-[#6B7280]">
            <div class="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 border border-[#E5E7EB]">
              <i class="fas fa-arrow-up text-base" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[13px] font-bold text-[#1F2937]">Pilih lomba dulu</div>
              <div class="text-[11px]">Buka kategori di bawah untuk mulai menambah peserta</div>
            </div>
          </div>
        </div>

        <div class="card p-6">
          <h3 class="text-base font-bold mb-1">📝 Data Peserta</h3>
          <div class="text-xs text-[#6B7280] mb-5">Semua field bertanda <span class="text-primary">*</span> wajib diisi</div>

          <form class="space-y-4" @submit="submit">
            <!-- Step 1 + 2: Pilih Kategori & Lomba — UNIFIED ACCORDION -->
            <div>
              <label class="label">
                <span class="inline-flex items-center gap-1.5">
                  <i class="fas fa-layer-group text-primary text-[11px]" />
                  Pilih Kategori & Lomba <span class="text-primary">*</span>
                </span>
              </label>
              <div class="text-[11px] text-[#6B7280] mb-2">
                Ketuk kategori untuk membuka daftar lomba di dalamnya
              </div>
              <div class="space-y-2">
                <div
                  v-for="grp in katGroups"
                  :key="grp.key"
                  class="rounded-xl border-2 overflow-hidden transition-all"
                  :class="[
                    selectedKatGroup === grp.key
                      ? 'border-primary shadow-sm'
                      : 'border-[#E5E7EB] bg-white',
                    lombaByKatGroup[grp.key].length === 0 && 'opacity-50',
                  ]"
                >
                  <!-- Header (clickable, toggles expansion) -->
                  <button
                    type="button"
                    class="w-full flex items-stretch gap-0 p-0 text-left transition-all disabled:cursor-not-allowed"
                    :class="[
                      expandedGroup === grp.key
                        ? grp.headerBg
                        : 'bg-white hover:bg-[#F9FAFB]',
                    ]"
                    :disabled="lombaByKatGroup[grp.key].length === 0"
                    :aria-expanded="expandedGroup === grp.key"
                    :aria-controls="`acc-panel-${grp.key}`"
                    @click="toggleGroup(grp.key)"
                  >
                    <!-- Colored left bar (vertical accent) -->
                    <div
                      :class="['w-1.5 self-stretch rounded-full flex-shrink-0', grp.barColor]"
                      aria-hidden="true"
                    />
                    <!-- Avatar circle -->
                    <div
                      :class="['w-10 h-10 my-auto ml-3 rounded-full flex items-center justify-center text-lg flex-shrink-0', grp.avatarBg]"
                      aria-hidden="true"
                    >
                      <i :class="['fas', grp.icon]" />
                    </div>
                    <!-- Name + age range -->
                    <div class="flex-1 min-w-0 py-3 pl-3">
                      <div class="text-[14px] font-extrabold text-[#1F2937] uppercase tracking-wide leading-tight">
                        {{ grp.label }}
                      </div>
                      <div class="text-[11px] text-[#6B7280] leading-tight">
                        {{ grp.ageRange }}
                      </div>
                    </div>
                    <!-- Count badge -->
                    <div
                      class="my-auto mr-2 flex items-center gap-1 px-2.5 py-1 bg-white border border-[#E5E7EB] rounded-full flex-shrink-0"
                      aria-hidden="true"
                    >
                      <i class="fas fa-trophy text-amber-500 text-[10px]" />
                      <span class="text-[11px] font-semibold text-[#1F2937]">
                        {{ lombaByKatGroup[grp.key].length }} lomba
                      </span>
                    </div>
                    <!-- Chevron -->
                    <div class="my-auto pr-3 flex items-center" aria-hidden="true">
                      <i
                        :class="[
                          'fas text-[#6B7280] text-[11px] transition-transform duration-200',
                          expandedGroup === grp.key
                            ? 'fa-chevron-up rotate-180'
                            : 'fa-chevron-down',
                        ]"
                      />
                    </div>
                  </button>

                  <!-- Expanded: lomba list -->
                  <div
                    v-if="expandedGroup === grp.key && lombaByKatGroup[grp.key].length > 0"
                    :id="`acc-panel-${grp.key}`"
                    class="border-t border-[#E5E7EB] bg-[#F9FAFB] p-2.5 space-y-2"
                  >
                    <button
                      v-for="l in lombaByKatGroup[grp.key]"
                      :key="l.id"
                      type="button"
                      :class="[
                        'group w-full flex items-center gap-3 text-left rounded-xl border-2 px-3 py-2.5 transition-all active:scale-[0.99] relative overflow-hidden',
                        lombaId === l.id
                          ? 'border-primary bg-primary-light shadow-md'
                          : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:shadow-sm',
                      ]"
                      :aria-pressed="lombaId === l.id"
                      @click="pickLomba(l, grp.key)"
                    >
                      <!-- Left accent stripe — only visible when selected -->
                      <div
                        v-if="lombaId === l.id"
                        class="absolute left-0 top-0 bottom-0 w-1.5 bg-primary"
                        aria-hidden="true"
                      />

                      <!-- Avatar -->
                      <div
                        :class="[
                          'w-12 h-12 rounded-xl flex items-center justify-center text-[22px] flex-shrink-0 transition-colors',
                          lombaId === l.id
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-gradient-to-br from-amber-100 to-orange-100',
                        ]"
                        aria-hidden="true"
                      >
                        {{ l.emoji }}
                      </div>

                      <!-- Content: nama + status pill + meta row -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span
                            :class="[
                              'text-[14px] font-extrabold leading-tight truncate',
                              lombaId === l.id ? 'text-primary' : 'text-[#1F2937]',
                            ]"
                          >
                            {{ l.nama }}
                          </span>
                          <!-- Status pill — only for non-aktif to reduce noise -->
                          <span
                            v-if="l.status === 'selesai'"
                            class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-gray-200 text-gray-600 flex-shrink-0"
                          >
                            Selesai
                          </span>
                          <span
                            v-else-if="l.status === 'draft'"
                            class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 flex-shrink-0"
                          >
                            Draft
                          </span>
                        </div>
                        <!-- Meta row: peserta count + kategori count -->
                        <div
                          :class="[
                            'flex items-center gap-3 mt-1 text-[11px]',
                            lombaId === l.id ? 'text-primary-dark' : 'text-[#6B7280]',
                          ]"
                        >
                          <span class="inline-flex items-center gap-1">
                            <i class="fas fa-users text-[9px]" aria-hidden="true" />
                            <strong :class="lombaId === l.id ? 'text-primary' : 'text-[#374151]'">
                              {{ pesertaByLomba[l.id]?.length || 0 }}
                            </strong>
                            <span>peserta</span>
                          </span>
                          <span
                            v-if="l.kategoriEligible?.length"
                            class="inline-flex items-center gap-1"
                          >
                            <i class="fas fa-tag text-[9px]" aria-hidden="true" />
                            <span>{{ l.kategoriEligible.length }} kat</span>
                          </span>
                        </div>
                      </div>

                      <!-- Right side: check or chevron -->
                      <div
                        v-if="lombaId === l.id"
                        class="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 shadow-sm"
                        aria-hidden="true"
                      >
                        <i class="fas fa-check text-[12px]" />
                      </div>
                      <i
                        v-else
                        class="fas fa-chevron-right text-[#9CA3AF] text-[11px] flex-shrink-0 group-hover:text-[#6B7280] transition-colors"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label class="label">
                <span class="inline-flex items-center gap-1.5">
                  <i class="fas fa-tag text-primary text-[11px]" />
                  Pilih Sub-Kategori <span class="text-primary">*</span>
                </span>
              </label>
              <div class="text-[11px] text-[#6B7280] mb-1.5">Sub-kategori yang eligible untuk lomba ini (sesuai jenis kelamin & umur)</div>
              <div class="flex flex-col gap-2">
                <button
                  v-for="k in eligibleKats"
                  :key="k.id"
                  type="button"
                  class="w-full px-3 py-2.5 border-2 rounded text-[13px] font-semibold text-left flex items-center gap-2 transition-all"
                  :class="kategoriId === k.id ? 'bg-primary-light border-primary text-primary' : 'bg-white border-[#E5E7EB] text-[#1F2937]'"
                  @click="selectKategori(k.id)"
                >
                  <div :class="['w-7 h-7 rounded-full flex items-center justify-center text-[10px] flex-shrink-0', kategoriId === k.id ? 'bg-primary text-white' : 'bg-[#F9FAFB] text-[#6B7280]']">
                    <i class="fas fa-check" />
                  </div>
                  <div class="flex-1">
                    <div class="font-bold">{{ k.nama }}</div>
                    <div :class="['text-[10px] font-normal', kategoriId === k.id ? 'text-primary-dark' : 'text-[#6B7280]']">
                      {{ k.autoAge ? `Usia ${k.min}+ tahun · otomatis` : `Usia ${k.min}-${k.max} tahun` }}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div v-if="!skipUmur">
              <label class="label">
                <span class="inline-flex items-center gap-1.5">
                  <i class="fas fa-cake-candles text-primary text-[11px]" />
                  Umur <span class="text-primary">*</span>
                </span>
              </label>
              <div v-if="selectedKat" class="text-[11px] text-[#6B7280] mb-1.5">
                Pilih umur ({{ eligibleAges.length }} opsi · {{ selectedKat.min }}–{{ selectedKat.max }} tahun)
              </div>
              <div v-if="selectedKat" class="grid grid-cols-5 sm:grid-cols-7 gap-1.5">
                <button
                  v-for="a in eligibleAges"
                  :key="a"
                  type="button"
                  :class="[
                    'h-11 rounded-lg border-2 flex items-center justify-center font-bold text-base transition-all active:scale-95',
                    umur === a
                      ? 'bg-primary border-primary text-white shadow-md'
                      : 'bg-white border-[#E5E7EB] text-[#1F2937] hover:border-primary hover:bg-primary-light'
                  ]"
                  @click="umur = a"
                >
                  {{ a }}
                </button>
              </div>
            </div>
            <div v-else-if="selectedKat" class="bg-[#FCE0E0] border border-[#FBE0E0] rounded-lg p-2.5 flex items-start gap-2">
              <i class="fas fa-circle-info text-[#9D1010] mt-0.5 text-[12px]" />
              <div class="text-[11px] text-[#9D1010]">
                Otomatis usia {{ selectedKat.min }} tahun ke atas
              </div>
            </div>

            <div>
              <label class="label">Nama Lengkap <span class="text-primary">*</span></label>
              <input v-model="nama" type="text" placeholder="Contoh: Budi Santoso" class="input" />
            </div>

            <div>
              <label class="label">Jenis Kelamin <span class="text-primary">*</span></label>
              <div class="grid grid-cols-2 gap-2">
                <button type="button" :class="['px-3 py-2.5 border-2 rounded font-semibold text-[13px] flex items-center justify-center gap-2', jenisKelamin === 'L' ? 'bg-primary border-primary text-white' : 'bg-white border-[#E5E7EB] text-[#1F2937]']" @click="jenisKelamin = 'L'">
                  <i class="fas fa-mars" /> Laki-laki
                </button>
                <button type="button" :class="['px-3 py-2.5 border-2 rounded font-semibold text-[13px] flex items-center justify-center gap-2', jenisKelamin === 'P' ? 'bg-primary border-primary text-white' : 'bg-white border-[#E5E7EB] text-[#1F2937]']" @click="jenisKelamin = 'P'">
                  <i class="fas fa-venus" /> Perempuan
                </button>
              </div>
            </div>

            <button type="submit" :disabled="submitting" class="btn btn-primary btn-block disabled:opacity-60">
              <i v-if="submitting" class="fas fa-spinner fa-spin" />
              <i v-else class="fas fa-plus" />
              {{ submitting ? "Menambahkan..." : "Tambah Peserta" }}
            </button>
          </form>
        </div>

        <!-- Copy from other lomba — trigger button (opens picker modal) -->
        <button
          v-if="sourceLomba.length > 0"
          type="button"
          class="card p-4 w-full text-left hover:border-primary transition-colors"
          @click="openCopyPicker"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
              <i class="fas fa-copy" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[13px] font-bold text-[#1F2937] flex items-center gap-1.5">
                <i class="fas fa-list-ul text-[10px] text-[#9CA3AF]" />
                Salin Peserta dari Lomba Lain
              </div>
              <div class="text-[11px] text-[#6B7280]">
                {{ sourceLomba.length }} lomba dengan kategori sama · siap dipilih
              </div>
            </div>
            <i class="fas fa-chevron-right text-[#9CA3AF] text-[12px]" />
          </div>
        </button>
        <div v-else-if="lombaId" class="card p-3 text-[11px] text-[#9CA3AF] text-center italic">
          Tidak ada lomba lain dengan kategori sama untuk disalin
        </div>
      </div>

      <!-- Right: peserta list -->
      <div class="lg:col-span-3">
        <div class="card p-5">
          <div class="flex items-center gap-2 mb-3">
            <h3 class="text-sm font-bold flex-1">
              <i class="fas fa-clipboard-list text-primary" /> Daftar Peserta
              <span class="text-[#6B7280] font-normal">
                ({{ sortedPeserta.length }}<template v-if="filterLabel && sortedPeserta.length !== pesertaList.length">/{{ pesertaList.length }}</template>)
              </span>
            </h3>
            <div class="flex border border-[#E5E7EB] rounded overflow-hidden">
              <button :class="['px-2.5 py-1 text-[11px] font-semibold', sortMode === 'nama' ? 'bg-primary text-white' : 'bg-white text-[#6B7280]']" @click="sortMode = 'nama'">A-Z</button>
              <button :class="['px-2.5 py-1 text-[11px] font-semibold', sortMode === 'umur' ? 'bg-primary text-white' : 'bg-white text-[#6B7280]']" @click="sortMode = 'umur'">Umur</button>
            </div>
          </div>
          <!-- Active filter indicator: shows why the list is narrower than the total.
               Clicking the X clears the filter (resets to "show all" until a new
               sub-kat is picked). -->
          <div
            v-if="filterLabel"
            class="flex items-center gap-2 mb-3 -mt-1 px-2.5 py-1.5 bg-primary-light border border-primary/30 rounded-lg"
          >
            <i class="fas fa-filter text-primary text-[10px]" />
            <span class="text-[11px] text-primary-dark flex-1">
              Filter: <strong>{{ filterLabel }}</strong>
            </span>
            <button
              type="button"
              class="text-primary hover:text-primary-dark text-[12px] flex items-center gap-1"
              title="Lihat semua peserta"
              @click="kategoriId = ''"
            >
              <i class="fas fa-xmark" /> Lihat semua
            </button>
          </div>
          <p v-else class="text-[11px] text-[#6B7280] mb-3 -mt-1">
            Pilih sub-kategori di samping untuk memfilter daftar · Pending/ditolak di <NuxtLink to="/admin/approval" class="text-primary underline font-semibold">Approval</NuxtLink>
          </p>
          <div v-if="sortedPeserta.length === 0 && !filterLabel" class="text-center py-8 text-[#6B7280] text-[13px]">
            <i class="fas fa-user-plus text-3xl text-[#D1D5DB] mb-2 block" />
            <strong>Belum ada peserta disetujui</strong>
            <p class="text-[11px] mt-1">Tambah peserta pakai form di samping — yang baru ditambahkan otomatis masuk sini</p>
          </div>
          <div v-else-if="sortedPeserta.length === 0" class="text-center py-8 text-[#6B7280] text-[13px]">
            <i class="fas fa-filter-circle-xmark text-3xl text-[#D1D5DB] mb-2 block" />
            <strong>Tidak ada {{ filterLabel }} terdaftar</strong>
            <p class="text-[11px] mt-1">Belum ada peserta disetujui untuk kategori + gender ini</p>
          </div>
          <div v-else class="space-y-2 max-h-[60vh] overflow-y-auto">
            <div v-for="p in sortedPeserta" :key="p.id" class="pendaftar-card" :style="{ '--accent': p.sumber === 'manual' ? '#F59E0B' : '#E5E7EB' }">
              <div class="pc-top">
                <div class="pc-avatar">{{ getInitials(p.nama) }}</div>
                <div class="pc-identity">
                  <div class="pc-nama">{{ p.nama }}</div>
                  <div class="text-[11px] text-[#6B7280] font-mono">{{ p.umur }} th · {{ p.jenisKelamin === "L" ? "L" : "P" }}</div>
                </div>
                <div class="pc-actions">
                  <button class="icon-action reject" title="Hapus" @click="deleteP(p)">
                    <i class="fas fa-trash" />
                  </button>
                </div>
              </div>
              <div class="pc-meta">
                <span class="pc-meta-item"><i class="fas fa-tag" /> {{ p.kategori }}</span>
                <span class="pc-meta-item"><i :class="['fas', SUMBER_CONST[p.sumber as 'publik' | 'manual']?.icon || 'fas fa-user']" /> {{ p.sumber }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Copy confirm modal -->
    <Teleport to="body">
      <div v-if="copySource" class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50" @click="copySource = null">
        <div class="bg-white rounded-2xl max-w-[420px] w-full overflow-hidden" @click.stop>
          <div class="p-5 flex items-start gap-3">
            <div class="w-10 h-10 rounded-full bg-[#DBEAFE] text-[#1E40AF] flex items-center justify-center flex-shrink-0">
              <i class="fas fa-copy text-lg" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-bold text-[#1F2937]">Salin Peserta?</h3>
              <p class="text-[13px] text-[#6B7280] mt-1 leading-relaxed">
                Salin peserta <strong>{{ copySource.nama }}</strong> ke lomba <strong>{{ selectedLomba?.nama }}</strong>?
                Hanya peserta dengan kategori yang eligible yang akan disalin.
              </p>
            </div>
          </div>
          <div class="p-3 bg-[#F9FAFB] flex gap-2 justify-end">
            <button class="btn btn-secondary" style="width: auto" @click="copySource = null">Batal</button>
            <button class="btn btn-primary" style="width: auto" :disabled="copying" @click="runCopy">
              <i v-if="copying" class="fas fa-spinner fa-spin" />
              <i v-else class="fas fa-copy" />
              Salin
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Copy source picker modal — lists other lomba with matching kategori -->
    <Teleport to="body">
      <div v-if="showCopyPicker" class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50" @click="showCopyPicker = false">
        <div class="bg-white rounded-2xl max-w-[500px] w-full max-h-[80vh] overflow-hidden flex flex-col" @click.stop>
          <!-- Header -->
          <div class="p-5 border-b border-[#E5E7EB] flex items-start justify-between gap-3 flex-shrink-0">
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-bold text-[#1F2937] flex items-center gap-2">
                <i class="fas fa-copy text-primary" /> Pilih Lomba Sumber
              </h3>
              <p class="text-[12px] text-[#6B7280] mt-1 leading-relaxed">
                Peserta akan disalin ke <strong>{{ selectedLomba?.nama }}</strong>. Hanya peserta dengan kategori yang eligible.
              </p>
            </div>
            <button class="w-8 h-8 rounded-full bg-[#F9FAFB] text-[#6B7280] flex items-center justify-center flex-shrink-0 hover:bg-[#E5E7EB]" aria-label="Tutup" @click="showCopyPicker = false">
              <i class="fas fa-xmark" />
            </button>
          </div>
          <!-- Search bar -->
          <div class="p-3 border-b border-[#E5E7EB] flex-shrink-0">
            <div class="relative">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[12px]" />
              <input
                v-model="copyPickerSearch"
                type="text"
                placeholder="Cari nama lomba..."
                aria-label="Cari nama lomba"
                class="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E5E7EB] rounded-lg focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <!-- List -->
          <div class="flex-1 overflow-y-auto p-3 space-y-1.5">
            <button
              v-for="s in filteredSourceLomba"
              :key="s.id"
              type="button"
              class="w-full text-left p-3 border border-[#E5E7EB] rounded-lg hover:border-primary hover:bg-primary-light transition-colors flex items-center gap-2.5"
              @click="pickSource(s)"
            >
              <div class="text-xl flex-shrink-0">{{ s.emoji }}</div>
              <div class="flex-1 min-w-0">
                <div class="text-[13px] font-semibold text-[#1F2937] truncate">{{ s.nama }}</div>
                <div class="text-[10px] text-[#6B7280]">{{ s.count }} peserta · siap disalin</div>
              </div>
              <i class="fas fa-chevron-right text-[#9CA3AF] text-[10px] flex-shrink-0" />
            </button>
            <div v-if="filteredSourceLomba.length === 0" class="text-center py-10 text-[#6B7280] text-[12px]">
              <i class="fas fa-search text-2xl text-[#D1D5DB] mb-2 block" />
              <strong>Tidak ada lomba yang cocok</strong>
              <p v-if="copyPickerSearch" class="text-[11px] mt-1">Coba kata kunci lain</p>
            </div>
          </div>
          <!-- Footer hint -->
          <div class="p-3 border-t border-[#E5E7EB] text-[11px] text-[#6B7280] text-center flex-shrink-0 bg-[#F9FAFB]">
            <i class="fas fa-info-circle" /> Nama duplikat akan dilewati otomatis
          </div>
        </div>
      </div>
    </Teleport>
  </AdminShell>
</template>

