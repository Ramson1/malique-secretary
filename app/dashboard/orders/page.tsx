"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  Eye,
  CheckCircle2,
  Cog,
  Truck,
  PackageCheck,
  Ban,
  Printer,
  RefreshCw,
  Banknote,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  Button,
  DataGrid,
  FilterBar,
  Modal,
  PageHeader,
  StatTile,
  SkeletonList,
  ExportMenu,
  useToast,
  type Column,
  type FilterField,
} from "@/components/ui";
import { downloadReport } from "@/lib/export";
import { formatDateTime, formatMoney } from "@/lib/format";
import { api } from "@/lib/api/client";

// Order queue fed by every channel: website orders, phone orders and the
// counter (POS) all land in the same table, so this is the single place the
// secretary works from. The API auto-scopes the list to the staff member's own
// branch.
interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: number;
  status: string;
  branchName: string;
  orderType?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  totalPages: number;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string;
  branchName: string;
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  notes: string;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  timeline: Array<{ status: string; timestamp: string; note?: string }>;
}

const STATUS_TONE: Record<
  string,
  "amber" | "blue" | "purple" | "green" | "red" | "neutral"
> = {
  pending: "amber",
  confirmed: "blue",
  processing: "purple",
  delivering: "purple",
  delivered: "green",
  cancelled: "red",
};

const SOURCE_LABEL: Record<string, string> = {
  online: "Website",
  phone: "Phone",
  walk_in: "Counter",
};

const SOURCE_TONE: Record<string, "blue" | "purple" | "slate"> = {
  online: "blue",
  phone: "purple",
  walk_in: "slate",
};

// Front-desk progression. Riders close the delivery itself; this tracks the
// order through the shop.
const NEXT_STATUS: Record<
  string,
  { to: string; label: string; icon: typeof CheckCircle2 }
> = {
  pending: { to: "confirmed", label: "Confirm", icon: CheckCircle2 },
  confirmed: { to: "processing", label: "Prepare", icon: Cog },
  processing: { to: "delivering", label: "Hand to Rider", icon: Truck },
  delivering: { to: "delivered", label: "Mark Delivered", icon: PackageCheck },
};

