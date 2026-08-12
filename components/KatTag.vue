<script setup lang="ts">
// KatTag — Vue 3 port of components/kat-tag.tsx.
// Renders a kategori badge with DB-driven colors.
// Auto-contrasts: if colorBg is dark (luminance < 0.55), text color is forced
// to white so the badge stays readable even when colorText is set to a
// dark value (e.g. for use over a tinted/light background elsewhere).
import { computed } from "vue";

const props = defineProps<{
  nama: string;
  colorBg?: string;
  colorText?: string;
  colorBorder?: string;
  size?: "sm" | "md";
  class?: string;
}>();

// Compute WCAG relative luminance from a #RRGGBB hex string.
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
function hexLuminance(hex: string): number {
  const h = (hex || "#F3F4F6").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Pick a text color that contrasts the chosen bg. Falls back to the provided
// colorText when the bg is light, and to white when the bg is dark.
const resolvedText = computed(() => {
  if (!props.colorBg) return props.colorText || "#1F2937";
  const lum = hexLuminance(props.colorBg);
  if (lum < 0.55) return "#FFFFFF";
  return props.colorText || "#1F2937";
});
</script>

<template>
  <span
    v-if="colorBg && colorText && colorBorder"
    :class="[
      'inline-flex items-center rounded-full font-bold',
      size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1',
      $props.class,
    ]"
    :style="{ background: colorBg, color: resolvedText, border: `1.5px solid ${colorBorder}` }"
  >
    {{ nama }}
  </span>
  <span
    v-else
    :class="[
      'inline-flex items-center rounded-full font-bold border',
      size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1',
      $props.class,
    ]"
  >
    {{ nama }}
  </span>
</template>
