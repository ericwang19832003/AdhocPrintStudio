"use client";

import { useEffect } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastMessage {
  message: string;
  variant: ToastVariant;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  error: 6000,
};

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS[toast.variant]);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className={`toast toast-${toast.variant}`} role="status" aria-live="polite">
      <span className="toast-icon">
        {toast.variant === "success" ? "✓" : toast.variant === "error" ? "✕" : "ℹ"}
      </span>
      <span className="toast-message">{toast.message}</span>
      <button type="button" className="toast-close" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
