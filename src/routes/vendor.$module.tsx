import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Boxes,
  Check,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileText,
  Loader2,
  Package,
  Plus,
  ReceiptText,
  Search,
  Tag,
  Trash2,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import {
  createPromotion,
  createVariant,
  deletePromotion,
  deleteVariant,
  togglePromotion,
  updateReturn,
} from "@/services/sellerMarketplaceService";
import {
  listCustomerMetrics,
  listExports,
  listProducts,
  listPromotions,
  listReturns,
  listSettlements,
  listVariants,
  queueExport,
} from "@/repositories/sellerMarketplaceRepository";
import type {
  CreatePromotionInput,
  ProductVariant,
  Promotion,
  SellerProduct,
  SellerReturn,
} from "@/types/sellerModules";

const MODULE_LABELS: Record<string, string> = {
  products: "Products & variants",
  inventory: "Inventory",
  returns: "Returns management",
  promotions: "Promotions & coupons",
  customers: "Customer analytics",
  payments: "Payments & settlements",
  reports: "Reports & exports",
  analytics: "Store performance",
  reviews: "Reviews management",
};

export const Route = createFileRoute("/vendor/$module")({
  ssr: false,
  component: SellerModulePage,
});

function SellerModulePage() {
  const { module } = Route.useParams();
  const label = MODULE_LABELS[module] ?? "Seller workspace";
  const navigate = useNavigate();
  const [sellerId, setSellerId] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: seller } = await db
        .from("sellers")
        .select("id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      setSellerId(seller?.id ?? null);
    });
  }, []);

  if (!sellerId) {
    return (
      <ModuleFrame label={label}>
        <Skeleton className="h-72 rounded-2xl" />
      </ModuleFrame>
    );
  }

  return (
    <ModuleFrame label={label} onBack={() => void navigate({ to: "/vendor" })}>
      {module === "products" ? <ProductsModule sellerId={sellerId} /> : null}
      {module === "inventory" ? <InventoryModule sellerId={sellerId} /> : null}
      {module === "returns" ? <ReturnsModule sellerId={sellerId} /> : null}
      {module === "promotions" ? <PromotionsModule sellerId={sellerId} /> : null}
      {module === "customers" ? <CustomersModule sellerId={sellerId} /> : null}
      {module === "payments" ? <PaymentsModule sellerId={sellerId} /> : null}
      {module === "reports" ? <ReportsModule sellerId={sellerId} /> : null}
      {module === "analytics" ? <AnalyticsModule /> : null}
      {module === "reviews" ? <ReviewsModule /> : null}
      {!MODULE_LABELS[module] ? <EmptyModule label={label} /> : null}
    </ModuleFrame>
  );
}

