<script setup lang="ts">
// KategoriModal — Vue 3 port of app/admin/pengaturan/kategori-modal.tsx.
const props = defineProps<{ editing: any | null }>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", data: any): void;
}>();

const ICON_OPTIONS = ["fa-baby", "fa-child", "fa-child-dress", "fa-user", "fa-user-tie", "fa-person-dress", "fa-user-graduate", "fa-people-group", "fa-star", "fa-trophy", "fa-medal", "fa-crown"];
const COLOR_PAIRS: Array<{ bg: string; text: string; border: string; label: string }> = [
  { bg: "#FCE0E0", text: "#9D1010", border: "#F18181", label: "Pink" },
  { bg: "#FDF2F8", text: "#9D174D", border: "#FBCFE8", label: "Pink Tua" },
  { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE", label: "Biru" },
  { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", label: "Kuning" },
  { bg: "#F0FDF4", text: "#15803D", border: "#86EFAC", label: "Hijau" },
  { bg: "#FAF5FF", text: "#7C3AED", border: "#DDD6FE", label: "Ungu" },
  { bg: "#FFFFFF", text: "#6B7280", border: "#D1D5DB", label: "Abu" },
];

const id = ref(props.editing?.id || "");
const nama = ref(props.editing?.nama || "");
const icon = ref(props.editing?.icon || "fa-user");
const min = ref(props.editing?.min ?? 0);
const max = ref(props.editing?.max ?? 99);
const urutan = ref(props.editing?.urutan ?? 0);
const autoAge = ref(props.editing?.autoAge ?? false);
// "button" = age grid in form pendaftar (chips, good for narrow ranges)
// "field"  = number input (good for wide ranges like 18+ where 50+ buttons is too many)
const inputMode = ref<"button" | "field">(props.editing?.inputMode || "button");
const colorBg = ref(props.editing?.colorBg || "#FFFBEB");
const colorText = ref(props.editing?.colorText || "#92400E");
const colorBorder = ref(props.editing?.colorBorder || "#FDE68A");
const err = ref("");

function applyColor(c: any) {
  colorBg.value = c.bg;
  colorText.value = c.text;
  colorBorder.value = c.border;
}

function submit() {
  err.value = "";
  if (!nama.value.trim()) { err.value = "Nama wajib diisi"; return; }
  if (min.value > max.value) { err.value = "Umur min tidak boleh lebih besar dari max"; return; }
  // For new kategori, omit `id` — server auto-generates from nama (slug).
  // For edit, send the existing id back so the row is updated, not duplicated.
  const payload: Record<string, unknown> = {
    nama: nama.value.trim(),
    icon: icon.value,
    min: Number(min.value),
    max: Number(max.value),
    urutan: Number(urutan.value),
    autoAge: !!autoAge.value,
    inputMode: inputMode.value,
    colorBg: colorBg.value,
    colorText: colorText.value,
    colorBorder: colorBorder.value,
  };
  if (props.editing) {
    payload.id = id.value;
  }
  emit("save", payload);
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click="emit('close')">
      <div class="bg-white rounded-2xl max-w-[480px] w-full max-h-[90vh] overflow-hidden flex flex-col" @click.stop>
        <div class="p-5 border-b border-[#E5E7EB] flex items-center justify-between flex-shrink-0">
          <h3 class="text-base font-bold">{{ editing ? "Edit Kategori" : "Tambah Kategori" }}</h3>
          <button class="w-8 h-8 rounded-full bg-[#F9FAFB] text-[#6B7280] flex items-center justify-center hover:bg-[#E5E7EB]" @click="emit('close')">
            <i class="fas fa-xmark" />
          </button>
        </div>
        <div class="p-6 overflow-y-auto space-y-4 flex-1">
          <div v-if="editing" class="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[12px] text-[#6B7280]">
            <span class="font-semibold text-[#374151]">ID:</span> <code class="text-[#1F2937]">{{ id }}</code>
            <span class="ml-1">(immutable — tidak bisa diubah)</span>
          </div>
          <div>
            <label class="label">Nama</label>
            <input v-model="nama" class="input" placeholder="Balita" />
          </div>
          <div>
            <label class="label">Icon (FontAwesome)</label>
            <div class="grid grid-cols-6 gap-1.5">
              <button
                v-for="i in ICON_OPTIONS"
                :key="i"
                type="button"
                class="aspect-square border-2 rounded flex items-center justify-center text-sm"
                :class="icon === i ? 'bg-primary-light border-primary text-primary' : 'bg-white border-[#E5E7EB] text-[#6B7280]'"
                @click="icon = i"
              ><i :class="['fas', i]" /></button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label">Umur Min</label>
              <input v-model.number="min" type="number" min="0" max="999" class="input" />
            </div>
            <div>
              <label class="label">Umur Max</label>
              <input v-model.number="max" type="number" min="0" max="999" class="input" />
            </div>
          </div>
          <div>
            <label class="label">Mode Input Umur</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="p-3 border-2 rounded-lg text-left transition-all"
                :class="inputMode === 'button' ? 'border-primary bg-primary-light' : 'border-[#E5E7EB] bg-white hover:border-primary'"
                @click="inputMode = 'button'"
              >
                <div class="flex items-center gap-1.5">
                  <i class="fas fa-grip-horizontal text-sm" :class="inputMode === 'button' ? 'text-primary' : 'text-[#6B7280]'" />
                  <strong class="text-sm" :class="inputMode === 'button' ? 'text-primary-dark' : 'text-[#1F2937]'">Tombol</strong>
                </div>
              </button>
              <button
                type="button"
                class="p-3 border-2 rounded-lg text-left transition-all"
                :class="inputMode === 'field' ? 'border-primary bg-primary-light' : 'border-[#E5E7EB] bg-white hover:border-primary'"
                @click="inputMode = 'field'"
              >
                <div class="flex items-center gap-1.5">
                  <i class="fas fa-keyboard text-sm" :class="inputMode === 'field' ? 'text-primary' : 'text-[#6B7280]'" />
                  <strong class="text-sm" :class="inputMode === 'field' ? 'text-primary-dark' : 'text-[#1F2937]'">Isi Sendiri</strong>
                </div>
              </button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label">Urutan</label>
              <input v-model.number="urutan" type="number" min="0" class="input" />
            </div>
            <div>
              <label class="label">Auto-age</label>
              <label class="flex items-center gap-2 h-[42px]">
                <input v-model="autoAge" type="checkbox" class="accent-primary w-4 h-4" />
                <span class="text-[12px]">Paksa usia minimum (mis. Ibu-Ibu)</span>
              </label>
            </div>
          </div>
          <div>
            <label class="label">Warna</label>
            <div class="grid grid-cols-4 gap-1.5">
              <button
                v-for="c in COLOR_PAIRS"
                :key="c.label"
                type="button"
                class="p-2 border-2 rounded text-[10px] font-bold flex flex-col items-center gap-1"
                :class="colorBg === c.bg ? 'border-primary' : 'border-[#E5E7EB]'"
                :style="{ background: c.bg, color: c.text }"
                @click="applyColor(c)"
              ><span>{{ c.label }}</span></button>
            </div>
          </div>
          <div v-if="err" class="bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-sm rounded p-3">
            <i class="fas fa-exclamation-triangle" /> {{ err }}
          </div>
        </div>
        <div class="p-3 border-t border-[#E5E7EB] flex gap-2 justify-end flex-shrink-0">
          <button class="btn btn-secondary" style="width: auto" @click="emit('close')">Batal</button>
          <button class="btn btn-primary" style="width: auto" @click="submit">Simpan</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
