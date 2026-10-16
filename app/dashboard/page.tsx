"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Banknote,
  Building2,
  CreditCard,
  Printer,
  X,
  CircleDollarSign,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  Button,
  Input,
  Modal,
  useToast,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { formatMoney, formatDateTime } from "@/lib/format";

interface CatalogItem {
  productId: string;
  name: string;
  category: string;
  sizeKg: number;
  price: number;
  onHand: number;
  minStockLevel: number;
  lowStock: boolean;
}

interface CartLine {
  key: string;
  productId: string;
  name: string;
  category: string;
  sizeKg: number;
  quantity: number;
  unitPrice: number;
  onHand: number;
}

type PaymentMethod = "cash" | "transfer" | "pos";

// Loosely-typed receipt (mirrors PosService.findOne / Order shape).
interface Receipt {
  id: string;
  orderNumber: string;
  createdAt: string;
  subtotal: string | number;
  discount: string | number;
  totalAmount: string | number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  notes?: string | null;
  customer?: { fullName: string; phone?: string | null; email?: string | null } | null;
  branch?: { name: string } | null;
  items?: Array<{
    quantity: number;
    unitPrice: string | number;
    totalPrice: string | number;
    sizeKg: string | number;
    product?: { name: string } | null;
  }>;
  payments?: Array<{ amount: string | number; status: string }>;
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "transfer", label: "Transfer", icon: Building2 },
  { value: "pos", label: "Card / POS", icon: CreditCard },
];

