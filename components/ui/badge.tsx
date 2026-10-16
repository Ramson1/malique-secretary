import type { ReactNode } from "react";

type Tone =
  | "neutral"
  | "amber"
  | "navy"
  | "green"
  | "red"
  | "blue"
  | "purple"
  | "indigo"
  | "slate";

const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  navy: "bg-navy-50 text-navy-700 ring-navy-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  purple: "bg-purple-50 text-purple-700 ring-purple-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

const dotTones: Record<Tone, string> = {
  neutral: "bg-slate-400",
  amber: "bg-amber-500",
  navy: "bg-navy-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  indigo: "bg-indigo-500",
  slate: "bg-slate-400",
};

export interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", dot = false, children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotTones[tone]}`} />}
      {children}
    </span>
  );
}
