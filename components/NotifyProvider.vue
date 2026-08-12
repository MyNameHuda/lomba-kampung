<script setup lang="ts">
// NotifyProvider — Vue 3 port of components/notify-provider.tsx.
// Renders toasts + confirm modal. Mounted once at root level.
// The useNotify() composable shares state via useState().

import { useNotify } from "~/composables/useNotify";

const { toasts, confirmState, removeToast, resolveConfirm } = useNotify();

const VARIANT_STYLE: Record<string, { bg: string; text: string; icon: string; border: string }> = {
  success: { bg: "bg-[#DCFCE7]", text: "text-[#15803D]", icon: "fa-check-circle", border: "border-[#86EFAC]" },
  error:   { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", icon: "fa-exclamation-circle", border: "border-[#FCA5A5]" },
  info:    { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]", icon: "fa-info-circle", border: "border-[#93C5FD]" },
  warning: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", icon: "fa-exclamation-triangle", border: "border-[#FCD34D]" },
};

const toastTimers = new Map<number, ReturnType<typeof setTimeout>>();

watch(toasts, (curr) => {
  // Auto-remove toasts after 4s
  for (const t of curr) {
    if (!toastTimers.has(t.id)) {
      const timer = setTimeout(() => {
        removeToast(t.id);
        toastTimers.delete(t.id);
      }, 4000);
      toastTimers.set(t.id, timer);
    }
  }
}, { deep: true });

onBeforeUnmount(() => {
  for (const timer of toastTimers.values()) clearTimeout(timer);
  toastTimers.clear();
});

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && confirmState.value) resolveConfirm(false);
}

if (typeof window !== "undefined") {
  window.addEventListener("keydown", onKeydown);
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
}
</script>

<template>
  <Teleport to="body">
    <!-- Toast container (top-right, stacked) -->
    <div
      aria-live="polite"
      aria-atomic="true"
      class="notify-toast-container"
    >
      <div
        v-for="t in toasts"
        :key="t.id"
        role="alert"
        :class="['notify-toast', VARIANT_STYLE[t.variant].bg, VARIANT_STYLE[t.variant].text, VARIANT_STYLE[t.variant].border]"
      >
        <i :class="['fas', VARIANT_STYLE[t.variant].icon, 'notify-toast-icon']" />
        <div class="notify-toast-message">{{ t.message }}</div>
        <button
          type="button"
          :aria-label="'Tutup'"
          class="notify-toast-close"
          @click="removeToast(t.id)"
        >
          <i class="fas fa-xmark text-xs" />
        </button>
      </div>
    </div>

    <!-- Confirm modal -->
    <div
      v-if="confirmState"
      class="notify-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      @click="resolveConfirm(false)"
    >
      <div
        class="notify-confirm-modal"
        @click.stop
      >
        <div class="notify-confirm-body">
          <div :class="['notify-confirm-icon', confirmState.opts.variant === 'danger' ? 'notify-confirm-icon-danger' : 'notify-confirm-icon-warn']">
            <i :class="['fas', confirmState.opts.variant === 'danger' ? 'fa-exclamation-triangle' : 'fa-question-circle', 'text-lg']" />
          </div>
          <div class="notify-confirm-content">
            <h3 class="notify-confirm-title">
              {{ confirmState.opts.title || (confirmState.opts.variant === 'danger' ? "Konfirmasi Penghapusan" : "Konfirmasi") }}
            </h3>
            <p class="notify-confirm-message">{{ confirmState.opts.message }}</p>
          </div>
        </div>
        <div class="notify-confirm-actions">
          <button
            type="button"
            class="btn btn-secondary"
            @click="resolveConfirm(false)"
          >
            {{ confirmState.opts.cancelText || "Batal" }}
          </button>
          <button
            type="button"
            :class="confirmState.opts.variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary'"
            @click="resolveConfirm(true)"
          >
            {{ confirmState.opts.confirmText || (confirmState.opts.variant === 'danger' ? "Hapus" : "Lanjut") }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.notify-toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: min(92vw, 360px);
}
.notify-toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  animation: slideInRight 0.25s ease-out;
}
.notify-toast-icon { font-size: 16px; margin-top: 2px; flex-shrink: 0; }
.notify-toast-message { font-size: 13px; font-weight: 600; line-height: 1.4; flex: 1; word-break: break-word; }
.notify-toast-close { background: transparent; border: none; cursor: pointer; opacity: 0.6; padding: 0; }
.notify-toast-close:hover { opacity: 1; }

.notify-confirm-backdrop {
  position: fixed; inset: 0; z-index: 10000;
  display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(0,0,0,0.5);
  animation: fadeIn 0.15s ease-out;
}
.notify-confirm-modal {
  background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  max-width: 420px; width: 100%; overflow: hidden;
  animation: scaleIn 0.2s ease-out;
}
.notify-confirm-body { padding: 20px; display: flex; align-items: flex-start; gap: 12px; }
.notify-confirm-icon {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.notify-confirm-icon-danger { background: #FEE2E2; color: #991B1B; }
.notify-confirm-icon-warn { background: #FEF3C7; color: #92400E; }
.notify-confirm-content { flex: 1; min-width: 0; }
.notify-confirm-title { font-size: 16px; font-weight: 700; color: #1F2937; margin: 0 0 4px; }
.notify-confirm-message { font-size: 13px; color: #6B7280; line-height: 1.5; white-space: pre-line; margin: 0; }
.notify-confirm-actions { padding: 12px; background: #F9FAFB; display: flex; gap: 8px; justify-content: flex-end; }
</style>
