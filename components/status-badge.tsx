type StatusType =
  | "pending"
  | "confirmed"
  | "processing"
  | "delivering"
  | "delivered"
  | "cancelled"
  | "completed"
  | "active"
  | "inactive"
  | "low"
  | "critical"
  | "in_stock"
  | "out_of_stock"
  | "clocked_in"
  | "clocked_out";

interface StatusBadgeProps {
  status: string;
  label?: string;
}

const statusConfig: Record<string, { bg: string; text: string; dot?: string }> = {
  pending: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  confirmed: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  processing: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  delivering: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  delivered: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  completed: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  cancelled: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  active: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  inactive: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
  low: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  critical: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  in_stock: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  out_of_stock: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  clocked_in: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  clocked_out: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
};

function formatLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || {
    bg: "bg-slate-100",
    text: "text-slate-600",
    dot: "bg-slate-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {label || formatLabel(status)}
    </span>
  );
}
