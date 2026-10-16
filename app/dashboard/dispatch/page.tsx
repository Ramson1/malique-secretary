"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Send,
  RefreshCw,
  Clock,
  Phone,
  MapPin,
  User,
  Truck,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  Navigation,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  Button,
  Input,
  Select,
  Modal,
  Card,
  PageHeader,
  useToast,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

// Rider dispatch board for the front desk — the same live board the admin
// portal uses, scoped to the secretary's branch by default.
interface Rider {
  id: string;
  fullName: string;
  phone?: string;
  activeLoad: number;
}

interface DeliveryCard {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  riderId: string;
  riderName: string;
  customerName: string;
  customerPhone: string;
  address: string;
  branchName: string;
  total: number;
  scheduledAt: string | null;
  windowLabel: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  notes: string | null;
}

interface Board {
  columns: {
    awaiting: DeliveryCard[];
    onTheRoad: DeliveryCard[];
    delivered: DeliveryCard[];
    issues: DeliveryCard[];
  };
  riders: Rider[];
}

interface BranchOption {
  id: string;
  name: string;
}

const PRIORITY_TONE: Record<string, "red" | "amber" | "slate"> = {
  high: "red",
  normal: "amber",
  low: "slate",
};

// Column key -> the status written when a card is dropped into it.
const COLUMN_DROP_STATUS: Record<string, string> = {
  awaiting: "assigned",
  onTheRoad: "in_transit",
  delivered: "delivered",
  issues: "failed",
};

const COLUMNS: {
  key: keyof Board["columns"];
  label: string;
  icon: any;
  dropStatus: string;
}[] = [
  { key: "awaiting", label: "Awaiting Rider", icon: User, dropStatus: "assigned" },
  { key: "onTheRoad", label: "On the Road", icon: Truck, dropStatus: "in_transit" },
  { key: "delivered", label: "Delivered", icon: CheckCircle2, dropStatus: "delivered" },
  { key: "issues", label: "Issues", icon: AlertTriangle, dropStatus: "failed" },
];

