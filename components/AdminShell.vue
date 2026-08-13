<script setup lang="ts">
// AdminShell — Vue 3 port of components/admin-shell.tsx + admin-shell-client.tsx.
// Server-side auth check, fetches settings, then renders the client chrome.

const props = withDefaults(
  defineProps<{
    title: string;
    breadcrumb?: string;
    activeNav: string;
    appName?: string;
    kampungName?: string;
  }>(),
  {
    appName: "Lomba Kampung",
    kampungName: "Kampung Kadu Jaya",
  }
);

const open = ref(false);

const NAV = [
  { href: "/admin", icon: "fa-house", label: "Dashboard" },
  { href: "/admin/lomba", icon: "fa-trophy", label: "Manajemen Lomba" },
  { href: "/admin/approval", icon: "fa-user-check", label: "Approval" },
  { href: "/admin/peserta", icon: "fa-users", label: "Peserta" },
  { href: "/admin/input-manual", icon: "fa-user-plus", label: "Input Manual" },
  { href: "/admin/pengaturan", icon: "fa-gear", label: "Pengaturan" },
];

async function doLogout() {
  await fetch("/api/admin/logout", { method: "POST" });
  await navigateTo("/admin/login");
}
</script>

<template>
  <div>
    <div :class="['sidebar-overlay', { active: open }]" @click="open = false" />

    <aside :class="['admin-sidebar', { open }]">
      <div class="p-5 pr-12 border-b border-[#E5E7EB] mb-4 relative">
        <button class="sidebar-close" aria-label="Tutup menu" @click="open = false">
          <i class="fas fa-xmark" />
        </button>
        <NuxtLink to="/admin" class="flex items-center gap-2.5 no-underline text-inherit">
          <div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-primary-light">
            <img src="/logo.webp" alt="Logo IPPeKa" class="w-full h-full object-cover" />
          </div>
          <div>
            <div class="font-bold text-[15px]">{{ props.appName }}</div>
            <div class="text-[11px] text-[#6B7280]">{{ props.kampungName }}</div>
          </div>
        </NuxtLink>
      </div>

      <nav class="flex-1 py-2">
        <NuxtLink
          v-for="n in NAV"
          :key="n.href"
          :to="n.href"
          :class="['sidebar-nav-item', { active: props.activeNav === n.href }]"
          @click="open = false"
        >
          <i :class="['fas', n.icon]" :style="{ width: '20px', fontSize: '16px' }" />
          <span>{{ n.label }}</span>
        </NuxtLink>
      </nav>

      <div class="p-4 border-t border-[#E5E7EB]">
        <div class="flex items-center gap-2.5 p-2.5 rounded bg-[#F9FAFB]">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-[13px] font-bold">A</div>
          <div class="flex-1 min-w-0">
            <div class="text-[12px] font-semibold">Admin</div>
          </div>
          <NuxtLink to="/" class="text-[#9CA3AF] text-xs" title="Lihat Halaman Publik" @click="open = false">
            <i class="fas fa-globe" />
          </NuxtLink>
          <button class="text-[#9CA3AF] text-xs" title="Logout" @click="doLogout">
            <i class="fas fa-right-from-bracket" />
          </button>
        </div>
      </div>
    </aside>

    <main class="admin-main">
      <header class="admin-topbar">
        <div class="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
          <button class="hamburger" aria-label="Buka menu" @click="open = !open">
            <i class="fas fa-bars" />
          </button>
          <div class="min-w-0 flex-1">
            <div v-if="breadcrumb" class="text-[11px] text-[#6B7280] mb-0.5 truncate hidden sm:block">{{ breadcrumb }}</div>
            <div class="font-bold text-base truncate">{{ title }}</div>
          </div>
        </div>
        <div class="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
          <NuxtLink to="/" class="btn btn-secondary btn-sm" style="width: auto" title="Lihat halaman publik (tab ini)">
            <i class="fas fa-globe" />
            <span class="hidden md:inline">Halaman Publik</span>
          </NuxtLink>
          <slot name="actions" />
        </div>
      </header>
      <div class="admin-content">
        <slot />
      </div>
    </main>
  </div>
</template>
