"use client";

import { useState, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  content: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  initialId?: string;
  onChange?: (id: string) => void;
  className?: string;
}

export function Tabs({ items, initialId, onChange, className = "" }: TabsProps) {
  const [active, setActive] = useState(initialId ?? items[0]?.id);

  function select(id: string) {
    setActive(id);
    onChange?.(id);
  }

  const activeItem = items.find((i) => i.id === active) ?? items[0];

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => select(item.id)}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-amber-500 text-navy-900"
                  : "border-transparent text-slate-500 hover:text-navy-800"
              }`}
            >
              {item.icon}
              {item.label}
              {typeof item.count === "number" && (
                <span
                  className={`ml-0.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    isActive ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="pt-4">{activeItem?.content}</div>
    </div>
  );
}

/** Simple controlled pill switcher (e.g. view toggles). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`inline-flex rounded-xl bg-slate-100 p-1 ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
            value === opt.value
              ? "bg-white text-navy-900 shadow-sm"
              : "text-slate-500 hover:text-navy-800"
          }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
