<script setup lang="ts">
// DownloadExcelButton — Vue 3 port of components/download-excel-button.tsx.
// Same fetch+Blob pattern (reliable in all browsers per the original notes).
// Auth-aware: 401 = "session expired", 5xx = JSON detail surfaced.
//
// `endpoint` is configurable so the same component can be reused for:
//   - all-lomba export:  /api/admin/peserta-excel
//   - per-lomba export:  /api/admin/peserta-excel/[id]
import { useNotify } from "~/composables/useNotify";

const props = withDefaults(
  defineProps<{
    variant?: "tile" | "btn-secondary";
    label?: string;
    title?: string;
    iconClass?: string;
    endpoint?: string;
  }>(),
  {
    variant: "btn-secondary",
    label: "Download",
    iconClass: "fas fa-file-excel",
    endpoint: "/api/admin/peserta-excel",
  }
);

const notify = useNotify();
const busy = ref(false);

async function trigger() {
  if (busy.value) return;
  busy.value = true;
  notify.info("Menyiapkan file Excel...");
  try {
    const res = await fetch(props.endpoint, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Sesi admin habis. Silakan login ulang.");
      }
      let detail = "";
      try {
        const ct = res.headers.get("Content-Type") || "";
        if (ct.includes("application/json")) {
          const j = await res.json();
          detail = j?.detail || j?.error || "";
        }
      } catch {}
      throw new Error(detail ? `HTTP ${res.status}: ${detail}` : `HTTP ${res.status}`);
    }
    const dispo = res.headers.get("Content-Disposition") || "";
    const m = dispo.match(/filename="?([^"]+)"?/);
    const filename = m?.[1] || `peserta-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
    notify.success("Download dimulai — cek folder Download browser");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal mendownload";
    notify.error(msg);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <button
    v-if="props.variant === 'tile'"
    type="button"
    :disabled="busy"
    :title="title || 'Download semua peserta (1 sheet per lomba + 1 sheet Peserta)'"
    class="quick-tile info"
    @click="trigger"
  >
    <div class="qicon">
      <i v-if="busy" class="fas fa-spinner fa-spin" />
      <i v-else :class="iconClass" />
    </div>
    <div class="qlbl">{{ label }}</div>
  </button>
  <button
    v-else
    type="button"
    :disabled="busy"
    :title="title"
    :class="['btn', props.variant]"
    @click="trigger"
  >
    <i v-if="busy" class="fas fa-spinner fa-spin" />
    <i v-else :class="iconClass" />
    {{ label }}
  </button>
</template>
