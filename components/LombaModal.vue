<script setup lang="ts">
// LombaModal — Vue 3 port of app/admin/lomba/lomba-modal.tsx.
// Form modal for create/edit lomba. Collapses k_anak_l + k_anak_p into a single "Anak" block.
import { displayKategoriName, dateStrToTs, tsToUtcDateStr } from "~/utils/format";
import { APP_CONFIG } from "~/utils/constants";

const props = defineProps<{
  editing: any | null;
  kats: any[];
  nextUrutan: number;
}>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", data: any): void;
}>();

const EMOJI_OPTIONS = ["🏆", "🍪", "🏃", "🪢", "🌴", "💧", "🎤", "🪑", "🥚", "🎯", "🏐", "🎲", "🎨", "🎭", "📚", "🚌"];
const MAX_PJ_PER_KAT = APP_CONFIG.MAX_PJ_PER_KAT;

const nama = ref(props.editing?.nama || "");
const emoji = ref(props.editing?.emoji || "🏆");
const deskripsi = ref(props.editing?.deskripsi || "");
const syarat = ref((props.editing?.syarat || []).join("\n"));
const kategoriEligible = ref<string[]>(props.editing?.kategoriEligible || []);
const pjByKategori = ref<Record<string, any[]>>(
  Object.fromEntries(
    Object.entries(props.editing?.pjByKategori || {})
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => [k, (v as any[]).filter((p) => p && typeof p.nama === "string")])
  )
);
const status = ref(props.editing?.status || "aktif");
const urutan = ref(props.editing?.urutan ?? props.nextUrutan);
// NOTE: finalisCount removed from form (2026-08-11) — finalis per kategori is
// determined dynamically by admin picking "lolos/gugur" in Juara page, not a
// fixed number. Backend still uses the DB column with default 5 for legacy juara
// validation, but admin no longer needs to think about this number.
const pendaftaranDibuka = ref(props.editing?.pendaftaranDibuka ?? true);
const faseEnabled = ref(props.editing?.faseEnabled ?? false);
const jadwalByKategori = ref<Record<string, any>>(
  Object.fromEntries(
    Object.entries(props.editing?.jadwalByKategori || {})
      .filter(([, v]) => v && typeof v === "object" && ((v as any).tanggal !== null || (v as any).jam !== null))
      .map(([k, v]) => [k, { kategoriId: k, tanggal: (v as any).tanggal ?? null, jam: (v as any).jam ?? null }])
  )
);
const saving = ref(false);
const err = ref("");
const namaInputRef = ref<HTMLInputElement | null>(null);

const groups = computed(() => {
  const seen = new Map<string, { publicName: string; katIds: string[]; sampleKat?: any }>();
  const ordered: any[] = [];
  for (const katId of kategoriEligible.value) {
    const sample = props.kats.find((k) => k.id === katId);
    const publicName = displayKategoriName(katId, sample);
    let g = seen.get(publicName);
    if (!g) {
      g = { publicName, katIds: [katId], sampleKat: sample };
      seen.set(publicName, g);
      ordered.push(g);
    } else {
      g.katIds.push(katId);
    }
  }
  return ordered;
});

const orderedKats = computed(() => {
  // Sort by urutan so the picker shows the same order as the public page
  return [...props.kats].sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0));
});

function toggleKat(id: string) {
  if (kategoriEligible.value.includes(id)) {
    kategoriEligible.value = kategoriEligible.value.filter((x) => x !== id);
    const { [id]: _, ...restP } = pjByKategori.value;
    pjByKategori.value = restP;
    const { [id]: _j, ...restJ } = jadwalByKategori.value;
    jadwalByKategori.value = restJ;
  } else {
    kategoriEligible.value = [...kategoriEligible.value, id];
    pjByKategori.value = { ...pjByKategori.value, [id]: [{ nama: "", kontak: null }] };
  }
}

function addPjForGroup(katIds: string[]) {
  const next = { ...pjByKategori.value };
  for (const katId of katIds) {
    const list = next[katId] || [];
    if (list.length >= MAX_PJ_PER_KAT) continue;
    next[katId] = [...list, { nama: "", kontak: null }];
  }
  pjByKategori.value = next;
}

