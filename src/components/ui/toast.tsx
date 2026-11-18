"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "./cn";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; message: string; kind: ToastKind };

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

function readFlash(): { message: string; kind: ToastKind } | null {
  const raw = document.cookie.split("; ").find((c) => c.startsWith("ch_flash="));
  if (!raw) return null;
  document.cookie = "ch_flash=; Max-Age=0; path=/";
  try {
    return JSON.parse(decodeURIComponent(raw.slice("ch_flash=".length)));
  } catch {
    return null;
  }
}

/** App-wide toasts. Also shows "flash" messages set by server actions before a redirect. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4000);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <FlashReader push={push} />
      </Suspense>
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-sm",
              t.kind === "error" ? "border-danger/30 bg-danger-soft text-danger" : t.kind === "info" ? "border-line bg-surface text-ink" : "border-success/30 bg-success-soft text-success",
            )}
          >
            {t.kind === "error" ? <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : t.kind === "info" ? <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />}
            <span className="flex-1">{t.message}</span>
            <button type="button" aria-label="Dismiss" className="opacity-70 hover:opacity-100" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}>
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Flash cookies arrive with a server-action redirect, so check after every navigation. */
function FlashReader({ push }: { push: (message: string, kind?: ToastKind) => void }) {
  const pathname = usePathname();
  useEffect(() => {
    const f = readFlash();
    if (f) push(f.message, f.kind);
  }, [pathname, push]);
  return null;
}
