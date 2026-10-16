import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: {
    value: string;
    direction: "up" | "down";
  };
  color?: "amber" | "navy" | "green" | "blue" | "red";
}

const colorMap = {
  amber: {
    bg: "bg-amber-50",
    icon: "text-amber-600",
    iconBg: "bg-amber-100",
  },
  navy: {
    bg: "bg-navy-50",
    icon: "text-navy-700",
    iconBg: "bg-navy-100",
  },
  green: {
    bg: "bg-emerald-50",
    icon: "text-emerald-600",
    iconBg: "bg-emerald-100",
  },
  blue: {
    bg: "bg-blue-50",
    icon: "text-blue-600",
    iconBg: "bg-blue-100",
  },
  red: {
    bg: "bg-red-50",
    icon: "text-red-600",
    iconBg: "bg-red-100",
  },
};

export function StatCard({ icon: Icon, label, value, trend, color = "amber" }: StatCardProps) {
  const colors = colorMap[color];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg ${colors.iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trend.direction === "up"
                ? "text-emerald-700 bg-emerald-50"
                : "text-red-700 bg-red-50"
            }`}
          >
            {trend.direction === "up" ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {trend.value}
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-navy-900">{value}</p>
        <p className="text-sm text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
