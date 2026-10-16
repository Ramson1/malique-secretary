"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Warehouse, Boxes, AlertTriangle, PackageX, Flame } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  DataGrid,
  FilterBar,
  PageHeader,
  StatTile,
  useToast,
  ExportMenu,
  type Column,
  type FilterField,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { formatDate } from "@/lib/format";

interface StockRow {
  productId: string;
  productName: string;
  category: string;
  sizeKg: number;
  quantityOnHand: number;
  minStockLevel: number;
  lowStock: boolean;
  lastRestockedAt: string | null;
}

function categoryLabel(cat: string): string {
  if (cat === "gas") return "Gas";
  if (cat === "accessory") return "Accessory";
  if (cat === "cylinder") return "Cylinder";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export default function InventoryPage() {
  const toast = useToast();
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({ search: "", group: "" });

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ data: StockRow[] }>("/pos/inventory");
      setRows(data.data ?? []);
    } catch {
      toast.error("Could not load inventory. Please retry.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isGas = (r: StockRow) => r.category !== "accessory";

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchQ = !q || r.productName.toLowerCase().includes(q);
      const matchG =
        !filters.group ||
        (filters.group === "gas" ? isGas(r) : filters.group === "accessory" ? !isGas(r) : r.lowStock);
      return matchQ && matchG;
    });
  }, [rows, filters]);

  const filterFields: FilterField[] = useMemo(
    () => [
      { key: "search", type: "search", placeholder: "Search products…" },
      {
        key: "group",
        type: "select",
        label: "All Stock",
        options: [
          { value: "gas", label: "Gas Cylinders" },
          { value: "accessory", label: "Accessories" },
          { value: "low", label: "Low Stock" },
        ],
      },
    ],
    [],
  );

  const columns: Column<StockRow>[] = [
    {
      key: "productName",
      header: "Product",
      sortable: true,
      sortValue: (r) => r.productName,
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            {isGas(r) ? <Flame className="h-4 w-4" /> : <Boxes className="h-4 w-4" />}
          </div>
          <div>
            <p className="text-sm font-medium text-navy-900">{r.productName}</p>
            <p className="text-xs text-slate-500">{r.sizeKg}kg · {categoryLabel(r.category)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "quantityOnHand",
      header: "On Hand",
      align: "right",
      sortable: true,
      sortValue: (r) => r.quantityOnHand,
      render: (r) => (
        <span className={`text-sm font-semibold ${r.quantityOnHand <= 0 ? "text-red-600" : "text-navy-900"}`}>
          {r.quantityOnHand}
        </span>
      ),
    },
    {
      key: "minStockLevel",
      header: "Min Level",
      align: "right",
      render: (r) => <span className="text-sm text-slate-500">{r.minStockLevel}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) =>
        r.quantityOnHand <= 0 ? (
          <Badge tone="red" dot>Out of Stock</Badge>
        ) : r.lowStock ? (
          <Badge tone="amber" dot>Low</Badge>
        ) : (
          <Badge tone="green" dot>In Stock</Badge>
        ),
    },
    {
      key: "lastRestockedAt",
      header: "Last Restocked",
      sortable: true,
      sortValue: (r) => (r.lastRestockedAt ? new Date(r.lastRestockedAt).getTime() : 0),
      render: (r) => <span className="text-sm text-slate-500">{formatDate(r.lastRestockedAt)}</span>,
    },
  ];

  const lowCount = rows.filter((r) => r.lowStock && r.quantityOnHand > 0).length;
  const outCount = rows.filter((r) => r.quantityOnHand <= 0).length;

  return (
    <DashboardLayout title="Inventory" subtitle="Live stock levels for your branch">
      <div className="space-y-6">
        <PageHeader
          title="Branch Stock"
          description="Gas cylinders and accessories currently on hand at your branch."
          icon={<Warehouse className="w-5 h-5" />}
          actions={
            <ExportMenu
              kind="inventory"
              filters={{
                search: filters.search,
                status: filters.group === "low" ? "low" : undefined,
              }}
            />
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={<Boxes className="w-5 h-5" />} label="Stock Lines" value={rows.length} accent="navy" />
          <StatTile icon={<Flame className="w-5 h-5" />} label="Gas Cylinders" value={rows.filter(isGas).length} accent="amber" />
          <StatTile icon={<AlertTriangle className="w-5 h-5" />} label="Low Stock" value={lowCount} accent="amber" />
          <StatTile icon={<PackageX className="w-5 h-5" />} label="Out of Stock" value={outCount} accent="red" />
        </div>

        <FilterBar
          fields={filterFields}
          values={filters}
          onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
          onReset={() => setFilters({ search: "", group: "" })}
        />

        <DataGrid
          columns={columns}
          rows={filtered}
          loading={loading}
          getRowId={(r) => `${r.productId}:${r.sizeKg}`}
          pageSize={25}
          emptyTitle="No stock found"
          emptyHint="Adjust your filters to see branch inventory."
        />
      </div>
    </DashboardLayout>
  );
}
