<script setup lang="ts">
// Admin login page — Vue 3 port of app/admin/login/page.tsx.
import { useNotify } from "~/composables/useNotify";

definePageMeta({ layout: false });
useHead({ title: "Login Admin — Lomba Kampung" });

const password = ref("");
const busy = ref(false);
const notify = useNotify();

async function submit() {
  if (!password.value.trim()) {
    notify.warning("Password wajib diisi");
    return;
  }
  busy.value = true;
  try {
    await $fetch("/api/admin/login", {
      method: "POST",
      body: { password: password.value },
      credentials: "include",
    });
    await navigateTo("/admin");
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    const msg = err.data?.statusMessage || err.statusMessage || "Login gagal";
    notify.error(msg);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="diffuse-bg min-h-screen flex items-center justify-center p-5">
    <div class="w-full max-w-[420px] bg-white rounded-2xl shadow-xl overflow-hidden border border-[#FCE0E0] anim-scale-in">
      <!-- Festive top banner -->
      <div class="detail-hero py-8 px-6 text-center">
        <div class="w-20 h-20 mx-auto rounded-full overflow-hidden ring-4 ring-white/40 shadow-lg mb-3 anim-float">
          <img src="/logo.webp" alt="Logo IPPeKa" class="w-full h-full object-cover" />
        </div>
        <h1 class="text-2xl font-extrabold drop-shadow-md mb-1">Login Admin 🔐</h1>
        <p class="text-[13px] text-white/90">Masuk untuk mengelola perlombaan 17 Agustus</p>
      </div>

      <div class="p-7">
        <form class="space-y-4" @submit.prevent="submit">
          <div>
            <label for="password" class="label">Password Admin</label>
            <input
              id="password"
              v-model="password"
              type="password"
              class="input"
              placeholder="Masukkan password"
              :disabled="busy"
              autocomplete="current-password"
            />
          </div>
          <button type="submit" class="btn btn-primary btn-block" :disabled="busy">
            <i v-if="busy" class="fas fa-spinner fa-spin" />
            <i v-else class="fas fa-right-to-bracket" />
            {{ busy ? "Memproses..." : "Masuk" }}
          </button>
        </form>

        <div class="mt-5 text-center">
          <NuxtLink to="/" class="text-[12px] text-[#6B7280] hover:text-primary no-underline inline-flex items-center gap-1 transition-colors">
            <i class="fas fa-arrow-left" /> Kembali ke Halaman Publik
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