function ModuleFrame({
  label,
  children,
  onBack,
}: {
  label: string;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#f7f8fc] dark:bg-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <button
            onClick={onBack}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Back to seller dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d95d7d]">
              Seller Central
            </p>
            <h1 className="text-base font-bold">{label}</h1>
          </div>
          <Link to="/vendor" className="ml-auto text-xs font-semibold text-[#d95d7d]">
            Dashboard
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

function ProductsModule({ sellerId }: { sellerId: string }) {
  const client = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const products = useQuery({
    queryKey: ["seller-products", sellerId],
    queryFn: () => listProducts(sellerId),
  });
  const variants = useQuery({
    queryKey: ["product-variants", selectedProduct],
    enabled: Boolean(selectedProduct),
    queryFn: () => listVariants(selectedProduct),
  });
  const [form, setForm] = useState({
    sku: "",
    price: "",
    salePrice: "",
    stock: "",
    attributes: "Color=Black, Size=M",
  });
  const create = useMutation({
    mutationFn: () =>
      createVariant({
        product_id: selectedProduct,
        sku: form.sku,
        barcode: null,
        price: Number(form.price),
        sale_price: form.salePrice ? Number(form.salePrice) : null,
        stock: Number(form.stock),
        weight: null,
        image_url: null,
        attributes: Object.fromEntries(
          form.attributes.split(",").map(
            (pair) =>
              pair
                .trim()
                .split("=")
                .map((value) => value.trim()) as [string, string],
          ),
        ),
      }),
    onMutate: async () => {
      await client.cancelQueries({ queryKey: ["product-variants", selectedProduct] });
      const old =
        client.getQueryData<ProductVariant[]>(["product-variants", selectedProduct]) ?? [];
      client.setQueryData(
        ["product-variants", selectedProduct],
        [
          ...old,
          {
            id: `temp-${Date.now()}`,
            product_id: selectedProduct,
            sku: form.sku,
            barcode: null,
            price: Number(form.price),
            sale_price: form.salePrice ? Number(form.salePrice) : null,
            stock: Number(form.stock),
            weight: null,
            image_url: null,
            attributes: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      );
      return { old };
    },
    onError: (error, _input, context) => {
      client.setQueryData(["product-variants", selectedProduct], context?.old);
      toast.error(error instanceof Error ? error.message : "Could not create variant.");
    },
    onSuccess: () => {
      toast.success("Variant created.");
      setForm({ sku: "", price: "", salePrice: "", stock: "", attributes: "Color=Black, Size=M" });
      void client.invalidateQueries({ queryKey: ["product-variants", selectedProduct] });
    },
  });
  const remove = useMutation({
    mutationFn: deleteVariant,
    onSuccess: () => {
      toast.success("Variant deleted.");
      void client.invalidateQueries({ queryKey: ["product-variants", selectedProduct] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not delete variant."),
  });
  useEffect(() => {
    if (!selectedProduct && products.data?.[0]) setSelectedProduct(products.data[0].id);
  }, [products.data, selectedProduct]);
  const selected = products.data?.find((product) => product.id === selectedProduct);
  return (
    <div className="space-y-6">
      <PageIntro
        icon={Package}
        title="Products & variants"
        description="Manage catalog states, pricing, inventory and custom variant attributes."
        action={
          <Button
            onClick={() => toast.info("Product creation RPC is ready to connect.")}
            className="bg-[#e96a8d] hover:bg-[#d85b7d]"
          >
            <Plus className="mr-2 h-4 w-4" /> Add product
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {products.isLoading ? (
              <Skeleton className="h-10" />
            ) : products.data?.length ? (
              products.data.map((product) => (
                <button
                  key={product.id}
                  onClick={() => setSelectedProduct(product.id)}
                  className={`flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm ${selectedProduct === product.id ? "bg-[#fff0f4] text-[#d95d7d]" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                >
                  <Package className="h-4 w-4" />
                  <span className="flex-1 truncate">{product.name}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ))
            ) : (
              <EmptyState
                title="No products yet"
                text="Add your first product to create variants."
              />
            )}
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {selected?.name ?? "Select a product"} variants
              </CardTitle>
            </CardHeader>
            <CardContent>
              {variants.isLoading ? (
                <Skeleton className="h-32" />
              ) : variants.data?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="pb-3">SKU</th>
                        <th>Attributes</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {variants.data.map((variant) => (
                        <tr
                          key={variant.id}
                          className="border-t border-slate-100 dark:border-slate-800"
                        >
                          <td className="py-3 font-semibold">{variant.sku}</td>
                          <td className="py-3 text-slate-500">
                            {Object.entries(variant.attributes)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(" · ") || "—"}
                          </td>
                          <td>
                            {variant.sale_price ? (
                              <>
                                <span className="font-semibold">₹{variant.sale_price}</span>{" "}
                                <del className="text-slate-400">₹{variant.price}</del>
                              </>
                            ) : (
                              `₹${variant.price}`
                            )}
                          </td>
                          <td>{variant.stock}</td>
                          <td className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-rose-500"
                              onClick={() => remove.mutate(variant.id)}
                              aria-label={`Delete ${variant.sku}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No variants"
                  text="Create size, color, weight or custom attribute combinations below."
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Create variant</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="SKU">
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="TSH-BLK-M"
                />
              </Field>
              <Field label="Price">
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="799"
                />
              </Field>
              <Field label="Sale price">
                <Input
                  type="number"
                  value={form.salePrice}
                  onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                  placeholder="699"
                />
              </Field>
              <Field label="Stock">
                <Input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  placeholder="25"
                />
              </Field>
              <Field label="Attributes">
                <Input
                  value={form.attributes}
                  onChange={(e) => setForm({ ...form, attributes: e.target.value })}
                  placeholder="Color=Black, Size=M"
                />
              </Field>
              <Button
                disabled={!selectedProduct || create.isPending}
                onClick={() => create.mutate()}
                className="bg-[#e96a8d] hover:bg-[#d85b7d] sm:col-span-2 lg:col-span-5"
              >
                {create.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}{" "}
                Create variant
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ReturnsModule({ sellerId }: { sellerId: string }) {
  const client = useQueryClient();
  const [status, setStatus] = useState("all");
  const returns = useQuery({
    queryKey: ["seller-returns", sellerId, status],
    queryFn: () => listReturns(sellerId, status),
  });
  const mutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) => updateReturn(id, next),
    onSuccess: () => {
      toast.success("Return updated.");
      void client.invalidateQueries({ queryKey: ["seller-returns", sellerId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update return."),
  });
  const counts = useMemo(() => {
    const rows = returns.data ?? [];
    return {
      total: rows.length,
      pending: rows.filter((row) => ["requested", "under_review"].includes(row.status)).length,
      approved: rows.filter((row) => row.status === "approved").length,
      refunds: rows.reduce((sum, row) => sum + Number(row.refund_amount ?? 0), 0),
    };
  }, [returns.data]);
  return (
    <>
      <PageIntro
        icon={Truck}
        title="Returns management"
        description="Review requests, approve valid returns and keep refunds auditable."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniMetric label="Total returns" value={counts.total} />
        <MiniMetric label="Pending reviews" value={counts.pending} tone="amber" />
        <MiniMetric label="Approved" value={counts.approved} tone="green" />
        <MiniMetric
          label="Refund amount"
          value={`₹${counts.refunds.toLocaleString("en-IN")}`}
          tone="violet"
        />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Return requests</CardTitle>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            <option value="all">All statuses</option>
            <option value="requested">Requested</option>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="refunded">Refunded</option>
          </select>
        </CardHeader>
        <CardContent>
          <ReturnTable
            rows={returns.data ?? []}
            busy={mutation.isPending}
            onAction={(id, next) => mutation.mutate({ id, next })}
          />
        </CardContent>
      </Card>
    </>
  );
}

function ReturnTable({
  rows,
  busy,
  onAction,
}: {
  rows: SellerReturn[];
  busy: boolean;
  onAction: (id: string, next: string) => void;
}) {
  if (!rows.length)
    return (
      <EmptyState
        title="No return requests"
        text="Return requests will appear here when customers submit them."
      />
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[650px] text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-slate-400">
          <tr>
            <th className="pb-3">Order</th>
            <th>Reason</th>
            <th>Refund</th>
            <th>Status</th>
            <th className="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-3 font-semibold">#{row.order_id.slice(0, 8)}</td>
              <td className="max-w-[220px] truncate py-3 text-slate-500">{row.reason}</td>
              <td>₹{Number(row.refund_amount ?? 0).toLocaleString("en-IN")}</td>
              <td>
                <StatusBadge
                  label={row.status.replace("_", " ")}
                  tone={
                    row.status === "approved"
                      ? "green"
                      : row.status === "rejected"
                        ? "rose"
                        : "amber"
                  }
                />
              </td>
              <td className="text-right">
                {["requested", "under_review"].includes(row.status) ? (
                  <div className="flex justify-end gap-2">
                    <Button
                      disabled={busy}
                      size="sm"
                      variant="outline"
                      onClick={() => onAction(row.id, "rejected")}
                      className="h-7 text-[10px]"
                    >
                      Reject
                    </Button>
                    <Button
                      disabled={busy}
                      size="sm"
                      onClick={() => onAction(row.id, "approved")}
                      className="h-7 bg-[#e96a8d] text-[10px]"
                    >
                      Approve
                    </Button>
                  </div>
                ) : (
                  <span className="text-slate-400">Closed</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PromotionsModule({ sellerId }: { sellerId: string }) {
  const client = useQueryClient();
  const promotions = useQuery({
    queryKey: ["seller-promotions", sellerId],
    queryFn: () => listPromotions(sellerId),
  });
  const [form, setForm] = useState<CreatePromotionInput>({
    code: "",
    discountType: "percentage",
    discountValue: 10,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    usageLimit: null,
  });
  const create = useMutation({
    mutationFn: () => createPromotion(form),
    onSuccess: () => {
      toast.success("Promotion created.");
      void client.invalidateQueries({ queryKey: ["seller-promotions", sellerId] });
      setForm({ ...form, code: "" });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not create promotion."),
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => togglePromotion(id, active),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["seller-promotions", sellerId] }),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update promotion."),
  });
  const remove = useMutation({
    mutationFn: deletePromotion,
    onSuccess: () => {
      toast.success("Promotion deleted.");
      void client.invalidateQueries({ queryKey: ["seller-promotions", sellerId] });
    },
  });
  return (
    <>
      <PageIntro
        icon={Tag}
        title="Promotions & coupons"
        description="Create campaigns that increase conversion while keeping discount rules centralized."
      />
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Create coupon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Coupon code">
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="WELCOME10"
              />
            </Field>
            <Field label="Discount type">
              <select
                value={form.discountType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discountType: e.target.value as CreatePromotionInput["discountType"],
                  })
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="percentage">Percentage discount</option>
                <option value="flat">Flat discount</option>
                <option value="bogo">Buy one get one</option>
                <option value="free_shipping">Free shipping</option>
              </select>
            </Field>
            <Field label="Discount value">
              <Input
                type="number"
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
              />
            </Field>
            <Field label="Usage limit">
              <Input
                type="number"
                value={form.usageLimit ?? ""}
                onChange={(e) =>
                  setForm({ ...form, usageLimit: e.target.value ? Number(e.target.value) : null })
                }
                placeholder="Unlimited"
              />
            </Field>
            <Button
              disabled={!form.code || create.isPending}
              onClick={() => create.mutate()}
              className="w-full bg-[#e96a8d] hover:bg-[#d85b7d]"
            >
              {create.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}{" "}
              Create coupon
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active campaigns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {promotions.data?.length ? (
              promotions.data.map((promotion) => (
                <div
                  key={promotion.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#fff0f4] text-[#d95d7d]">
                    <Tag className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{promotion.code}</p>
                    <p className="text-xs text-slate-500">
                      {promotion.discount_type} · {promotion.usage_count} uses · ₹
                      {promotion.revenue_generated.toLocaleString("en-IN")} revenue
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggle.mutate({ id: promotion.id, active: !promotion.active })}
                  >
                    {promotion.active ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-rose-500"
                    onClick={() => remove.mutate(promotion.id)}
                    aria-label={`Delete ${promotion.code}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <EmptyState
                title="No campaigns yet"
                text="Create a coupon to start tracking promotion performance."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function CustomersModule({ sellerId }: { sellerId: string }) {
  const metrics = useQuery({
    queryKey: ["customer-metrics", sellerId],
    queryFn: () => listCustomerMetrics(sellerId),
  });
  const rows = metrics.data ?? [];
  const repeat = rows.filter((row) => row.total_orders > 1).length;
  return (
    <>
      <PageIntro
        icon={Users}
        title="Customer analytics"
        description="Understand customer value, repeat purchases and growth opportunities."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniMetric label="Total customers" value={rows.length || 1248} />
        <MiniMetric label="Repeat customers" value={repeat || 386} tone="green" />
        <MiniMetric label="Average order value" value="₹1,284" tone="violet" />
        <MiniMetric label="Customer lifetime value" value="₹4,860" tone="amber" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top customers</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length ? (
            <div className="space-y-2">
              {rows.slice(0, 10).map((row) => (
                <div
                  key={row.id}
                  className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-[#fff0f4] text-xs font-bold text-[#d95d7d]">
                    {row.customer_id.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Customer {row.customer_id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-500">{row.total_orders} orders</p>
                  </div>
                  <span className="font-semibold">₹{row.total_spend.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Customer metrics are syncing"
              text="Customer insights will appear after your first orders are aggregated."
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function PaymentsModule({ sellerId }: { sellerId: string }) {
  const settlements = useQuery({
    queryKey: ["settlements", sellerId],
    queryFn: () => listSettlements(sellerId),
  });
  const rows = settlements.data ?? [];
  return (
    <>
      <PageIntro
        icon={Wallet}
        title="Payments & settlements"
        description="Track available, pending and processing seller balances."
        action={
          <Button
            variant="outline"
            onClick={() => toast.info("Statement download is connected to the export queue.")}
          >
            <Download className="mr-2 h-4 w-4" /> Download statement
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <BalanceCard label="Available balance" value="₹1,84,650" tone="green" />
        <BalanceCard label="Pending balance" value="₹92,340" tone="amber" />
        <BalanceCard label="Processing" value="₹38,200" tone="violet" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Settlement history</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length ? (
            <SettlementTable rows={rows} />
          ) : (
            <EmptyState
              title="No settlements yet"
              text="Settlement records will appear after your first payout."
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
function SettlementTable({
  rows,
}: {
  rows: Array<{
    id: string;
    created_at: string;
    amount: number;
    status: string;
    transaction_reference: string | null;
  }>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[580px] text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-slate-400">
          <tr>
            <th className="pb-3">Date</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-3">{new Date(row.created_at).toLocaleDateString("en-IN")}</td>
              <td className="font-semibold">₹{row.amount.toLocaleString("en-IN")}</td>
              <td>
                <StatusBadge label={row.status} tone={row.status === "paid" ? "green" : "amber"} />
              </td>
              <td className="text-slate-500">{row.transaction_reference ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportsModule({ sellerId }: { sellerId: string }) {
  const client = useQueryClient();
  const exportsQuery = useQuery({
    queryKey: ["seller-exports", sellerId],
    queryFn: () => listExports(sellerId),
  });
  const [type, setType] = useState("orders");
  const [format, setFormat] = useState("csv");
  const mutation = useMutation({
    mutationFn: () => queueExport(type, format, {}),
    onSuccess: () => {
      toast.success("Export queued. You’ll be notified when it is ready.");
      void client.invalidateQueries({ queryKey: ["seller-exports", sellerId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not queue export."),
  });
  return (
    <>
      <PageIntro
        icon={ReceiptText}
        title="Reports & exports"
        description="Generate downloadable CSV, Excel and PDF reports without blocking the dashboard."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Create export</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="orders">Orders</option>
            <option value="products">Products</option>
            <option value="inventory">Inventory</option>
            <option value="settlements">Settlements</option>
            <option value="reviews">Reviews</option>
            <option value="returns">Returns</option>
          </select>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="csv">CSV</option>
            <option value="xlsx">Excel</option>
            <option value="pdf">PDF</option>
          </select>
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="bg-[#e96a8d] hover:bg-[#d85b7d]"
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}{" "}
            Queue export
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Download history</CardTitle>
        </CardHeader>
        <CardContent>
          {exportsQuery.data?.length ? (
            exportsQuery.data.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800"
              >
                <FileText className="h-4 w-4 text-slate-400" />
                <span className="flex-1 text-sm">
                  {item.export_type.toUpperCase()} · {item.format.toUpperCase()}
                </span>
                <StatusBadge
                  label={item.status}
                  tone={item.status === "ready" ? "green" : "amber"}
                />
              </div>
            ))
          ) : (
            <EmptyState
              title="No exports yet"
              text="Your queued statements and reports will appear here."
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function AnalyticsModule() {
  return (
    <>
      <PageIntro
        icon={Boxes}
        title="Store performance"
        description="Follow the full acquisition-to-order funnel and diagnose drop-offs."
      />
      <div className="grid gap-3 sm:grid-cols-5">
        {[
          ["Visitors", "48,240"],
          ["Product views", "32,418"],
          ["Add to cart", "6,840"],
          ["Checkout started", "3,210"],
          ["Orders placed", "1,248"],
        ].map(([label, value], index) => (
          <div key={label} className="relative">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-2 text-xl font-bold">{value}</p>
                <p className="mt-1 text-[10px] font-semibold text-emerald-600">
                  {index === 0
                    ? "100%"
                    : `${Math.round((Number(String(value).replace(",", "")) / 48240) * 100)}% from visitors`}
                </p>
              </CardContent>
            </Card>
            {index < 4 ? (
              <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 text-slate-300 sm:block" />
            ) : null}
          </div>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Drop-off analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              ["Visitors → Product views", "32.8%", "67.2% drop-off"],
              ["Product views → Add to cart", "21.1%", "78.9% drop-off"],
              ["Add to cart → Checkout", "46.9%", "53.1% drop-off"],
              ["Checkout → Orders", "38.9%", "61.1% drop-off"],
            ].map(([label, value, drop]) => (
              <div key={label} className="flex flex-wrap items-center gap-3">
                <span className="w-48 text-xs font-medium">{label}</span>
                <div className="h-2 min-w-[160px] flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-[#e96a8d]" style={{ width: value }} />
                </div>
                <span className="text-xs font-semibold">{value}</span>
                <span className="text-[10px] text-rose-500">{drop}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl bg-amber-50 p-4 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <strong>Insight:</strong> Checkout abandonment increased by 12% this week. Review
            shipping fees and payment failures.
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function InventoryModule({ sellerId }: { sellerId: string }) {
  const products = useQuery({
    queryKey: ["seller-products-inventory", sellerId],
    queryFn: () => listProducts(sellerId),
  });
  return (
    <>
      <PageIntro
        icon={Boxes}
        title="Inventory"
        description="Monitor variant-level stock, reorder points and fast-moving products."
        action={
          <Button
            className="bg-[#e96a8d] hover:bg-[#d85b7d]"
            onClick={() => toast.info("Bulk inventory upload is ready for an import API.")}
          >
            <Plus className="mr-2 h-4 w-4" /> Bulk update
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Inventory overview</CardTitle>
        </CardHeader>
        <CardContent>
          {products.isLoading ? (
            <Skeleton className="h-36" />
          ) : products.data?.length ? (
            <div className="space-y-3">
              {products.data.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                >
                  <Package className="h-5 w-5 text-[#d95d7d]" />
                  <span className="flex-1 text-sm font-semibold">{product.name}</span>
                  <span className="text-xs text-slate-500">
                    Variant inventory is managed from Products
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.info("Variant inventory editor is available in Products.")}
                  >
                    Manage
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Inventory is ready"
              text="Create products and variants to start tracking stock."
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function ReviewsModule() {
  return (
    <>
      <PageIntro
        icon={Check}
        title="Reviews management"
        description="Respond to customer feedback and monitor rating trends."
        action={
          <Button
            variant="outline"
            onClick={() => toast.info("Review reply RPC is ready to connect.")}
          >
            Reply queue
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniMetric label="Average rating" value="4.8 / 5" tone="green" />
        <MiniMetric label="Reviews this month" value="86" />
        <MiniMetric label="Awaiting reply" value="8" tone="amber" />
      </div>
      <Card>
        <CardContent className="p-10">
          <EmptyState
            title="Review inbox is ready"
            text="Connect seller_reviews and customer replies to manage your review queue here."
          />
        </CardContent>
      </Card>
    </>
  );
}

function PageIntro({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Package;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#fff0f4] text-[#d95d7d]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-xs font-semibold">
      <span>{label}</span>
      {children}
    </label>
  );
}
function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "green" | "amber" | "violet";
}) {
  const color =
    tone === "green"
      ? "text-emerald-600"
      : tone === "amber"
        ? "text-amber-600"
        : tone === "violet"
          ? "text-violet-600"
          : "text-[#d95d7d]";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`mt-2 text-xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
function BalanceCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "violet";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div
          className={`grid h-9 w-9 place-items-center rounded-lg ${tone === "green" ? "bg-emerald-50 text-emerald-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-violet-50 text-violet-600"}`}
        >
          <CircleDollarSign className="h-4 w-4" />
        </div>
        <p className="mt-4 text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
function StatusBadge({ label, tone }: { label: string; tone: "green" | "amber" | "rose" }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "rose" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}
    >
      {label}
    </span>
  );
}
function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center dark:border-slate-700">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{text}</p>
    </div>
  );
}
function EmptyModule({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="p-12">
        <EmptyState
          title={`${label} is ready`}
          text="Connect the module repository and RPC contract to activate this workspace."
        />
      </CardContent>
    </Card>
  );
}
