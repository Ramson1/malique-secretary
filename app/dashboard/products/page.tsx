"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, PencilLine, Tags, Package, ClipboardCheck, Send } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  Button,
  Card,
  DataGrid,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  Select,
  StatTile,
  Textarea,
  useToast,
  type Column,
  type FilterField,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { formatMoney, formatDateTime } from "@/lib/format";

// Catalog is read from the live admin feed, but every write here becomes an
// approval request (POST /product-changes) — nothing goes live on the website,
// POS or admin screens until an admin approves it.
interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  weight?: string;
  sizes?: number[];
  isActive: boolean;
  createdAt: string;
}

interface ChangeRequest {
  id: string;
  type: string; // create | edit | price
  productId: string | null;
  productName: string | null;
  status: string; // pending | approved | rejected | superseded
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  proposal: Record<string, any>;
}

interface Branch {
  id: string;
  name: string;
}

type PriceEntry = { sizeKg: number; price: string };

const CATEGORY_LABELS: Record<string, string> = {
  "cylinder-refill": "Cylinder Refill",
  "new-cylinder": "New Cylinder",
  accessory: "Accessory",
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  create: "New product",
  edit: "Product edit",
  price: "Price change",
};

const STATUS_TONES: Record<string, "amber" | "green" | "red" | "slate"> = {
  pending: "amber",
  approved: "green",
  rejected: "red",
  superseded: "slate",
};

type FormState = {
  name: string;
  description: string;
  category: string;
  price: string;
  weight: string;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  category: "cylinder-refill",
  price: "",
  weight: "",
};

