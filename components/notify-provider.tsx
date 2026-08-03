"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// =================== Types ===================
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

type NotifyContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const NotifyContext = createContext<NotifyContextValue | null>(null);

export function useNotify(): NotifyContextValue {
  const ctx = useContext(NotifyContext);
  if (!ctx) throw new Error("useNotify must be used inside <NotifyProvider>");
  return ctx;
}

// =================== Provider ===================
export function NotifyProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const push = useCallback((message: string, variant: ToastVariant) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  const success = useCallback((m: string) => push(m, "success"), [push]);
  const error = useCallback((m: string) => push(m, "error"), [push]);
  const info = useCallback((m: string) => push(m, "info"), [push]);
  const warning = useCallback((m: string) => push(m, "warning"), [push]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirmDialog = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirm({ opts, resolve });
    });
  }, []);

  const resolveConfirm = useCallback((value: boolean) => {
    setConfirm((curr) => {
      if (curr) curr.resolve(value);
      return null;
    });
  }, []);

  const value: NotifyContextValue = { success, error, info, warning, confirm: confirmDialog };

  return (
    <NotifyContext.Provider value={value}>
      {children}

      {/* Toast container (top-right, stacked) */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: "min(92vw, 360px)",
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      {/* Confirm modal */}
      {confirm && (
        <ConfirmModal
          opts={confirm.opts}
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
      )}
    </NotifyContext.Provider>
  );
}

// =================== Toast item ===================
const VARIANT_STYLE: Record<ToastVariant, { bg: string; text: string; icon: string; border: string }> = {
  success: { bg: "bg-[#DCFCE7]", text: "text-[#15803D]", icon: "fa-check-circle", border: "border-[#86EFAC]" },
  error:   { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", icon: "fa-exclamation-circle", border: "border-[#FCA5A5]" },
  info:    { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]", icon: "fa-info-circle", border: "border-[#93C5FD]" },
  warning: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", icon: "fa-exclamation-triangle", border: "border-[#FCD34D]" },
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const s = VARIANT_STYLE[toast.variant];
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 px-3.5 py-3 rounded-lg border shadow-lg ${s.bg} ${s.text} ${s.border} animate-[slideInRight_0.25s_ease-out]`}
      style={{ animation: "slideInRight 0.25s ease-out" }}
    >
      <i className={`fas ${s.icon} text-base mt-0.5 flex-shrink-0`}></i>
      <div className="text-[13px] font-semibold leading-snug flex-1 break-words">{toast.message}</div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup"
        className="text-current opacity-60 hover:opacity-100 -mt-0.5"
      >
        <i className="fas fa-xmark text-xs"></i>
      </button>
    </div>
  );
}

// =================== Confirm modal ===================
function ConfirmModal({
  opts,
  onConfirm,
  onCancel,
}: {
  opts: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isDanger = opts.variant === "danger";
  // Close on Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 animate-[fadeIn_0.15s_ease-out]"
      style={{ animation: "fadeIn 0.15s ease-out" }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-[420px] w-full overflow-hidden animate-[scaleIn_0.2s_ease-out]"
        style={{ animation: "scaleIn 0.2s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            isDanger ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#FEF3C7] text-[#92400E]"
          }`}>
            <i className={`fas ${isDanger ? "fa-exclamation-triangle" : "fa-question-circle"} text-lg`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-[#1F2937]">
              {opts.title || (isDanger ? "Konfirmasi Penghapusan" : "Konfirmasi")}
            </h3>
            <p className="text-[13px] text-[#6B7280] mt-1 whitespace-pre-line leading-relaxed">{opts.message}</p>
          </div>
        </div>
        <div className="p-3 bg-[#F9FAFB] flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
            style={{ width: "auto" }}
          >
            {opts.cancelText || "Batal"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={isDanger ? "btn btn-danger" : "btn btn-primary"}
            style={{ width: "auto" }}
          >
            {opts.confirmText || (isDanger ? "Hapus" : "Lanjut")}
          </button>
        </div>
      </div>
    </div>
  );
}