function fmtDateTime(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

// datetime-local value from an ISO string (local time, no timezone suffix).
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PortalDispatchPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState("");
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(false);

  const [scheduleModal, setScheduleModal] = useState(false);
  const [target, setTarget] = useState<DeliveryCard | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    scheduledAt: "",
    windowLabel: "",
    priority: "normal",
    notes: "",
  });

  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get<{ branches: BranchOption[] }>("/admin/branches");
        const list = d.branches ?? [];
        setBranches(list);
        // Secretaries sit at one branch; open the board on their own jobs
        // while still allowing a look at the other branch.
        const mine =
          list.find((b) => b.id === user?.branchId) ??
          list.find((b) => b.name?.includes("Igboh")) ??
          list[0];
        if (mine) setBranchId(mine.id);
      } catch {
        /* non-fatal */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
      const d = await api.get<Board>(`/admin/dispatch${q}`);
      setBoard(d);
    } catch {
      toast.error("Could not load the dispatch board.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live board: new website orders and rider progress appear without a manual
  // refresh.
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  function openSchedule(c: DeliveryCard) {
    setTarget(c);
    setScheduleForm({
      scheduledAt: toLocalInput(c.scheduledAt),
      windowLabel: c.windowLabel ?? "",
      priority: c.priority ?? "normal",
      notes: c.notes ?? "",
    });
    setScheduleModal(true);
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    try {
      await api.patch(`/admin/dispatch/${target.id}/schedule`, {
        scheduledAt: scheduleForm.scheduledAt
          ? new Date(scheduleForm.scheduledAt).toISOString()
          : "",
        windowLabel: scheduleForm.windowLabel,
        priority: scheduleForm.priority,
        notes: scheduleForm.notes,
      });
      toast.success("Schedule updated.");
      setScheduleModal(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update schedule.");
    }
  }

  async function dispatch(c: DeliveryCard) {
    try {
      await api.post(`/admin/dispatch/${c.id}/dispatch`, {});
      toast.success(`${c.orderNumber} dispatched — the rider has been alerted.`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not dispatch.");
    }
  }

  async function changeRider(c: DeliveryCard, riderId: string) {
    if (!riderId) return;
    try {
      await api.patch(`/admin/dispatch/${c.id}/rider`, { riderId });
      toast.success("Rider assigned — instant alert sent.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not assign rider.");
    }
  }

  async function dropInto(colDropStatus: string) {
    if (!dragId) return;
    try {
      await api.patch(`/admin/dispatch/${dragId}/status`, { status: colDropStatus });
      toast.success("Delivery moved.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not move delivery.");
    } finally {
      setDragId(null);
    }
  }

  const riders = board?.riders ?? [];
  const awaitingCount = board?.columns.awaiting.length ?? 0;
  const onRoadCount = board?.columns.onTheRoad.length ?? 0;
  const idleRiders = riders.filter((r) => r.activeLoad === 0).length;

  return (
    <DashboardLayout
      title="Dispatch"
      subtitle="Assign riders, schedule windows and track deliveries live"
    >
      <div className="space-y-6">
        <PageHeader
          title="Rider Dispatch Board"
          description="Drag a card between columns to change its stage, or use the actions on each card."
          icon={<Send className="w-5 h-5" />}
          actions={
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={load}
              loading={loading}
            >
              Refresh
            </Button>
          }
        />

        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-56">
              <Select
                label="Branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2 pb-1">
              <Badge tone={awaitingCount > 0 ? "amber" : "green"} dot>
                {awaitingCount} waiting for a rider
              </Badge>
              <Badge tone={onRoadCount > 0 ? "blue" : "slate"} dot>
                {onRoadCount} on the road
              </Badge>
              <Badge tone={idleRiders > 0 ? "green" : "red"} dot>
                {idleRiders} rider{idleRiders === 1 ? "" : "s"} free
              </Badge>
            </div>
          </div>

          {/* Rider load strip */}
          {riders.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {riders.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5"
                >
                  <Truck className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-medium text-navy-800">{r.fullName}</span>
                  <Badge tone={r.activeLoad > 3 ? "red" : r.activeLoad > 0 ? "amber" : "green"}>
                    {r.activeLoad > 0 ? `${r.activeLoad} out` : "waiting"}
                  </Badge>
                  {r.phone && (
                    <a
                      href={`tel:${r.phone}`}
                      className="text-[11px] text-navy-600 hover:underline"
                    >
                      {r.phone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Board columns */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = board?.columns[col.key] ?? [];
            const Icon = col.icon;
            return (
              <div
                key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropInto(COLUMN_DROP_STATUS[col.key])}
                className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/60"
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-navy-700" />
                    <p className="text-sm font-semibold text-navy-900">{col.label}</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
                    {items.length}
                  </span>
                </div>
                <div className="flex-1 space-y-3 p-3">
                  {items.length === 0 && (
                    <p className="py-6 text-center text-xs text-slate-400">Nothing here</p>
                  )}
                  {items.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => setDragId(null)}
                      className={`cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow ${
                        dragId === c.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-navy-900">{c.orderNumber}</p>
                        <Badge tone={PRIORITY_TONE[c.priority] ?? "slate"}>{c.priority}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{c.customerName}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="h-3 w-3" />
                        <span className="line-clamp-1">{c.address}</span>
                      </p>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="font-semibold text-navy-900">
                          {formatMoney(c.total)}
                        </span>
                        {c.windowLabel && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <CalendarClock className="h-3 w-3" />
                            {c.windowLabel}
                          </span>
                        )}
                      </div>
                      {c.scheduledAt && fmtDateTime(c.scheduledAt) && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="h-3 w-3" /> {fmtDateTime(c.scheduledAt)}
                        </p>
                      )}
                      <div className="mt-3 space-y-2">
                        <Select
                          value={c.riderId}
                          onChange={(e) => changeRider(c, e.target.value)}
                          className="!h-9 text-xs"
                        >
                          <option value="">Assign rider…</option>
                          {riders.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.fullName} ({r.activeLoad})
                            </option>
                          ))}
                        </Select>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 !h-8 text-xs"
                            leftIcon={<CalendarClock className="h-3.5 w-3.5" />}
                            onClick={() => openSchedule(c)}
                          >
                            Schedule
                          </Button>
                          {col.key === "awaiting" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="flex-1 !h-8 text-xs"
                              leftIcon={<Truck className="h-3.5 w-3.5" />}
                              onClick={() => dispatch(c)}
                            >
                              Dispatch
                            </Button>
                          )}
                          {col.key === "onTheRoad" && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                                c.address,
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-navy-700 hover:bg-slate-50"
                            >
                              <Navigation className="h-3.5 w-3.5" /> Route
                            </a>
                          )}
                        </div>
                        {c.customerPhone && (
                          <a
                            href={`tel:${c.customerPhone}`}
                            className="flex items-center gap-1 text-[11px] text-navy-600 hover:underline"
                          >
                            <Phone className="h-3 w-3" /> {c.customerPhone}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedule modal */}
      <Modal
        open={scheduleModal}
        onClose={() => setScheduleModal(false)}
        title="Schedule Delivery"
        description={target ? `${target.orderNumber} · ${target.customerName}` : ""}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setScheduleModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="schedule-form">
              Save
            </Button>
          </>
        }
      >
        <form id="schedule-form" onSubmit={saveSchedule} className="space-y-4">
          <Input
            type="datetime-local"
            label="Scheduled for"
            value={scheduleForm.scheduledAt}
            onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
          />
          <Input
            label="Window label (optional)"
            value={scheduleForm.windowLabel}
            onChange={(e) => setScheduleForm({ ...scheduleForm, windowLabel: e.target.value })}
            placeholder="e.g. Morning 8–12"
          />
          <Select
            label="Priority"
            value={scheduleForm.priority}
            onChange={(e) => setScheduleForm({ ...scheduleForm, priority: e.target.value })}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </Select>
          <Input
            label="Notes (optional)"
            value={scheduleForm.notes}
            onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
            placeholder="Gate code, landmark, handling…"
          />
        </form>
      </Modal>
    </DashboardLayout>
  );
}
