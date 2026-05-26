"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

// ─── Toast ────────────────────────────────────────────────

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface UIContextValue {
  toast: (message: string, type?: ToastType) => void;
  confirm: (message: string) => Promise<boolean>;
}

const UIContext = createContext<UIContextValue>({
  toast: () => {},
  confirm: () => Promise.resolve(false),
});

export function useUI() {
  return useContext(UIContext);
}

let toastId = 0;

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({ message, resolve });
    });
  }, []);

  const handleConfirm = (value: boolean) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  const toastColors: Record<ToastType, string> = {
    success: "oklch(45% 0.15 145)",
    error: "oklch(50% 0.15 25)",
    info: "var(--color-accent)",
  };

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast stack */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: "24rem" }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto font-[family-name:var(--font-body)] text-[var(--text-sm)] px-[var(--space-4)] py-[var(--space-3)] shadow-lg"
            style={{
              background: "var(--color-bg-elevated)",
              color: "var(--color-text)",
              borderRadius: "var(--radius-md)",
              borderLeft: `3px solid ${toastColors[t.type]}`,
            }}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Confirm dialog overlay */}
      {dialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center" style={{ background: "oklch(0 0 0 / 0.4)" }}>
          <div
            className="p-[var(--space-8)] max-w-[24rem] w-full"
            style={{ background: "var(--color-bg-elevated)", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-border)" }}
          >
            <p className="font-[family-name:var(--font-body)] text-[var(--text-base)] mb-[var(--space-6)]" style={{ color: "var(--color-text)" }}>
              {dialog.message}
            </p>
            <div className="flex gap-[var(--space-3)] justify-end">
              <button
                onClick={() => handleConfirm(false)}
                className="font-[family-name:var(--font-body)] text-[var(--text-sm)] px-[var(--space-4)] py-[var(--space-2)]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirm(true)}
                className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-[var(--space-4)] py-[var(--space-2)]"
                style={{ background: "oklch(55% 0.15 25)", color: "oklch(98% 0 0)", borderRadius: "var(--radius-md)" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}
