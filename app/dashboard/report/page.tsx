"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Printer,
  ReceiptText,
  CircleDollarSign,
  Ban,
  Flame,
  Package,
  Banknote,
  Building2,
  CreditCard,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  FilterBar,
  PageHeader,
  StatTile,
  ExportMenu,
  useToast,
  type FilterField,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { formatMoney } from "@/lib/format";

interface Summary {
  branchId: string;
  range: { from?: string; to?: string };
  transactions: number;
  grossSales: number;
  discounts: number;
  voided: number;
  voidedCount: number;
  byPaymentMethod: { cash: number; transfer: number; pos: number; online: number };
  gas: { quantity: number; value: number };
  items: { quantity: number; value: number };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({
    rangeStart: todayISO(),
    rangeEnd: todayISO(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.rangeStart) params.set("from", filters.rangeStart);
      if (filters.rangeEnd) params.set("to", filters.rangeEnd);
      const data = await api.get<Summary>(`/pos/summary?${params.toString()}`);
      setSummary(data);
    } catch {
      toast.error("Could not load the shift report. Please retry.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.rangeStart, filters.rangeEnd]);

  useEffect(() => {
    load();
  }, [load]);

  const filterFields: FilterField[] = useMemo(
    () => [{ key: "range", type: "daterange", label: "Period" }],
    [],
  );

  const paymentBreakdown = summary
    ? [
        { label: "Cash", value: summary.byPaymentMethod.cash, icon: <Banknote className="h-4 w-4" /> },
        { label: "Transfer", value: summary.byPaymentMethod.transfer, icon: <Building2 className="h-4 w-4" /> },
        { label: "Card / POS", value: summary.byPaymentMethod.pos, icon: <CreditCard className="h-4 w-4" /> },
      ]
    : [];

  return (
    <DashboardLayout title="Shift Report" subtitle="Cash-up and sales breakdown for the selected period">
      <div id="report-print" className="space-y-6">
        <PageHeader
          title="Cash-Up Report"
          description="Totals by payment method, gas vs items, and voids — for end-of-shift reconciliation."
          icon={<BarChart3 className="w-5 h-5" />}
          actions={
            <div className="flex items-center gap-2">
              <ExportMenu
                kind="pos-sales"
                filters={{
                  branchId: summary?.branchId,
                  from: filters.rangeStart,
                  to: filters.rangeEnd,
                }}
                disabled={!summary}
              />
              <button
                onClick={() => window.print()}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-navy-800 transition-colors hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
            </div>
          }
        />

        <FilterBar
          fields={filterFields}
          values={filters}
          onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
          onReset={() => setFilters({ rangeStart: todayISO(), rangeEnd: todayISO() })}
        />

        {loading && !summary ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : summary ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                icon={<CircleDollarSign className="w-5 h-5" />}
                label="Gross Sales"
                value={formatMoney(summary.grossSales)}
                accent="green"
              />
              <StatTile
                icon={<ReceiptText className="w-5 h-5" />}
                label="Transactions"
                value={summary.transactions}
                accent="navy"
              />
              <StatTile
                icon={<Ban className="w-5 h-5" />}
                label="Voided"
                value={formatMoney(summary.voided)}
                hint={`${summary.voidedCount} transaction(s)`}
                accent="red"
              />
              <StatTile
                icon={<BarChart3 className="w-5 h-5" />}
                label="Discounts"
                value={formatMoney(summary.discounts)}
                accent="amber"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-navy-900">Totals by Payment Method</h3>
                  <span className="text-xs text-slate-400">Collected</span>
                </div>
                <div className="space-y-3">
                  {paymentBreakdown.map((p) => {
                    const pct = summary.grossSales > 0 ? Math.round((p.value / summary.grossSales) * 100) : 0;
                    return (
                      <div key={p.label}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-navy-800">
                            <span className="text-slate-400">{p.icon}</span>
                            {p.label}
                          </span>
                          <span className="font-semibold text-navy-900">{formatMoney(p.value)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-navy-900">Gas vs Items Sold</h3>
                  <span className="text-xs text-slate-400">Quantity &amp; value</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex items-center gap-2 text-amber-600">
                      <Flame className="h-5 w-5" />
                      <span className="text-sm font-semibold">Gas Cylinders</span>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-navy-900">{summary.gas.quantity}</p>
                    <p className="text-xs text-slate-500">units sold</p>
                    <p className="mt-2 text-sm font-semibold text-navy-800">{formatMoney(summary.gas.value)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex items-center gap-2 text-blue-600">
                      <Package className="h-5 w-5" />
                      <span className="text-sm font-semibold">Accessories</span>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-navy-900">{summary.items.quantity}</p>
                    <p className="text-xs text-slate-500">units sold</p>
                    <p className="mt-2 text-sm font-semibold text-navy-800">{formatMoney(summary.items.value)}</p>
                  </div>
                </div>
              </Card>
            </div>
          </>
        ) : (
          <Card className="py-12 text-center">
            <p className="text-sm font-medium text-navy-900">No data available</p>
            <p className="mt-1 text-xs text-slate-500">Adjust the period and try again.</p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
