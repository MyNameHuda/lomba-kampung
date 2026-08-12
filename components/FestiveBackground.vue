<script setup lang="ts">
// FestiveBackground — fixed full-screen decorative layer rendered behind all
// pages. Provides the "lomba kampung" vibe: warm gradient + soft floating
// colored blobs + scattered confetti shapes. Sits at z-[-1] so all interactive
// content (forms, cards, sidebar) sits on top without needing repositioning.
//
// Two variants:
//   - "public" (default): warm pink/red, more confetti & balloons
//   - "admin": cooler blue-tinged palette so admin tools feel focused
//
// Respects prefers-reduced-motion: animations are CSS keyframes — the
// global rule in main.css already shortens them to 0.01ms when reduced.
withDefaults(
  defineProps<{
    variant?: "public" | "admin";
  }>(),
  { variant: "public" }
);
</script>

<template>
  <div :class="['festive-bg', `festive-bg--${variant}`]" aria-hidden="true">
    <!-- Soft gradient base — sits at the very back -->
    <div class="festive-gradient" />

    <!-- Subtle dot grid overlay for texture -->
    <div class="festive-dots" />

    <!-- Decorative floating shapes (CSS-only, no JS) -->
    <span class="blob blob-1" />
    <span class="blob blob-2" />
    <span class="blob blob-3" />
    <span class="blob blob-4" />
    <span class="blob blob-5" />

    <!-- Confetti / balloon SVG shapes — pure inline SVG, no external assets -->
    <svg class="confetti c-1" viewBox="0 0 24 24" width="22" height="22">
      <circle cx="12" cy="12" r="6" fill="#FFD700" />
    </svg>
    <svg class="confetti c-2" viewBox="0 0 24 24" width="18" height="18">
      <rect x="4" y="4" width="16" height="16" rx="3" fill="#E11D1D" transform="rotate(20 12 12)" />
    </svg>
    <svg class="confetti c-3" viewBox="0 0 24 24" width="14" height="14">
      <polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" fill="#F18181" />
    </svg>
    <svg class="confetti c-4" viewBox="0 0 24 24" width="20" height="20">
      <circle cx="12" cy="12" r="5" fill="#FFFFFF" opacity="0.9" />
    </svg>
    <svg class="confetti c-5" viewBox="0 0 24 24" width="16" height="16">
      <polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" fill="#FFD700" />
    </svg>
    <svg class="confetti c-6" viewBox="0 0 24 24" width="14" height="14">
      <rect x="4" y="4" width="16" height="16" rx="3" fill="#F18181" transform="rotate(-15 12 12)" />
    </svg>
    <svg class="confetti c-7" viewBox="0 0 24 24" width="20" height="20">
      <circle cx="12" cy="12" r="6" fill="#E11D1D" />
    </svg>
    <svg class="confetti c-8" viewBox="0 0 24 24" width="16" height="16">
      <polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" fill="#FFFFFF" opacity="0.85" />
    </svg>
  </div>
</template>

<style scoped>
/* ===== Base layer ===== */
.festive-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  /* High z-index stacking context: this layer is BEHIND everything.
     All page content (header, hero, cards, footer) sits on top because
     they have their own stacking context via position/z-index/transform. */
}

/* Warm gradient base — pink → cream → red wash */
.festive-bg--public .festive-gradient {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(255, 215, 0, 0.12) 0%, transparent 45%),
    radial-gradient(ellipse at 90% 10%, rgba(225, 29, 29, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 100%, rgba(247, 181, 181, 0.18) 0%, transparent 55%),
    linear-gradient(160deg, #FFF8F0 0%, #FDF5F5 35%, #FCE5E5 70%, #FCD5D5 100%);
}

/* Admin: cooler blue-tinged, less saturated */
.festive-bg--admin .festive-gradient {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 15% 0%, rgba(219, 234, 254, 0.45) 0%, transparent 45%),
    radial-gradient(ellipse at 95% 5%, rgba(254, 215, 170, 0.25) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 100%, rgba(225, 29, 29, 0.05) 0%, transparent 55%),
    linear-gradient(160deg, #F8FAFC 0%, #FDF5F5 40%, #FFF1F1 80%, #FCE5E5 100%);
}

/* Dot grid texture — very subtle */
.festive-dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(225, 29, 29, 0.08) 1px, transparent 1px);
  background-size: 22px 22px;
  background-position: 0 0;
  opacity: 0.5;
  mix-blend-mode: multiply;
}

