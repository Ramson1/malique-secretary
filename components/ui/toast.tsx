"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastKind = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  push: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const config: Record<
  ToastKind,
  { icon: typeof Info; ring: string; iconColor: string; bar: string }
> = {
  success: { icon: CheckCircle2, ring: "ring-emerald-200", iconColor: "text-emerald-600", bar: "bg-emerald-500" },
  error: { icon: XCircle, ring: "ring-red-200", iconColor: "text-red-600", bar: "bg-red-500" },
  info: { icon: Info, ring: "ring-blue-200", iconColor: "text-blue-600", bar: "bg-blue-500" },
  warning: { icon: AlertTriangle, ring: "ring-amber-200", iconColor: "text-amber-600", bar: "bg-amber-500" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  const value: ToastContextValue = {
    push,
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
    warning: (m) => push("warning", m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const c = config[t.kind];
          const Icon = c.icon;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl bg-white p-4 pl-5 shadow-lg ring-1 ${c.ring} animate-slide-in-left`}
            >
              <span className={`absolute left-0 top-0 h-full w-1 ${c.bar}`} />
              <Icon className={`h-5 w-5 shrink-0 ${c.iconColor}`} />
              <p className="flex-1 text-sm text-navy-900">{t.message}</p>
              <button
                onClick={() => remove(t.id)}
                className="text-slate-400 hover:text-navy-900"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
