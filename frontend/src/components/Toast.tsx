/**
 * Lightweight toast notification system for the dashboard.
 *
 * Dispatches window custom events so any component can trigger a toast
 * without needing a shared React context.
 *
 * Usage (from anywhere):
 *   window.dispatchEvent(new CustomEvent("bhojon:toast", { detail: { ... } }))
 */

import { useEffect, useState, useCallback } from "react";
import { Icon } from "@/components/Icon";

export interface ToastData {
  id?: string;
  kind: "success" | "warning" | "info" | "error";
  title: string;
  body?: string;
  duration?: number; // ms, default 6000. Set to 0 or omit for persistent (manual dismiss only).
}

interface InternalToast extends ToastData {
  id: string;
}

const KIND_STYLES: Record<ToastData["kind"], { bg: string; border: string; icon: string }> = {
  success: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "success" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", icon: "warning" },
  info:    { bg: "bg-blue-50",   border: "border-blue-200",   icon: "info" },
  error:   { bg: "bg-red-50",    border: "border-red-200",    icon: "error" },
};

export function showToast(toast: ToastData) {
  window.dispatchEvent(new CustomEvent("bhojon:toast", { detail: toast }));
}

export function dismissToast(id: string) {
  window.dispatchEvent(new CustomEvent("bhojon:toast:dismiss", { detail: { id } }));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<InternalToast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    function handler(e: Event) {
      const data = (e as CustomEvent<ToastData>).detail;
      const id = data.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const toast: InternalToast = { ...data, id };
      setToasts((prev) => [...prev.slice(-4), toast]); // max 5 toasts
      // Auto-dismiss only if duration is a positive number.
      const dur = data.duration ?? 6000;
      if (dur > 0) {
        setTimeout(() => remove(id), dur);
      }
    }
    function dismissHandler(e: Event) {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      remove(id);
    }
    window.addEventListener("bhojon:toast", handler);
    window.addEventListener("bhojon:toast:dismiss", dismissHandler);
    return () => {
      window.removeEventListener("bhojon:toast", handler);
      window.removeEventListener("bhojon:toast:dismiss", dismissHandler);
    };
  }, [remove]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-20 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const s = KIND_STYLES[t.kind];
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-xl border ${s.border} ${s.bg} p-3.5 shadow-lift animate-[slideIn_0.2s_ease-out]`}
            role="alert"
          >
            <span className="mt-0.5 shrink-0">
              <Icon name={s.icon as "success" | "warning" | "info" | "error"} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-900">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs text-ink-600">{t.body}</p>}
            </div>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="shrink-0 text-ink-400 hover:text-ink-600"
              aria-label="Dismiss"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
