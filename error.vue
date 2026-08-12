<script setup lang="ts">
// Global error page — Nuxt 3 equivalent of Next.js error.tsx.

const props = defineProps<{
  error: { statusCode: number; statusMessage?: string; message?: string };
}>();

const handleError = () => clearError({ redirect: "/" });
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6 bg-background">
    <div class="card max-w-md w-full p-8 text-center">
      <div class="text-6xl mb-3">
        <i class="fas fa-triangle-exclamation text-primary"></i>
      </div>
      <h1 class="text-2xl font-bold mb-2">{{ props.error.statusCode }}</h1>
      <p class="text-[13px] text-[#6B7280] mb-5">
        {{ props.error.statusMessage || props.error.message || "Terjadi kesalahan" }}
      </p>
      <button class="btn btn-primary" @click="handleError">
        <i class="fas fa-home"></i> Kembali ke Beranda
      </button>
    </div>
  </div>
</template>
