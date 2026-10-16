"use client";

import { Search, RotateCcw, Calendar } from "lucide-react";
import type { ReactNode } from "react";

export type FilterFieldType = "search" | "select" | "date" | "daterange" | "text";

export interface FilterFieldOption {
  value: string;
  label: string;
}

export interface FilterField {
  key: string;
  type: FilterFieldType;
  placeholder?: string;
  options?: FilterFieldOption[];
  label?: string;
  width?: string;
}

export interface FilterBarProps {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset?: () => void;
  right?: ReactNode;
  className?: string;
}

const inputBase =
  "h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500";

export function FilterBar({
  fields,
  values,
  onChange,
  onReset,
  right,
  className = "",
}: FilterBarProps) {
  const hasActive = Object.values(values).some((v) => v !== "" && v != null);

  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${className}`}
    >
      {fields.map((f) => {
        if (f.type === "search" || f.type === "text") {
          return (
            <div key={f.key} className={`relative ${f.width ?? "min-w-[200px] flex-1"}`}>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder ?? "Search…"}
                className={`${inputBase} w-full pl-9`}
              />
            </div>
          );
        }
        if (f.type === "select") {
          return (
            <select
              key={f.key}
              value={values[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
              className={`${inputBase} ${f.width ?? "min-w-[140px]"} pr-8`}
              aria-label={f.label ?? f.key}
            >
              <option value="">{f.label ?? "All"}</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          );
        }
        if (f.type === "date") {
          return (
            <div key={f.key} className={`relative ${f.width ?? ""}`}>
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                className={`${inputBase} pl-9`}
                aria-label={f.label ?? f.key}
              />
            </div>
          );
        }
        if (f.type === "daterange") {
          return (
            <div key={f.key} className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={values[`${f.key}Start`] ?? ""}
                  onChange={(e) => onChange(`${f.key}Start`, e.target.value)}
                  className={`${inputBase} pl-9`}
                  aria-label={`${f.label ?? f.key} start`}
                />
              </div>
              <span className="text-slate-400">–</span>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={values[`${f.key}End`] ?? ""}
                  onChange={(e) => onChange(`${f.key}End`, e.target.value)}
                  className={`${inputBase} pl-9`}
                  aria-label={`${f.label ?? f.key} end`}
                />
              </div>
            </div>
          );
        }
        return null;
      })}

      {onReset && hasActive && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-navy-900"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      )}

      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}
