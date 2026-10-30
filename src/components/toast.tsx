"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Toasts from DeskStates: bottom-left of the content area, max 400px, one at a time, 4 s (6 s with an action).
 * Light = confirmation ("Saved to My List · Undo"), error = dark red with Retry.
 */
type ToastTone = "light" | "error" | "coral";
type ToastInput = { message: string; tone?: ToastTone; action?: { label: string; onClick: () => void } };
type ActiveToast = ToastInput & { id: number };

type ToastContextValue = { show: (t: ToastInput) => void; dismiss: () => void; toast: ActiveToast | null };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const counter = useRef(0);

  const show = useCallback((t: ToastInput) => {
    counter.current += 1;
    setToast({ ...t, id: counter.current });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const ms = toast.action ? 6000 : 4000;
    const timer = window.setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), ms);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => ({ show, dismiss, toast }), [show, dismiss, toast]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/** Where toasts render. Each layout mounts one (inside the shell it sits right of the side nav). */
export function ToastOutlet() {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;
  return <ToastView toast={ctx.toast} onDismiss={ctx.dismiss} />;
}

function ToastView({ toast, onDismiss }: { toast: ActiveToast | null; onDismiss: () => void }) {
  const tone = toast?.tone ?? "light";
  const styles: Record<ToastTone, string> = {
    light: "bg-ink text-on-coral",
    error: "bg-error-toast text-error-ink",
    coral: "bg-coral text-on-coral",
  };
  const actionColor = tone === "error" ? "text-error-icon" : "text-undo";
  return (
    <div className="dk-toast-wrap" aria-live="polite" aria-atomic="true">
      {toast ? (
        <div
          key={toast.id}
          role={tone === "error" ? "alert" : "status"}
          className={`flex items-center gap-3 rounded-[14px] py-3 ${toast.action ? "pl-4 pr-2" : "px-4"} shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${styles[tone]}`}
        >
          <span className="flex-1 text-[15px] font-semibold">{toast.message}</span>
          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                onDismiss();
              }}
              className={`h-11 border-0 bg-transparent px-3 text-[15px] font-bold ${actionColor}`}
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
