"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReceiptText,
  Eye,
  Ban,
  Printer,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  Button,
  Modal,
  DataGrid,
  FilterBar,
  PageHeader,
  useToast,
  ExportMenu,
  type Column,
  type FilterField,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { downloadReport } from "@/lib/export";
import { formatMoney, formatDateTime } from "@/lib/format";

interface SaleItem {
  id: string;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  sizeKg: string | number;
  product?: { name: string; category: string } | null;
}

interface Sale {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: string | number;
  discount: string | number;
  totalAmount: string | number;
  notes?: string | null;
  customer?: { fullName: string; phone?: string | null; email?: string | null } | null;
  branch?: { name: string } | null;
  items?: SaleItem[];
  payments?: Array<{ amount: string | number; status: string }>;
}

const STATUS_TONE: Record<string, "green" | "red" | "amber" | "slate" | "blue"> = {
  confirmed: "green",
  completed: "green",
  pending: "amber",
  processing: "blue",
  cancelled: "red",
};

function statusLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function SalesPage() {
  const toast = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({
    search: "",
    rangeStart: "",
    rangeEnd: "",
    mine: "true",
  });

  const [viewing, setViewing] = useState<Sale | null>(null);
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [working, setWorking] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectedIds = useMemo(() => [...selected], [selected]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200", mine: filters.mine || "false" });
      if (filters.search) params.set("search", filters.search);
      if (filters.rangeStart) params.set("from", filters.rangeStart);
      if (filters.rangeEnd) params.set("to", filters.rangeEnd);
      const data = await api.get<{ data: Sale[] }>(`/pos/sales?${params.toString()}`);
      setSales(data.data ?? []);
      setSelected(new Set());
    } catch {
      toast.error("Could not load transactions. Please retry.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.rangeStart, filters.rangeEnd, filters.mine]);

  useEffect(() => {
    load();
  }, [load]);

  const filterFields: FilterField[] = useMemo(
    () => [
      { key: "search", type: "search", placeholder: "Search order no. / customer / phone…" },
      { key: "range", type: "daterange", label: "Date" },
      {
        key: "mine",
        type: "select",
        label: "Scope",
        width: "min-w-[160px]",
        options: [
          { value: "true", label: "My sales only" },
          { value: "false", label: "All branch sales" },
        ],
      },
    ],
    [],
  );

  async function handleVoid(e: React.FormEvent) {
    e.preventDefault();
    if (!voidTarget || !voidReason.trim()) return;
    setWorking(true);
    try {
      await api.post(`/pos/sales/${voidTarget.id}/void`, { reason: voidReason.trim() });
      toast.success(`Transaction ${voidTarget.orderNumber} voided`);
      setVoidTarget(null);
      setVoidReason("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to void the transaction.");
    } finally {
      setWorking(false);
    }
  }

  const columns: Column<Sale>[] = [
    {
      key: "orderNumber",
      header: "Order",
      sortable: true,
      sortValue: (r) => r.orderNumber,
      render: (r) => <span className="font-semibold text-navy-900">{r.orderNumber}</span>,
    },
    {
      key: "createdAt",
      header: "Date",
      sortable: true,
      sortValue: (r) => new Date(r.createdAt).getTime(),
      render: (r) => <span className="text-sm text-slate-500">{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      render: (r) => (
        <span className="text-sm text-navy-800">{r.customer?.fullName ?? "Walk-in"}</span>
      ),
    },
    {
      key: "items",
      header: "Items",
      align: "center",
      render: (r) => <span className="text-sm text-slate-500">{r.items?.length ?? 0}</span>,
    },
    {
      key: "paymentMethod",
      header: "Payment",
      render: (r) => <span className="text-sm capitalize text-slate-600">{r.paymentMethod}</span>,
    },
    {
      key: "totalAmount",
      header: "Total",
      align: "right",
      sortable: true,
      sortValue: (r) => Number(r.totalAmount),
      render: (r) => <span className="font-semibold text-navy-900">{formatMoney(Number(r.totalAmount))}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge tone={STATUS_TONE[r.status] ?? "slate"} dot>
          {statusLabel(r.status)}
        </Badge>
      ),
    },
  ];

  return (
    <DashboardLayout title="My Transactions" subtitle="Every counter sale recorded at your branch">
      <div className="space-y-6">
        <PageHeader
          title="Transactions"
          description="Review, reprint, or void recorded sales. Use the scope filter to see the whole branch."
          icon={<ReceiptText className="w-5 h-5" />}
          actions={
            <ExportMenu
              kind="pos-sales"
              filters={{
                search: filters.search,
                from: filters.rangeStart,
                to: filters.rangeEnd,
                mine: filters.mine,
              }}
              onPick={
                selectedIds.length > 0
                  ? (format) =>
                      downloadReport("pos-sales", format, {
                        search: filters.search,
                        from: filters.rangeStart,
                        to: filters.rangeEnd,
                        mine: filters.mine,
                        ids: selectedIds.join(","),
                      })
                  : undefined
              }
            />
          }
        />

        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <span>
              <strong>{selectedIds.length}</strong> sale{selectedIds.length > 1 ? "s" : ""} selected —
              Export will cover only the selected rows.
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </div>
        )}

        <FilterBar
          fields={filterFields}
          values={filters}
          onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
          onReset={() => setFilters({ search: "", rangeStart: "", rangeEnd: "", mine: "true" })}
        />

        <DataGrid
          columns={columns}
          rows={sales}
          loading={loading}
          getRowId={(r) => r.id}
          pageSize={20}
          selectable
          selectedIds={selected}
          onSelectionChange={(ids) => setSelected(new Set(ids))}
          emptyTitle="No transactions yet"
          emptyHint="Sales recorded at the counter will appear here."
          onRowClick={(r) => setViewing(r)}
          rowActions={(r) => (
            <div className="flex items-center justify-end gap-1.5">
              <Button variant="outline" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />} onClick={() => setViewing(r)}>
                View
              </Button>
              {r.status !== "cancelled" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  leftIcon={<Ban className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setVoidTarget(r);
                    setVoidReason("");
                  }}
                >
                  Void
                </Button>
              )}
            </div>
          )}
        />
      </div>

      {/* Receipt viewer */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `Receipt ${viewing.orderNumber}` : undefined}
        description={viewing ? formatDateTime(viewing.createdAt) : undefined}
        size="md"
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
        {viewing && (
          <div id="receipt-print" className="space-y-4 text-sm">
            <div className="text-center">
              <p className="text-base font-bold text-navy-900">Malique Oil and Gas Ltd</p>
              <p className="text-xs text-slate-500">{viewing.branch?.name ?? "Branch"}</p>
            </div>

            <div className="flex items-center justify-between">
              <Badge tone={STATUS_TONE[viewing.status] ?? "slate"} dot>
                {statusLabel(viewing.status)}
              </Badge>
              <span className="text-xs capitalize text-slate-500">Paid via {viewing.paymentMethod}</span>
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
                {viewing.items?.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="py-1.5 text-navy-900">
                      {it.product?.name} <span className="text-slate-400">({Number(it.sizeKg)}kg)</span>
                    </td>
                    <td className="py-1.5 text-center text-slate-600">{it.quantity}</td>
                    <td className="py-1.5 text-right text-slate-600">{formatMoney(Number(it.unitPrice))}</td>
                    <td className="py-1.5 text-right font-medium text-navy-900">{formatMoney(Number(it.totalPrice))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1.5 border-t border-slate-200 pt-3">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatMoney(Number(viewing.subtotal))}</span>
              </div>
              {Number(viewing.discount) > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Discount</span>
                  <span>- {formatMoney(Number(viewing.discount))}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-navy-900">
                <span>Total</span>
                <span>{formatMoney(Number(viewing.totalAmount))}</span>
              </div>
            </div>

            {viewing.customer && (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Customer: <span className="font-medium text-navy-800">{viewing.customer.fullName}</span>
                {viewing.customer.phone ? ` · ${viewing.customer.phone}` : ""}
              </div>
            )}
            {viewing.notes && <p className="text-xs text-slate-400">Note: {viewing.notes}</p>}
          </div>
        )}
      </Modal>

      {/* Void dialog */}
      <Modal
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        title="Void Transaction"
        description={voidTarget ? voidTarget.orderNumber : undefined}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setVoidTarget(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="void-form"
              variant="danger"
              loading={working}
              disabled={!voidReason.trim()}
            >
              Confirm Void
            </Button>
          </>
        }
      >
        <form id="void-form" onSubmit={handleVoid} className="space-y-3">
          <p className="text-sm text-slate-500">
            The items will be returned to stock and the payment marked refunded. This is recorded against your account.
          </p>
          <div>
            <label htmlFor="voidReason" className="mb-1.5 block text-sm font-medium text-navy-800">
              Reason
            </label>
            <textarea
              id="voidReason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              required
              maxLength={300}
              rows={3}
              placeholder="e.g. Customer changed their mind"
              className="w-full min-h-[90px] resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