function removePjForGroup(katIds: string[], index: number) {
  const canRemove = katIds.every((kid) => (pjByKategori.value[kid] || []).length > 1);
  if (!canRemove) return;
  const next = { ...pjByKategori.value };
  for (const katId of katIds) {
    next[katId] = (next[katId] || []).filter((_, i) => i !== index);
  }
  pjByKategori.value = next;
}

function setPjForGroup(katIds: string[], index: number, field: "nama" | "kontak", value: string) {
  const next = { ...pjByKategori.value };
  for (const katId of katIds) {
    const list = next[katId] || [];
    next[katId] = list.map((p: any, i: number) =>
      i === index
        ? { nama: field === "nama" ? value : p.nama, kontak: field === "kontak" ? (value.trim() || null) : p.kontak }
        : p
    );
  }
  pjByKategori.value = next;
}

function setJadwalForGroup(katIds: string[], field: "tanggal" | "jam", value: string | null) {
  const next = { ...jadwalByKategori.value };
  for (const katId of katIds) {
    const cur = next[katId] || { kategoriId: katId, tanggal: null, jam: null };
    const j: any = { ...cur, kategoriId: katId };
    if (field === "tanggal") {
      j.tanggal = value ? dateStrToTs(value) : null;
    } else {
      j.jam = value || null;
    }
    if (j.tanggal === null && j.jam === null) {
      delete next[katId];
    } else {
      next[katId] = j;
    }
  }
  jadwalByKategori.value = next;
}

function formatRange(min: number, max: number): string {
  if (max >= 999) return `${min} tahun ke atas`;
  return `${min}–${max} tahun`;
}

async function submit() {
  err.value = "";
  if (!nama.value.trim()) {
    err.value = "Nama lomba wajib diisi";
    namaInputRef.value?.focus();
    return;
  }
  if (kategoriEligible.value.length === 0) {
    err.value = "Pilih minimal 1 kategori";
    return;
  }
  for (const katId of kategoriEligible.value) {
    const list = pjByKategori.value[katId] || [];
    const name = displayKategoriName(katId, props.kats.find((k) => k.id === katId));
    if (list.length === 0) {
      err.value = `Kategori "${name}" minimal 1 PJ`;
      return;
    }
    for (const pj of list) {
      if (!pj.nama.trim()) {
        err.value = `Semua nama PJ di kategori "${name}" wajib diisi`;
        return;
      }
    }
  }
  saving.value = true;
  try {
    const pjList: any[] = [];
    for (const katId of kategoriEligible.value) {
      for (const pj of pjByKategori.value[katId] || []) {
        pjList.push({ kategoriId: katId, pjNama: pj.nama.trim(), pjKontak: pj.kontak || null });
      }
    }
    const jadwalList: any[] = [];
    for (const katId of kategoriEligible.value) {
      const j = jadwalByKategori.value[katId];
      if (j && (j.tanggal !== null || j.jam !== null)) jadwalList.push(j);
    }
    emit("save", {
      id: props.editing?.id,
      nama: nama.value.trim(),
      emoji: emoji.value,
      deskripsi: deskripsi.value.trim() || null,
      syarat: syarat.value.split("\n").map((s: string) => s.trim()).filter(Boolean),
      kategoriEligible: kategoriEligible.value,
      pjList,
      jadwalList,
      status: status.value,
      urutan: urutan.value,
      // Send default 5 to satisfy DB NOT NULL constraint; finalis is no longer
      // user-controlled (see NOTE near finalisCount ref above).
      finalisCount: 5,
      pendaftaranDibuka: pendaftaranDibuka.value,
      faseEnabled: faseEnabled.value,
    });
  } finally {
    saving.value = false;
  }
}

