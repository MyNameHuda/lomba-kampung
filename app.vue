<script setup lang="ts">
// Root app — provides NotifyProvider globally so useNotify() works in any page.
// FestiveBackground renders a fixed decorative layer behind all routes.
// Variant switches per route: "public" for marketing/registration pages,
// "admin" for the management console (cooler, less confetti).

const route = useRoute();
const bgVariant = computed<"public" | "admin">(() =>
  route.path.startsWith("/admin") ? "admin" : "public"
);
</script>

<template>
  <div>
    <FestiveBackground :variant="bgVariant" />
    <NotifyProvider />
    <!-- Top-of-page loading bar — visible saat Nuxt fetching data
         (useFetch dengan lazy:true, atau page navigation). Memberi feedback
         visual instant ke user, padahal page data masih loading di belakang. -->
    <NuxtLoadingIndicator color="#E11D1D" :height="3" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