const CATEGORIES = ["gas", "accessory", "cylinder"];
function categoryLabel(cat: string): string {
  if (cat === "gas") return "Gas";
  if (cat === "accessory") return "Accessory";
  if (cat === "cylinder") return "Cylinder";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export default function POSTerminalPage() {
  const toast = useToast();
  const { user } = useAuth();
  const canOverridePrice =
    user?.role === "admin" ||
    user?.role === "super_admin" ||
    user?.role === "branch_manager";

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const loadCatalog = useCallback(async () => {
    try {
      const data = await api.get<{ items: CatalogItem[] }>("/pos/catalog");
      setCatalog(data.items ?? []);
    } catch {
      toast.error("Could not load the catalog. Please retry.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((item) => {
      const matchQ = !q || item.name.toLowerCase().includes(q);
      const matchC = !category || item.category === category;
      return matchQ && matchC;
    });
  }, [catalog, search, category]);

  function addToCart(item: CatalogItem) {
    if (item.onHand <= 0) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === `${item.productId}:${item.sizeKg}`);
      if (existing) {
        if (existing.quantity >= item.onHand) {
          toast.warning(`Only ${item.onHand} of ${item.name} in stock`);
          return prev;
        }
        return prev.map((l) =>
          l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          key: `${item.productId}:${item.sizeKg}`,
          productId: item.productId,
          name: item.name,
          category: item.category,
          sizeKg: item.sizeKg,
          quantity: 1,
          unitPrice: item.price,
          onHand: item.onHand,
        },
      ];
    });
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.key !== key) return [l];
        const next = l.quantity + delta;
        if (next <= 0) return [];
        if (next > l.onHand) {
          toast.warning(`Only ${l.onHand} of ${l.name} in stock`);
          return [l];
        }
        return [{ ...l, quantity: next }];
      }),
    );
  }

  function setUnitPrice(key: string, value: number) {
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, unitPrice: Math.max(0, value) } : l)),
    );
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  function clearCart() {
    setCart([]);
    setDiscount(0);
    setAmountPaid("");
    setCustomerPhone("");
    setCustomerName("");
    setNotes("");
    setPaymentMethod("cash");
  }

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const total = Math.max(0, subtotal - discount);
  const tendered = Number(amountPaid) || 0;
  const change = paymentMethod === "cash" && tendered > 0 ? Math.max(0, tendered - total) : 0;

  async function completeSale() {
    if (!cart.length) {
      toast.warning("Add at least one item to the sale.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        items: cart.map((l) => ({
          productId: l.productId,
          sizeKg: l.sizeKg,
          quantity: l.quantity,
          unitPrice: canOverridePrice ? l.unitPrice : undefined,
        })),
        paymentMethod,
        discount: discount || undefined,
        amountPaid: tendered > 0 ? tendered : undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerName: customerName.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      const data = await api.post<Receipt>("/pos/sales", payload);
      setReceipt(data);
      toast.success(`Sale ${data.orderNumber} recorded`);
      clearCart();
      loadCatalog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record the sale.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout title="New Sale" subtitle="Record a counter transaction and issue a receipt">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Catalog */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-navy-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 min-w-[140px] rounded-xl border border-slate-300 bg-white px-3 pr-8 text-sm text-navy-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              aria-label="Filter by category"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Search className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-navy-900">No products found</p>
              <p className="max-w-sm text-xs text-slate-500">
                Try a different search or category, or restock this branch.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((item) => {
                const out = item.onHand <= 0;
                return (
                  <button
                    key={`${item.productId}:${item.sizeKg}`}
                    type="button"
                    onClick={() => addToCart(item)}
                    disabled={out}
                    className={`group flex flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition-all ${
                      out
                        ? "cursor-not-allowed border-slate-200 opacity-60"
                        : "border-slate-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold leading-tight text-navy-900">
                        {item.name}
                      </span>
                      <Badge tone={item.category === "gas" ? "navy" : "slate"}>
                        {categoryLabel(item.category)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{item.sizeKg}kg cylinder</p>
                    <p className="mt-3 text-lg font-bold text-navy-900">{formatMoney(item.price)}</p>
                    <div className="mt-auto pt-2">
                      {out ? (
                        <Badge tone="red">Out of stock</Badge>
                      ) : item.lowStock ? (
                        <Badge tone="amber">{item.onHand} left</Badge>
                      ) : (
                        <span className="text-xs text-slate-400">{item.onHand} in stock</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-amber-600" />
                <h2 className="text-sm font-semibold text-navy-900">Current Sale</h2>
                {cart.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {cart.reduce((n, l) => n + l.quantity, 0)}
                  </span>
                )}
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </button>
              )}
            </div>

            <div className="max-h-[40vh] flex-1 overflow-y-auto px-5 py-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <ShoppingCart className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-navy-900">Cart is empty</p>
                  <p className="max-w-[220px] text-xs text-slate-500">
                    Tap a product on the left to add it to the sale.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {cart.map((line) => (
                    <li key={line.key} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-navy-900">{line.name}</p>
                          <p className="text-xs text-slate-500">{line.sizeKg}kg · {categoryLabel(line.category)}</p>
                        </div>
                        <button
                          onClick={() => removeLine(line.key)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-red-600"
                          aria-label="Remove"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => changeQty(line.key, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-navy-800 hover:bg-slate-50"
                            aria-label="Decrease"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold text-navy-900">
                            {line.quantity}
                          </span>
                          <button
                            onClick={() => changeQty(line.key, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-navy-800 hover:bg-slate-50"
                            aria-label="Increase"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {canOverridePrice ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-400">@</span>
                            <input
                              type="number"
                              value={line.unitPrice}
                              min={0}
                              onChange={(e) => setUnitPrice(line.key, Number(e.target.value))}
                              className="h-8 w-24 rounded-lg border border-slate-300 bg-white px-2 text-right text-sm text-navy-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">{formatMoney(line.unitPrice)} each</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3 border-t border-slate-100 px-5 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-navy-900">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-500">Discount (₦)</span>
                <input
                  type="number"
                  min={0}
                  value={discount || ""}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0"
                  className="h-8 w-28 rounded-lg border border-slate-300 bg-white px-2 text-right text-sm text-navy-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
              <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2.5 text-base">
                <span className="font-semibold text-navy-900">Total</span>
                <span className="font-bold text-navy-900">{formatMoney(total)}</span>
              </div>

              {/* Payment method */}
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = paymentMethod === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPaymentMethod(opt.value)}
                      className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium transition-all ${
                        active
                          ? "border-amber-400 bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {paymentMethod === "cash" && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Cash tendered"
                    type="number"
                    min={0}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder={String(Math.round(total))}
                  />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-navy-800">Change</label>
                    <div className="flex h-10 items-center justify-end rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-emerald-700">
                      {formatMoney(change)}
                    </div>
                  </div>
                </div>
              )}

              <details className="group rounded-xl border border-slate-200 p-3">
                <summary className="cursor-pointer list-none text-sm font-medium text-navy-800">
                  Customer (optional)
                </summary>
                <div className="mt-3 space-y-2.5">
                  <Input
                    label="Phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="080…"
                  />
                  <Input
                    label="Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Walk-in customer"
                  />
                  <Input
                    label="Note"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. cylinder exchange"
                  />
                </div>
              </details>

              <Button
                className="w-full"
                size="lg"
                leftIcon={<CircleDollarSign className="h-4 w-4" />}
                onClick={completeSale}
                loading={submitting}
                disabled={!cart.length}
              >
                Complete Sale · {formatMoney(total)}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt */}
      <Modal
        open={!!receipt}
        onClose={() => setReceipt(null)}
        title="Sale Complete"
        description={receipt ? `Receipt ${receipt.orderNumber}` : undefined}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setReceipt(null)}>
              Close
            </Button>
            <Button leftIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Print Receipt
            </Button>
          </>
        }
      >
        {receipt && (
          <div id="receipt-print" className="space-y-4 text-sm">
            <div className="text-center">
              <p className="text-base font-bold text-navy-900">Malique Oil and Gas Ltd</p>
              <p className="text-xs text-slate-500">{receipt.branch?.name ?? "Branch"}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(receipt.createdAt)}</p>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span className="text-slate-500">Order</span>
              <span className="font-semibold text-navy-900">{receipt.orderNumber}</span>
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
                {receipt.items?.map((it, i) => (
                  <tr key={i} className="border-b border-slate-100">
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
                <span>{formatMoney(Number(receipt.subtotal))}</span>
              </div>
              {Number(receipt.discount) > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Discount</span>
                  <span>- {formatMoney(Number(receipt.discount))}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-navy-900">
                <span>Total</span>
                <span>{formatMoney(Number(receipt.totalAmount))}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Paid via</span>
                <span className="capitalize">{receipt.paymentMethod}</span>
              </div>
            </div>

            {receipt.customer && (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Customer: <span className="font-medium text-navy-800">{receipt.customer.fullName}</span>
                {receipt.customer.phone ? ` · ${receipt.customer.phone}` : ""}
              </div>
            )}
            {receipt.notes && <p className="text-xs text-slate-400">Note: {receipt.notes}</p>}
            <p className="text-center text-xs text-slate-400">Thank you for your patronage.</p>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