// Status options as visual cards (icon + label + description)
const statusOptions = [
  { value: "aktif", label: "Aktif", icon: "fa-circle-check", desc: "Publik bisa lihat & daftar" },
  { value: "draft", label: "Draft", icon: "fa-file-pen", desc: "Tersembunyi dari publik" },
  { value: "selesai", label: "Selesai", icon: "fa-trophy", desc: "Lomba sudah berakhir" },
];
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click="emit('close')">
      <div
        class="bg-white rounded-2xl max-w-[640px] w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        @click.stop
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-primary-light to-white">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-white border-2 border-primary text-primary flex items-center justify-center text-xl">
              {{ emoji || "🏆" }}
            </div>
            <div>
              <h3 class="text-base font-bold text-[#1F2937]">{{ editing ? "Edit Lomba" : "Tambah Lomba" }}</h3>
              <p class="text-[11px] text-[#6B7280]">{{ editing ? "Ubah detail lomba ini" : "Lomba baru untuk kampung" }}</p>
            </div>
          </div>
          <button
            class="w-9 h-9 rounded-full bg-white border border-[#E5E7EB] text-[#6B7280] flex items-center justify-center hover:bg-[#F3F4F6] hover:text-[#1F2937] transition-colors"
            @click="emit('close')"
            aria-label="Tutup"
          >
            <i class="fas fa-xmark" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto space-y-6 flex-1">
          <!-- =========================================================
               SECTION 1: Identitas Lomba
               ========================================================= -->
          <section>
            <div class="flex items-center gap-2 mb-3">
              <div class="w-6 h-6 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">1</div>
              <h4 class="text-[13px] font-bold text-[#1F2937] uppercase tracking-wide">Identitas Lomba</h4>
            </div>

            <div class="space-y-3 pl-8">
              <div>
                <label class="flex items-center gap-1 text-[12px] font-semibold text-[#374151] mb-1.5">
                  Nama Lomba <span class="text-primary">*</span>
                </label>
                <input
                  ref="namaInputRef"
                  v-model="nama"
                  class="input"
                  placeholder="Contoh: Makan Kerupuk"
                  autocomplete="off"
                />
              </div>

              <div>
                <label class="block text-[12px] font-semibold text-[#374151] mb-1.5">Pilih Ikon</label>
                <div class="grid grid-cols-8 gap-1.5">
                  <button
                    v-for="em in EMOJI_OPTIONS"
                    :key="em"
                    type="button"
                    class="aspect-square text-xl border-2 rounded-lg flex items-center justify-center transition-all hover:scale-105"
                    :class="emoji === em ? 'bg-primary-light border-primary shadow-sm' : 'bg-white border-[#E5E7EB] hover:border-primary/50'"
                    @click="emoji = em"
                  >
                    {{ em }}
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-[12px] font-semibold text-[#374151] mb-1.5">
                  Deskripsi <span class="text-[10px] text-[#6B7280] font-normal">(opsional)</span>
                </label>
                <textarea
                  v-model="deskripsi"
                  class="input"
                  rows="2"
                  placeholder="Deskripsi singkat lomba, misal: 'Lomba klasik 17 Agustus yang seru!'"
                />
              </div>
            </div>
          </section>

          <div class="border-t border-dashed border-[#E5E7EB]" />

          <!-- =========================================================
               SECTION 2: Syarat & Ketentuan
               ========================================================= -->
          <section>
            <div class="flex items-center gap-2 mb-3">
              <div class="w-6 h-6 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">2</div>
              <h4 class="text-[13px] font-bold text-[#1F2937] uppercase tracking-wide">Syarat & Ketentuan</h4>
            </div>

            <div class="pl-8">
              <textarea
                v-model="syarat"
                class="input font-mono text-[12px]"
                rows="5"
                :placeholder="'Contoh:\nPeserta berusia 5 tahun ke atas\nBawa sendiri alat makan\nDaftar maksimal 30 menit sebelum mulai'"
              />
              <p class="text-[11px] text-[#6B7280] mt-1.5 flex items-center gap-1">
                <i class="fas fa-circle-info" />
                Tulis <strong>1 syarat per baris</strong>. Akan tampil di halaman pendaftaran publik.
              </p>
            </div>
          </section>

          <div class="border-t border-dashed border-[#E5E7EB]" />

          <!-- =========================================================
               SECTION 3: Kategori & Penanggung Jawab
               ========================================================= -->
          <section>
            <div class="flex items-center gap-2 mb-1">
              <div class="w-6 h-6 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">3</div>
              <h4 class="text-[13px] font-bold text-[#1F2937] uppercase tracking-wide">Kategori & Penanggung Jawab</h4>
              <span class="text-primary">*</span>
            </div>
            <p class="text-[11px] text-[#6B7280] mb-3 pl-8">
              Pilih kategori yang eligible. Setelah dipilih, tambahkan PJ (penanggung jawab) per kategori.
            </p>

            <!-- Empty state when no kategori selected -->
            <div
              v-if="orderedKats.length === 0"
              class="pl-8 mb-3 p-4 bg-[#F9FAFB] border border-dashed border-[#E5E7EB] rounded-lg text-center"
            >
              <i class="fas fa-tags text-2xl text-[#D1D5DB] mb-1.5" />
              <p class="text-[12px] text-[#6B7280]">Belum ada kategori. Buat dulu di <strong>Pengaturan → Kategori</strong>.</p>
            </div>

            <!-- Card-style kategori picker -->
            <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-2 pl-8 mb-3">
              <button
                v-for="k in orderedKats"
                :key="k.id"
                type="button"
                class="relative flex items-center gap-2 p-2.5 border-2 rounded-xl text-left transition-all hover:shadow-sm"
                :class="kategoriEligible.includes(k.id) ? 'border-primary shadow-sm' : 'border-[#E5E7EB] hover:border-primary/40'"
                :style="kategoriEligible.includes(k.id) ? { background: k.colorBg } : {}"
                @click="toggleKat(k.id)"
              >
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border"
                  :style="{
                    background: kategoriEligible.includes(k.id) ? '#fff' : k.colorBg,
                    color: k.colorText,
                    borderColor: kategoriEligible.includes(k.id) ? k.colorText : 'transparent',
                  }"
                >
                  <i :class="['fas', k.icon, 'text-sm']" />
                </div>
                <div class="flex-1 min-w-0">
                  <div
                    class="text-[12px] font-bold truncate"
                    :style="kategoriEligible.includes(k.id) ? { color: k.colorText } : { color: '#1F2937' }"
                  >
                    {{ k.nama }}
                  </div>
                  <div
                    class="text-[10px]"
                    :style="kategoriEligible.includes(k.id) ? { color: k.colorText, opacity: 0.8 } : { color: '#6B7280' }"
                  >
                    {{ formatRange(k.min, k.max) }}
                  </div>
                </div>
                <div
                  v-if="kategoriEligible.includes(k.id)"
                  class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  :style="{ background: k.colorText, color: '#fff' }"
                >
                  <i class="fas fa-check text-[10px]" />
                </div>
              </button>
            </div>

            <!-- Empty hint if no kategori selected yet -->
            <div
              v-if="orderedKats.length > 0 && kategoriEligible.length === 0"
              class="pl-8 mb-3 p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg flex items-start gap-2"
            >
              <i class="fas fa-arrow-up text-[#92400E] text-xs mt-0.5" />
              <p class="text-[12px] text-[#92400E]">
                <strong>Belum ada kategori dipilih.</strong> Klik salah satu kartu di atas untuk menambahkan.
              </p>
            </div>

            <!-- PJ per selected kategori (inline expansion) -->
            <div v-if="kategoriEligible.length > 0" class="pl-8 space-y-3">
              <div
                v-for="g in groups"
                :key="g.publicName"
                class="border-2 rounded-xl overflow-hidden"
                :style="{ borderColor: g.sampleKat?.colorText || '#E5E7EB' }"
              >
                <!-- Card header -->
                <div
                  class="px-3 py-2.5 flex items-center justify-between"
                  :style="{
                    background: g.sampleKat?.colorBg || '#F9FAFB',
                    color: g.sampleKat?.colorText || '#1F2937',
                  }"
                >
                  <div class="flex items-center gap-2">
                    <i :class="['fas', g.sampleKat?.icon || 'fa-tag', 'text-sm']" />
                    <span class="text-[12px] font-bold">{{ g.publicName }}</span>
                  </div>
                  <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/70">
                    {{ (pjByKategori[g.katIds[0]] || []).length }} PJ
                  </span>
                </div>

                <!-- Jadwal -->
                <div class="px-3 pt-3 pb-2 bg-white">
                  <div class="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5">
                    <i class="fas fa-calendar-day" /> Jadwal
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="date"
                        class="input text-[12px]"
                        :value="jadwalByKategori[g.katIds[0]]?.tanggal ? tsToUtcDateStr(jadwalByKategori[g.katIds[0]].tanggal) : ''"
                        @change="setJadwalForGroup(g.katIds, 'tanggal', ($event.target as HTMLInputElement).value || null)"
                      />
                    </div>
                    <div>
                      <input
                        type="time"
                        class="input text-[12px]"
                        :value="jadwalByKategori[g.katIds[0]]?.jam || ''"
                        @change="setJadwalForGroup(g.katIds, 'jam', ($event.target as HTMLInputElement).value || null)"
                      />
                    </div>
                  </div>
                </div>

                <!-- PJ list -->
                <div class="px-3 py-3 bg-white border-t border-dashed border-[#E5E7EB]">
                  <div class="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1.5 flex items-center justify-between">
                    <span><i class="fas fa-user-tie" /> Penanggung Jawab</span>
                    <span class="normal-case font-normal text-[10px]">min 1, maks {{ MAX_PJ_PER_KAT }}</span>
                  </div>
                  <div class="space-y-1.5">
                    <div
                      v-for="(pj, idx) in (pjByKategori[g.katIds[0]] || [])"
                      :key="idx"
                      class="flex gap-1.5 items-center"
                    >
                      <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        <input
                          class="input text-[12px]"
                          :value="pj.nama"
                          @input="setPjForGroup(g.katIds, idx, 'nama', ($event.target as HTMLInputElement).value)"
                          placeholder="Nama PJ (cth: Bu Yuni)"
                        />
                        <input
                          class="input text-[12px]"
                          :value="pj.kontak || ''"
                          @input="setPjForGroup(g.katIds, idx, 'kontak', ($event.target as HTMLInputElement).value)"
                          placeholder="Kontak (opsional)"
                        />
                      </div>
                      <button
                        v-if="(pjByKategori[g.katIds[0]] || []).length > 1"
                        type="button"
                        class="w-9 h-9 rounded-lg bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center hover:bg-[#FECACA] flex-shrink-0 transition-colors"
                        title="Hapus PJ"
                        @click="removePjForGroup(g.katIds, idx)"
                      >
                        <i class="fas fa-xmark text-sm" />
                      </button>
                    </div>
                  </div>
                  <button
                    v-if="(pjByKategori[g.katIds[0]] || []).length < MAX_PJ_PER_KAT"
                    type="button"
                    class="mt-2 w-full text-[12px] font-semibold text-primary border-2 border-dashed border-primary-light rounded-lg py-1.5 hover:bg-primary-light hover:border-primary transition-colors flex items-center justify-center gap-1.5"
                    @click="addPjForGroup(g.katIds)"
                  >
                    <i class="fas fa-plus text-[10px]" /> Tambah PJ
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div class="border-t border-dashed border-[#E5E7EB]" />

          <!-- =========================================================
               SECTION 4: Pengaturan Tambahan
               ========================================================= -->
          <section>
            <div class="flex items-center gap-2 mb-3">
              <div class="w-6 h-6 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">4</div>
              <h4 class="text-[13px] font-bold text-[#1F2937] uppercase tracking-wide">Pengaturan Tambahan</h4>
            </div>

            <div class="space-y-3 pl-8">
              <!-- Status (visual cards) -->
              <div>
                <label class="block text-[12px] font-semibold text-[#374151] mb-1.5">Status Lomba</label>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="s in statusOptions"
                    :key="s.value"
                    type="button"
                    class="flex flex-col items-center gap-1 p-2.5 border-2 rounded-lg transition-all"
                    :class="status === s.value ? 'border-primary bg-primary-light' : 'border-[#E5E7EB] hover:border-primary/40'"
                    @click="status = s.value"
                  >
                    <i :class="['fas', s.icon, status === s.value ? 'text-primary' : 'text-[#6B7280]']" />
                    <span class="text-[12px] font-bold">{{ s.label }}</span>
                    <span class="text-[10px] text-[#6B7280] text-center leading-tight">{{ s.desc }}</span>
                  </button>
                </div>
              </div>

              <!-- Urutan -->
              <div>
                <label class="block text-[12px] font-semibold text-[#374151] mb-1.5">Urutan Tampil</label>
                <input
                  v-model.number="urutan"
                  type="number"
                  min="0"
                  class="input"
                />
                <p class="text-[10px] text-[#6B7280] mt-1">Angka kecil = tampil lebih dulu di halaman publik</p>
              </div>

              <!-- Toggle: Pendaftaran dibuka -->
              <button
                type="button"
                class="w-full flex items-center justify-between gap-3 p-3 border-2 rounded-xl text-left transition-colors"
                :class="pendaftaranDibuka ? 'border-primary bg-primary-light' : 'border-[#E5E7EB] hover:border-primary/40'"
                @click="pendaftaranDibuka = !pendaftaranDibuka"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-9 h-9 rounded-full flex items-center justify-center"
                    :class="pendaftaranDibuka ? 'bg-primary text-white' : 'bg-[#F3F4F6] text-[#6B7280]'"
                  >
                    <i class="fas fa-door-open" />
                  </div>
                  <div>
                    <div class="text-[13px] font-bold text-[#1F2937]">Pendaftaran Dibuka</div>
                    <div class="text-[11px] text-[#6B7280]">
                      {{ pendaftaranDibuka ? "Warga bisa langsung daftar" : "Pendaftaran ditutup sementara" }}
                    </div>
                  </div>
                </div>
                <div
                  class="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                  :class="pendaftaranDibuka ? 'bg-primary' : 'bg-[#D1D5DB]'"
                >
                  <div
                    class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                    :class="pendaftaranDibuka ? 'translate-x-[22px]' : 'translate-x-0.5'"
                  />
                </div>
              </button>

              <!-- Toggle: 3-fase flow -->
              <button
                type="button"
                class="w-full flex items-center justify-between gap-3 p-3 border-2 rounded-xl text-left transition-colors"
                :class="faseEnabled ? 'border-primary bg-primary-light' : 'border-[#E5E7EB] hover:border-primary/40'"
                @click="faseEnabled = !faseEnabled"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-9 h-9 rounded-full flex items-center justify-center"
                    :class="faseEnabled ? 'bg-primary text-white' : 'bg-[#F3F4F6] text-[#6B7280]'"
                  >
                    <i class="fas fa-sitemap" />
                  </div>
                  <div>
                    <div class="text-[13px] font-bold text-[#1F2937]">3-Fase Flow</div>
                    <div class="text-[11px] text-[#6B7280]">
                      Kualifikasi → Semi Final → Final. <span v-if="!faseEnabled">(default: 2-fase Kualifikasi → Final)</span>
                    </div>
                  </div>
                </div>
                <div
                  class="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                  :class="faseEnabled ? 'bg-primary' : 'bg-[#D1D5DB]'"
                >
                  <div
                    class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                    :class="faseEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'"
                  />
                </div>
              </button>
            </div>
          </section>

          <!-- Error -->
          <div
            v-if="err"
            class="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-[13px] rounded-lg p-3 flex items-start gap-2"
          >
            <i class="fas fa-exclamation-triangle mt-0.5" />
            <span>{{ err }}</span>
          </div>
        </div>

        <!-- Sticky footer -->
        <div class="px-6 py-3 border-t border-[#E5E7EB] flex items-center justify-between gap-2 flex-shrink-0 bg-[#FAFAFA]">
          <p class="text-[11px] text-[#6B7280] hidden sm:block">
            <i class="fas fa-circle-info" />
            Semua field bertanda <span class="text-primary">*</span> wajib diisi
          </p>
          <div class="flex gap-2 ml-auto">
            <button class="btn btn-secondary" style="width: auto" @click="emit('close')">Batal</button>
            <button class="btn btn-primary" style="width: auto" :disabled="saving" @click="submit">
              <i v-if="saving" class="fas fa-spinner fa-spin" />
              <i v-else class="fas fa-save" />
              {{ editing ? "Simpan Perubahan" : "Tambah Lomba" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