/* ===== Floating blobs (soft colored circles) ===== */
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.55;
  animation: blobFloat 14s ease-in-out infinite;
}
.festive-bg--public .blob-1 {
  width: 280px; height: 280px;
  top: -80px; left: -60px;
  background: radial-gradient(circle, #FFD700 0%, transparent 70%);
  animation-delay: 0s;
}
.festive-bg--public .blob-2 {
  width: 320px; height: 320px;
  top: 20%; right: -100px;
  background: radial-gradient(circle, #F18181 0%, transparent 70%);
  animation-delay: -3s;
  animation-duration: 18s;
}
.festive-bg--public .blob-3 {
  width: 240px; height: 240px;
  bottom: 10%; left: 15%;
  background: radial-gradient(circle, #FBE0E0 0%, transparent 70%);
  animation-delay: -6s;
  animation-duration: 20s;
}
.festive-bg--public .blob-4 {
  width: 200px; height: 200px;
  top: 50%; right: 20%;
  background: radial-gradient(circle, #FFD700 0%, transparent 70%);
  opacity: 0.35;
  animation-delay: -9s;
  animation-duration: 22s;
}
.festive-bg--public .blob-5 {
  width: 260px; height: 260px;
  bottom: -100px; right: 30%;
  background: radial-gradient(circle, #F18181 0%, transparent 70%);
  opacity: 0.4;
  animation-delay: -12s;
  animation-duration: 16s;
}

/* Admin: cooler, less saturated blobs */
.festive-bg--admin .blob-1 {
  width: 260px; height: 260px;
  top: -80px; left: -60px;
  background: radial-gradient(circle, #DBEAFE 0%, transparent 70%);
}
.festive-bg--admin .blob-2 {
  width: 300px; height: 300px;
  top: 20%; right: -100px;
  background: radial-gradient(circle, #FCE5E5 0%, transparent 70%);
  animation-delay: -3s;
  animation-duration: 18s;
}
.festive-bg--admin .blob-3 {
  width: 220px; height: 220px;
  bottom: 10%; left: 15%;
  background: radial-gradient(circle, #FED7AA 0%, transparent 70%);
  animation-delay: -6s;
  animation-duration: 20s;
}
.festive-bg--admin .blob-4,
.festive-bg--admin .blob-5 {
  display: none; /* fewer blobs in admin keeps things focused */
}

@keyframes blobFloat {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(20px, -25px) scale(1.05); }
  66% { transform: translate(-15px, 18px) scale(0.97); }
}

/* ===== Confetti shapes (scattered, gently falling) ===== */
.confetti {
  position: absolute;
  opacity: 0.65;
  animation: confettiDrift 8s ease-in-out infinite;
  filter: drop-shadow(0 2px 4px rgba(225, 29, 29, 0.15));
}

/* Distribute confetti around the screen with varied positions and timing */
.c-1 { top: 8%; left: 5%; animation-delay: 0s; animation-duration: 9s; }
.c-2 { top: 14%; right: 8%; animation-delay: -1.5s; animation-duration: 10s; }
.c-3 { top: 35%; left: 12%; animation-delay: -3s; animation-duration: 8s; }
.c-4 { top: 50%; right: 14%; animation-delay: -4.5s; animation-duration: 11s; }
.c-5 { bottom: 30%; left: 8%; animation-delay: -2s; animation-duration: 9.5s; }
.c-6 { bottom: 18%; right: 6%; animation-delay: -5s; animation-duration: 10.5s; }
.c-7 { top: 65%; left: 45%; animation-delay: -6s; animation-duration: 8.5s; }
.c-8 { top: 22%; left: 70%; animation-delay: -3.5s; animation-duration: 9.2s; }

@keyframes confettiDrift {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-12px) rotate(15deg); }
}

/* Admin confetti — fewer, more subtle, no rotation flash */
.festive-bg--admin .confetti {
  opacity: 0.35;
  filter: none;
}
.festive-bg--admin .c-3,
.festive-bg--admin .c-5,
.festive-bg--admin .c-7,
.festive-bg--admin .c-8 {
  display: none;
}

/* Reduced motion: hold shapes still (already handled globally in main.css
   via the * rule that shortens animations, but explicit for clarity) */
@media (prefers-reduced-motion: reduce) {
  .blob, .confetti { animation: none !important; }
}
</style>
