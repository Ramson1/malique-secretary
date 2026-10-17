import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

type Accent = "amber" | "navy" | "green" | "blue" | "red" | "purple";

const accents: Record<Accent, { tile: string; icon: string; ring: string }> = {
  amber: { tile: "bg-amber-50", icon: "text-amber-600", ring: "ring-amber-100" },
  navy: { tile: "bg-navy-50", icon: "text-navy-700", ring: "ring-navy-100" },
  green: { tile: "bg-emerald-50", icon: "text-emerald-600", ring: "ring-emerald-100" },
  blue: { tile: "bg-blue-50", icon: "text-blue-600", ring: "ring-blue-100" },
  red: { tile: "bg-red-50", icon: "text-red-600", ring: "ring-red-100" },
  purple: { tile: "bg-purple-50", icon: "text-purple-600", ring: "ring-purple-100" },
};

export interface StatTileProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: { value: string; direction: "up" | "down" };
  accent?: Accent;
  sparkline?: ReactNode;
  onClick?: () => void;
  /** Show a skeleton placeholder while the metric loads from the database. */
  loading?: boolean;
}

export function StatTile({
  icon,
  label,
  value,
  hint,
  trend,
  accent = "amber",
  sparkline,
  onClick,
  loading = false,
}: StatTileProps) {
  const a = accents[accent];
  if (loading) {
    return (
      <div
        aria-hidden
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-200/70" />
        <div className="mt-4 h-7 w-24 animate-pulse rounded-md bg-slate-200/70" />
        <div className="mt-2 h-4 w-1/2 animate-pulse rounded-md bg-slate-200/70" />
      </div>
    );
  }
  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all ${
        onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${a.tile} ${a.ring}`}>
          <span className={a.icon}>{icon}</span>
        </div>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
              trend.direction === "up"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {trend.direction === "up" ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trend.value}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold tracking-tight text-navy-900">{value}</p>
        <p className="mt-0.5 text-sm text-slate-500">{label}</p>
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
      {sparkline && <div className="mt-3 -mb-1">{sparkline}</div>}
    </div>
  );
}
