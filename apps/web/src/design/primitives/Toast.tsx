"use client";
import * as React from "react";
import * as RadixToast from "@radix-ui/react-toast";

type Tone = "neutral" | "success" | "warn" | "danger" | "info";

interface ToastInput {
  title: string;
  description?: string;
  tone?: Tone;
  durationMs?: number;
}

interface QueuedToast extends ToastInput { id: number; }

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<QueuedToast[]>([]);
  const nextIdRef = React.useRef(1);

  const toast = React.useCallback((input: ToastInput) => {
    const id = nextIdRef.current++;
    setItems((prev) => [...prev, { id, ...input }]);
  }, []);

  function remove(id: number) {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      <RadixToast.Provider swipeDirection="right">
        {children}
        {items.map((t) => (
          <RadixToast.Root
            key={t.id}
            duration={t.durationMs ?? 4000}
            className={`psd-toast ${t.tone ? `psd-toast--${t.tone}` : ""}`}
            onOpenChange={(open) => { if (!open) remove(t.id); }}
          >
            <RadixToast.Title className="psd-toast-title">{t.title}</RadixToast.Title>
            {t.description && (
              <RadixToast.Description className="psd-toast-description">
                {t.description}
              </RadixToast.Description>
            )}
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="psd-toast-viewport" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
