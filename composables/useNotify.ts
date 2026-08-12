// useNotify composable — Vue 3 equivalent of useNotify() from React NotifyProvider.
// Auto-imported by Nuxt 3 from composables/ folder.
//
// Uses Nuxt's useState() to share toast/confirm state across components
// (same effect as React context, but Vue-style). The actual rendering lives
// in <NotifyProvider> component which is mounted once in app.vue.

import { useState } from "#imports";

export type ToastVariant = "success" | "error" | "info" | "warning";

export type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
};

type ConfirmResolver = (v: boolean) => void;

let _nextId = 1;
const nextId = () => _nextId++;

export function useNotify() {
  const toasts = useState<Toast[]>("notify:toasts", () => []);
  const confirm = useState<{ opts: ConfirmOptions; resolve: ConfirmResolver } | null>(
    "notify:confirm",
    () => null
  );

  const push = (message: string, variant: ToastVariant) => {
    const id = nextId();
    toasts.value = [...toasts.value, { id, message, variant }];
  };

  const removeToast = (id: number) => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  };

  const confirmDialog = (opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      confirm.value = { opts, resolve };
    });
  };

  const resolveConfirm = (value: boolean) => {
    if (confirm.value) {
      confirm.value.resolve(value);
      confirm.value = null;
    }
  };

  return {
    success: (m: string) => push(m, "success"),
    error: (m: string) => push(m, "error"),
    info: (m: string) => push(m, "info"),
    warning: (m: string) => push(m, "warning"),
    confirm: confirmDialog,
    // exposed for <NotifyProvider> internal use
    toasts,
    confirmState: confirm,
    removeToast,
    resolveConfirm,
  } as const;
}