export default function PortalOrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({
    search: "",
    status: "",
    source: "",
  });
  const [committedSearch, setCommittedSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState<string | null>(null);

  const [viewing, setViewing] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (filters.status) params.set("status", filters.status);
      if (committedSearch) params.set("search", committedSearch);
      const data = await api.get<OrdersResponse>(`/admin/orders?${params.toString()}`);
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setSelected(new Set());
    } catch {
      toast.error("Could not load orders. Please retry.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters.status, committedSearch]);

  useEffect(() => {
    const id = setTimeout(() => {
      setCommittedSearch(filters.search);
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [filters.search]);

  useEffect(() => {
    load();
  }, [load]);

  // New website orders must show up without the secretary leaving their seat.
  useEffect(() => {
    const id = setInterval(() => {
      // Skip churn while a modal is open so the detail view never goes stale
      // under the user's hands.
      if (!viewing) load();
    }, 30000);
    return () => clearInterval(id);
  }, [load, viewing]);

  const visibleOrders = useMemo(
    () =>
      filters.source
        ? orders.filter((o) => (o.orderType ?? "") === filters.source)
        : orders,
    [orders, filters.source],
  );

  const stats = useMemo(() => {
    const newToday = orders.filter(
      (o) => new Date(o.createdAt).toDateString() === new Date().toDateString(),
    ).length;
    return {
      newToday,
      open: orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length,
      unpaid: orders.filter(
        (o) => o.paymentStatus !== "paid" && o.status !== "cancelled",
      ).length,
    };
  }, [orders]);

  async function advance(order: Order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setWorking(order.id);
    try {
      await api.patch(`/admin/orders/${order.id}/status`, { status: next.to });
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: next.to } : o)),
      );
      toast.success(`${order.orderNumber} → ${next.to.replace("_", " ")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the order.");
    } finally {
      setWorking(null);
    }
  }

  async function cancel(order: Order) {
    setWorking(order.id);
    try {
      await api.patch(`/admin/orders/${order.id}/status`, {
        status: "cancelled",
        cancelReason: "Cancelled at the front desk",
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: "cancelled" } : o)),
      );
      toast.success(`${order.orderNumber} cancelled.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel the order.");
    } finally {
      setWorking(null);
    }
  }

  async function confirmPayment(order: Order) {
    setWorking(order.id);
    try {
      await api.post(`/payments/${order.id}/confirm`, {});
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, paymentStatus: "paid" } : o)),
      );
      toast.success(`Payment for ${order.orderNumber} confirmed.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not confirm the payment.");
    } finally {
      setWorking(null);
    }
  }

  async function openDetail(order: Order) {
    setViewing({ id: order.id, orderNumber: order.orderNumber, status: order.status } as OrderDetail);
    setDetailLoading(true);
    try {
      const d = await api.get<OrderDetail>(`/admin/orders/${order.id}`);
      setViewing(d);
    } catch {
      toast.error("Could not load the order details.");
      setViewing(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const selectedIds = useMemo(() => [...selected], [selected]);

  const filterFields: FilterField[] = useMemo(
    () => [
      { key: "search", type: "search", placeholder: "Search order no. or customer…" },
      {
        key: "status",
        type: "select",
        label: "All Status",
        options: [
          { value: "pending", label: "Pending" },
          { value: "confirmed", label: "Confirmed" },
          { value: "processing", label: "Preparing" },
          { value: "delivering", label: "Out for Delivery" },
          { value: "delivered", label: "Delivered" },
          { value: "cancelled", label: "Cancelled" },
        ],
      },
      {
        key: "source",
        type: "select",
        label: "All Channels",
        options: [
          { value: "online", label: "Website" },
          { value: "phone", label: "Phone" },
          { value: "walk_in", label: "Counter" },
        ],
      },
    ],
    [],
  );

  const columns: Column<Order>[] = [
    {
      key: "order",
      header: "Order",
      sortable: true,
      sortValue: (r) => r.orderNumber,
      render: (o) => (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-navy-900">{o.orderNumber}</span>
          {o.orderType && (
            <Badge tone={SOURCE_TONE[o.orderType] ?? "slate"}>
              {SOURCE_LABEL[o.orderType] ?? o.orderType}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (o) => (
        <div>
          <p className="text-sm font-medium text-slate-700">{o.customerName}</p>
          {o.customerPhone && (
            <a
              href={`tel:${o.customerPhone}`}
              className="text-xs text-navy-600 hover:underline"
            >
              {o.customerPhone}
            </a>
          )}
        </div>
      ),
    },
    {
      key: "date",
      header: "Placed",
      sortable: true,
      sortValue: (r) => new Date(r.createdAt).getTime(),
      render: (o) => (
        <span className="text-sm text-slate-500">{formatDateTime(o.createdAt)}</span>
      ),
    },
    {
      key: "amount",
      header: "Total",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total,
      render: (o) => (
        <span className="text-sm font-semibold text-navy-900">{formatMoney(o.total)}</span>
      ),
    },
    {
      key: "payment",
      header: "Payment",
      render: (o) => (
        <Badge tone={o.paymentStatus === "paid" ? "green" : "amber"} dot>
          <span className="capitalize">{o.paymentStatus === "paid" ? "Paid" : "Unpaid"}</span>
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (o) => (
        <Badge tone={STATUS_TONE[o.status] ?? "neutral"} dot>
          <span className="capitalize">{o.status.replace("_", " ")}</span>
        </Badge>
      ),
    },
  ];

  return (
    <DashboardLayout title="Orders" subtitle="Website, phone and counter orders in one queue">
      <div className="space-y-6">
        <PageHeader
          title="Unified Orders"
          description="Every channel lands here. Confirm, prepare, hand to a rider and log payments."
          icon={<ShoppingCart className="w-5 h-5" />}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw className="w-4 h-4" />}
                onClick={load}
                loading={loading}
              >
                Refresh
              </Button>
              <ExportMenu
                kind="orders"
                filters={{ status: filters.status, search: committedSearch }}
                onPick={
                  selectedIds.length > 0
                    ? (format) =>
                        downloadReport("orders", format, {
                          status: filters.status,
                          search: committedSearch,
                          ids: selectedIds.join(","),
                        })
                    : undefined
                }
              />
            </>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            icon={<ShoppingCart className="h-5 w-5" />}
            label="New today"
            value={stats.newToday}
            hint="Orders placed since midnight"
            accent="amber"
          />
          <StatTile
            icon={<Truck className="h-5 w-5" />}
            label="Still open"
            value={stats.open}
            hint="Not delivered or cancelled yet"
            accent="blue"
          />
          <StatTile
            icon={<Banknote className="h-5 w-5" />}
            label="Awaiting payment"
            value={stats.unpaid}
            hint="Confirm once money is in"
            accent="green"
          />
        </div>

        <FilterBar
          fields={filterFields}
          values={filters}
          onChange={(key, value) => {
            setFilters((prev) => ({ ...prev, [key]: value }));
            setPage(1);
          }}
          onReset={() => setFilters({ search: "", status: "", source: "" })}
        />

        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <span>
              <strong>{selectedIds.length}</strong> order
              {selectedIds.length > 1 ? "s" : ""} selected — Export will cover only the
              selected rows.
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </div>
        )}

        <DataGrid
          columns={columns}
          rows={visibleOrders}
          loading={loading}
          getRowId={(r) => r.id}
          pageSize={25}
          selectable
          selectedIds={selected}
          onSelectionChange={(ids) => setSelected(new Set(ids))}
          onRowClick={(o) => openDetail(o)}
          emptyTitle="No orders in this view"
          emptyHint="Website, phone and counter orders all arrive here automatically."
          rowActions={(o) => {
            const next = NEXT_STATUS[o.status];
            const canCancel = ["pending", "confirmed", "processing"].includes(o.status);
            return (
              <div className="inline-flex items-center justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openDetail(o)}
                  aria-label="View order"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {o.paymentStatus !== "paid" && o.status !== "cancelled" && (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={working === o.id}
                    leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    onClick={() => confirmPayment(o)}
                  >
                    Confirm Payment
                  </Button>
                )}
                {next && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={working === o.id}
                    leftIcon={<next.icon className="w-3.5 h-3.5" />}
                    onClick={() => advance(o)}
                  >
                    {next.label}
                  </Button>
                )}
                {canCancel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    leftIcon={<Ban className="w-3.5 h-3.5" />}
                    onClick={() => cancel(o)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            );
          }}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1 text-sm text-slate-500">
            <p>
              Page {page} of {totalPages} · {total} orders
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `Order ${viewing.orderNumber}` : undefined}
        description={viewing && !detailLoading ? formatDateTime(viewing.createdAt) : undefined}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
            <Button leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      >
        {detailLoading && (
          <SkeletonList rows={4} />
        )}
        {viewing && !detailLoading && (
          <div id="receipt-print" className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-navy-900">{viewing.customerName}</p>
                <p className="text-xs text-slate-500">
                  {[viewing.customerPhone, viewing.customerEmail].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Badge tone={STATUS_TONE[viewing.status] ?? "neutral"} dot>
                <span className="capitalize">{viewing.status.replace("_", " ")}</span>
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-2">
              <p className="text-slate-500">
                Branch: <span className="font-medium text-navy-800">{viewing.branchName}</span>
              </p>
              <p className="text-slate-500">
                Payment:{" "}
                <span className="font-medium text-navy-800 capitalize">
                  {viewing.paymentMethod || "—"}
                </span>
              </p>
              {viewing.deliveryAddress && (
                <p className="text-slate-500 sm:col-span-2">
                  Deliver to:{" "}
                  <span className="font-medium text-navy-800">{viewing.deliveryAddress}</span>
                </p>
              )}
              {viewing.notes && (
                <p className="text-slate-500 sm:col-span-2">
                  Note: <span className="font-medium text-navy-800">{viewing.notes}</span>
                </p>
              )}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-1.5">Item</th>
                  <th className="py-1.5 text-center">Qty</th>
                  <th className="py-1.5 text-right">Price</th>
                  <th className="py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {viewing.items.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="py-1.5 text-navy-900">{it.productName}</td>
                    <td className="py-1.5 text-center text-slate-600">{it.quantity}</td>
                    <td className="py-1.5 text-right text-slate-600">
                      {formatMoney(it.unitPrice)}
                    </td>
                    <td className="py-1.5 text-right font-medium text-navy-900">
                      {formatMoney(it.totalPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1.5 border-t border-slate-200 pt-3">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatMoney(viewing.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Delivery fee</span>
                <span>{formatMoney(viewing.deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-navy-900">
                <span>Total</span>
                <span>{formatMoney(viewing.total)}</span>
              </div>
            </div>

            {viewing.timeline?.length > 0 && (
              <div className="border-t border-slate-200 pt-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  History
                </p>
                <ul className="space-y-1">
                  {viewing.timeline.map((t, i) => (
                    <li key={i} className="flex justify-between text-xs text-slate-500">
                      <span className="capitalize text-navy-800">
                        {t.status.replace("_", " ")}
                        {t.note ? ` — ${t.note}` : ""}
                      </span>
                      <span>{formatDateTime(t.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