export default function PortalProductsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const role = user?.role ?? "";
  // Mirrors @Roles('super_admin','admin','branch_manager') on the admin
  // product writes: staff may browse + track requests, not submit changes.
  const canManage = ["super_admin", "admin", "branch_manager"].includes(role);

  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({ search: "", category: "" });

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [showPrices, setShowPrices] = useState(false);
  const [pricesProduct, setPricesProduct] = useState<Product | null>(null);
  const [priceEntries, setPriceEntries] = useState<PriceEntry[]>([]);
  const [priceScope, setPriceScope] = useState<string>("all");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [pricesSaving, setPricesSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [catalog, mine] = await Promise.all([
        api.get<{ products: Product[] }>("/admin/products"),
        api.get<{ requests: ChangeRequest[] }>("/product-changes"),
      ]);
      setProducts(catalog.products ?? []);
      setRequests(mine.requests ?? []);
    } catch {
      toast.error("Could not load the catalog. Please retry.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return products.filter((p) => {
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      const matchC = !filters.category || p.category === filters.category;
      return matchQ && matchC;
    });
  }, [products, filters]);

  const filterFields: FilterField[] = useMemo(
    () => [
      { key: "search", type: "search", placeholder: "Search products…" },
      {
        key: "category",
        type: "select",
        label: "All Categories",
        options: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
      },
    ],
    [],
  );

  async function submitChange(body: Record<string, unknown>, okMessage: string) {
    setSaving(true);
    try {
      await api.post("/product-changes", body);
      toast.success(okMessage);
      setShowModal(false);
      setShowPrices(false);
      const mine = await api.get<{ requests: ChangeRequest[] }>("/product-changes");
      setRequests(mine.requests ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Could not submit the change. Please retry.");
    } finally {
      setSaving(false);
      setPricesSaving(false);
    }
  }

  function openAddModal() {
    setEditingProduct(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description,
      category: product.category,
      price: String(product.price),
      weight: product.weight || "",
    });
    setShowModal(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      type: editingProduct ? "edit" : "create",
      name: form.name,
      description: form.description,
      category: form.category,
      price: Number(form.price),
    };
    if (editingProduct) payload.productId = editingProduct.id;
    if (form.weight !== "") {
      const kg = parseFloat(form.weight);
      if (!Number.isNaN(kg) && kg > 0) payload.weight = kg;
    }
    void submitChange(
      payload,
      "Submitted for admin approval — it goes live once approved.",
    );
  }

  function openPricesModal(product: Product) {
    setPricesProduct(product);
    setPriceScope("all");
    const sizes =
      product.sizes && product.sizes.length ? product.sizes.map(Number) : [0];
    const primary = sizes[0] || 0;
    const kgBased =
      product.category === "cylinder-refill" ||
      product.category === "new-cylinder";
    setPriceEntries(
      sizes.map((sizeKg) => ({
        sizeKg,
        price: String(
          kgBased && primary > 0
            ? Math.round((product.price * sizeKg) / primary)
            : product.price,
        ),
      })),
    );
    setShowPrices(true);
    if (!branches.length) {
      api
        .get<{ branches: Branch[] }>("/admin/branches")
        .then((data) => setBranches(data.branches ?? []))
        .catch(() => undefined);
    }
  }

  function handleSavePrices(e: React.FormEvent) {
    e.preventDefault();
    if (!pricesProduct) return;
    const entries = priceEntries
      .map((en) => ({ sizeKg: Number(en.sizeKg), price: Number(en.price) }))
      .filter(
        (en) =>
          Number.isFinite(en.sizeKg) &&
          en.sizeKg >= 0 &&
          Number.isFinite(en.price) &&
          en.price >= 0,
      );
    if (!entries.length) {
      toast.error("Enter at least one valid price.");
      return;
    }
    if (priceScope !== "all" && !priceScope) {
      toast.error("Pick a branch or apply to all branches.");
      return;
    }
    setPricesSaving(true);
    void submitChange(
      {
        type: "price",
        productId: pricesProduct.id,
        entries,
        ...(priceScope === "all" ? { allBranches: true } : { branchId: priceScope }),
      },
      "Price change submitted for admin approval.",
    );
  }

  const columns: Column<Product>[] = [
    {
      key: "name",
      header: "Product",
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Package className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-navy-900">{r.name}</p>
            <p className="text-xs text-slate-500">
              {CATEGORY_LABELS[r.category] ?? r.category}
              {r.weight ? ` · ${r.weight}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "price",
      header: "Live Price",
      align: "right",
      sortable: true,
      sortValue: (r) => r.price,
      render: (r) => (
        <span className="text-sm font-semibold text-navy-900">
          {formatMoney(r.price)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) =>
        r.isActive ? (
          <Badge tone="green" dot>Live</Badge>
        ) : (
          <Badge tone="slate" dot>Inactive</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) =>
        canManage ? (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditModal(r)}
              leftIcon={<PencilLine className="w-3.5 h-3.5" />}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openPricesModal(r)}
              leftIcon={<Tags className="w-3.5 h-3.5" />}
            >
              Prices
            </Button>
          </div>
        ) : null,
    },
  ];

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <DashboardLayout title="Products" subtitle="Catalog changes go through admin approval">
      <div className="space-y-6">
        <PageHeader
          title="Product Catalog"
          description="Create items or adjust prices here — an admin reviews every change before it appears on the website, POS and admin screens."
          icon={<Package className="w-5 h-5" />}
          actions={
            canManage ? (
              <Button onClick={openAddModal} leftIcon={<Plus className="w-4 h-4" />}>
                Add Product
              </Button>
            ) : undefined
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={<Package className="w-5 h-5" />} label="Catalog Items" value={products.length} accent="navy" />
          <StatTile icon={<ClipboardCheck className="w-5 h-5" />} label="Pending Approval" value={pendingCount} accent="amber" />
          <StatTile
            icon={<ClipboardCheck className="w-5 h-5" />}
            label="Approved"
            value={requests.filter((r) => r.status === "approved").length}
            accent="green"
          />
          <StatTile
            icon={<ClipboardCheck className="w-5 h-5" />}
            label="Rejected"
            value={requests.filter((r) => r.status === "rejected").length}
            accent="red"
          />
        </div>

        <FilterBar
          fields={filterFields}
          values={filters}
          onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
          onReset={() => setFilters({ search: "", category: "" })}
        />

        <DataGrid
          columns={columns}
          rows={filtered}
          loading={loading}
          getRowId={(r) => r.id}
          pageSize={25}
          emptyTitle="No products found"
          emptyHint="Adjust your search or category filter."
        />

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Send className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-navy-900">My Change Requests</h3>
          </div>
          {requests.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              Nothing submitted yet. Product and price changes you send will be
              listed here with their approval status.
            </p>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-lg border border-slate-200 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge tone={STATUS_TONES[req.status] ?? "slate"} dot>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </Badge>
                    <span className="text-sm font-medium text-navy-900">
                      {req.productName ?? req.proposal?.name ?? "(unknown product)"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {REQUEST_TYPE_LABELS[req.type] ?? req.type} · {formatDateTime(req.createdAt)}
                    </span>
                  </div>
                  {req.status === "rejected" && req.reason && (
                    <p className="mt-1 text-xs text-red-600">
                      Rejected: {req.reason} — adjust and submit again to resubmit.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingProduct ? `Submit Edit — ${editingProduct.name}` : "Submit New Product"}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="product-form" loading={saving} disabled={saving}>
              Submit for Approval
            </Button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSave} className="space-y-4">
          <p className="text-xs text-slate-500">
            This is a request, not a live change — an admin must approve it
            before it appears anywhere in the system.
          </p>
          <Input
            label="Product Name"
            name="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Textarea
            label="Description"
            name="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Category"
              name="category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Input
              label="Price (NGN)"
              name="price"
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
          </div>
          <Input
            label="Weight / Size (optional)"
            name="weight"
            value={form.weight}
            onChange={(e) => setForm({ ...form, weight: e.target.value })}
            placeholder="e.g. 12.5kg"
          />
        </form>
      </Modal>

      <Modal
        open={showPrices}
        onClose={() => setShowPrices(false)}
        title={pricesProduct ? `Submit Prices — ${pricesProduct.name}` : "Prices"}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowPrices(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="prices-form"
              loading={pricesSaving}
              disabled={pricesSaving}
            >
              Submit for Approval
            </Button>
          </>
        }
      >
        <form id="prices-form" onSubmit={handleSavePrices} className="space-y-4">
          <p className="text-xs text-slate-500">
            Prices below stay inactive until an admin approves this request.
          </p>
          <Select
            label="Apply to"
            name="scope"
            value={priceScope}
            onChange={(e) => setPriceScope(e.target.value)}
          >
            <option value="all">All branches (global)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <div className="space-y-3">
            {priceEntries.map((entry, idx) => (
              <div key={`${entry.sizeKg}-${idx}`} className="flex items-end gap-3">
                <div className="w-32 shrink-0">
                  <Input
                    label={idx === 0 && entry.sizeKg === 0 ? "Flat price" : "Size (kg)"}
                    type="number"
                    min={0}
                    step="0.1"
                    value={String(entry.sizeKg)}
                    onChange={(e) =>
                      setPriceEntries((prev) =>
                        prev.map((en, i) =>
                          i === idx ? { ...en, sizeKg: Number(e.target.value) } : en,
                        ),
                      )
                    }
                  />
                </div>
                <Input
                  label="Price (NGN)"
                  type="number"
                  min={0}
                  value={entry.price}
                  onChange={(e) =>
                    setPriceEntries((prev) =>
                      prev.map((en, i) =>
                        i === idx ? { ...en, price: e.target.value } : en,
                      ),
                    )
                  }
                  required
                />
              </div>
            ))}
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
