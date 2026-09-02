import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Download,
  ExternalLink,
  FileBarChart,
  Headphones,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Star,
  Store,
  Tag,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast as _toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { INR } from "@/lib/delivery";
import { DELIVERY_ORDER_SELECT, normalizeOrder } from "@/lib/shared-orders";

type OrderStatus =
  | "placed"
  | "vendor_accepted"
  | "picking"
  | "packed"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned";

type SellerOrder = {
  id: string;
  order_code: string;
  status: OrderStatus;
  customer_name: string;
  order_total: number;
  created_at: string;
  assigned_partner?: {
    id: string;
    full_name: string;
    mobile: string;
    status: string;
    vehicle_type?: string;
    rating?: number;
  } | null;
  delivery_assignment?: any;
};

type HealthMetric = { label: string; value: string; score: number; tone: string };

const chartData = [
  { day: "Mon", sales: 18200, orders: 34, revenue: 15600 },
  { day: "Tue", sales: 21400, orders: 42, revenue: 19000 },
  { day: "Wed", sales: 19800, orders: 38, revenue: 17600 },
  { day: "Thu", sales: 24600, orders: 49, revenue: 22400 },
  { day: "Fri", sales: 28900, orders: 58, revenue: 26200 },
  { day: "Sat", sales: 32700, orders: 71, revenue: 30100 },
  { day: "Sun", sales: 30100, orders: 64, revenue: 27800 },
];

const productData = [
  { name: "Organic Cotton T-shirt", value: 32, color: "#e96a8d" },
  { name: "Classic Sneakers", value: 24, color: "#9174e8" },
  { name: "Canvas Backpack", value: 19, color: "#5fb4a9" },
  { name: "Linen Shirt", value: 15, color: "#e6ac5b" },
  { name: "Other products", value: 10, color: "#a7afbd" },
];

const inventoryAlerts = [
  { name: "Organic Cotton T-shirt", sku: "TSH-OC-001", stock: 0, velocity: "18/day", type: "out" },
  { name: "Classic Sneakers", sku: "SNK-CS-024", stock: 6, velocity: "11/day", type: "low" },
  { name: "Canvas Backpack", sku: "BAG-CN-010", stock: 12, velocity: "9/day", type: "fast" },
  { name: "Linen Shirt", sku: "LSH-LN-006", stock: 8, velocity: "7/day", type: "low" },
];

const navGroups = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Manage",
    items: [
      { label: "Orders", icon: ClipboardList, count: "12" },
      { label: "Products", icon: Package },
      { label: "Inventory", icon: Boxes, count: "4" },
      { label: "Customers", icon: Users },
    ],
  },
  {
    title: "Grow",
    items: [
      { label: "Promotions", icon: Tag },
      { label: "Returns", icon: Truck, count: "3" },
      { label: "Analytics", icon: BarChart3 },
      { label: "Reviews", icon: Star, count: "8" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Payments", icon: Wallet },
      { label: "Reports", icon: FileBarChart },
    ],
  },
];

export const Route = createFileRoute("/vendor")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Seller Central — Local Shore" },
      {
        name: "description",
        content: "Marketplace seller operations, analytics and growth dashboard.",
      },
    ],
  }),
  component: SellerDashboard,
});

function SellerDashboard() {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [sellerName, setSellerName] = useState("Your store");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [range, setRange] = useState<"Daily" | "Weekly" | "Monthly">("Weekly");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Sign in to view your seller dashboard.");
      const { data: seller, error: sellerError } = await db
        .from("sellers")
        .select("id,store_name,shop_name,business_name")
        .eq("user_id", user.user.id)
        .maybeSingle();
      if (sellerError) throw sellerError;
      if (!seller) throw new Error("Seller profile not found.");
      setSellerName(seller.store_name ?? seller.shop_name ?? seller.business_name ?? "Your store");
      const { data, error } = await db
        .from("orders")
        .select(DELIVERY_ORDER_SELECT)
        .eq("seller_id", seller.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setOrders((data ?? []).map((row: unknown) => normalizeOrder(row) as SellerOrder));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load seller data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("seller-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const matchesQuery = `${order.order_code} ${order.customer_name}`
          .toLowerCase()
          .includes(query.toLowerCase());
        return matchesQuery && (statusFilter === "all" || order.status === statusFilter);
      }),
    [orders, query, statusFilter],
  );

  async function advanceOrder(order: SellerOrder) {
    setBusy(order.id);
    const previous = orders;
    setOrders((current) =>
      current.map((item) =>
        item.id === order.id ? { ...item, status: "ready_for_pickup" } : item,
      ),
    );
    const { data, error } = await db.rpc("advance_seller_order", { _order_id: order.id });
    setBusy(null);
    if (error) {
      setOrders(previous);
      toast.error(error.message);
      return;
    }
    toast.success(
      Number(data?.dispatched ?? 0) > 0
        ? `Request sent to ${data.dispatched} nearby partner(s)`
        : "Order is ready. No online partners are available yet.",
    );
  }

  const totalOrders = orders.length || 248;
  const pendingOrders =
    orders.filter((o) => ["placed", "vendor_accepted", "picking", "packed"].includes(o.status))
      .length || 12;
  const deliveredOrders = orders.filter((o) => o.status === "delivered").length || 196;
  const todayRevenue = orders.length
    ? orders
        .filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString())
        .reduce((sum, o) => sum + Number(o.order_total || 0), 0)
    : 24580;

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:grid lg:grid-cols-[248px_1fr]">
      <SellerSidebar active={activeNav} onSelect={setActiveNav} sellerName={sellerName} />
      <main className="min-w-0">
        <SellerTopbar sellerName={sellerName} />
        <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {loading ? (
            <DashboardSkeleton />
          ) : loadError ? (
            <ErrorBanner message={loadError} onRetry={load} />
          ) : null}

          <section className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <WelcomeCard sellerName={sellerName} />
            <HealthCard />
          </section>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            <StatCard
              icon={ShoppingBag}
              label="Today's orders"
              value={String(orders.length ? Math.max(orders.length, 18) : 18)}
              change="12.5%"
              positive
            />
            <StatCard
              icon={ClipboardList}
              label="Pending orders"
              value={String(pendingOrders)}
              change="Needs action"
              tone="amber"
            />
            <StatCard icon={Package} label="Active products" value="186" change="+8 this month" />
            <StatCard
              icon={AlertTriangle}
              label="Low stock"
              value="4"
              change="Review now"
              tone="rose"
            />
            <StatCard
              icon={CircleDollarSign}
              label="Today's revenue"
              value={INR(todayRevenue)}
              change="8.2%"
              positive
            />
            <StatCard
              icon={BarChart3}
              label="Monthly revenue"
              value={INR(684920)}
              change="14.8%"
              positive
            />
            <StatCard
              icon={Wallet}
              label="Pending settlement"
              value={INR(92340)}
              change="Due in 3 days"
              tone="violet"
            />
            <StatCard
              icon={Truck}
              label="Delivered orders"
              value={String(deliveredOrders)}
              change={`${totalOrders ? Math.round((deliveredOrders / totalOrders) * 100) : 79}% fulfilled`}
              positive
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-base">Sales overview</CardTitle>
                  <p className="mt-1 text-xs text-slate-500">
                    Track your store performance over time
                  </p>
                </div>
                <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                  {(["Daily", "Weekly", "Monthly"] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => setRange(item)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium ${range === item ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ left: -18, right: 8, top: 12 }}>
                      <defs>
                        <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#e96a8d" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#e96a8d" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#e8eaf0" />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        tickFormatter={(value) => `₹${Math.round(value / 1000)}k`}
                      />
                      <Tooltip
                        formatter={(value: number) => [INR(value), "Sales"]}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        stroke="#e96a8d"
                        strokeWidth={3}
                        fill="url(#salesFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-base">Top selling products</CardTitle>
                <p className="mt-1 text-xs text-slate-500">Share of orders this month</p>
              </CardHeader>
              <CardContent>
                <div className="h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={productData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={82}
                        paddingAngle={4}
                      >
                        {productData.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value}%`, "Orders"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {productData.slice(0, 4).map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />{" "}
                      <span className="truncate">{item.name}</span>
                      <span className="ml-auto font-semibold">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Orders trend" subtitle="Orders placed over the last 7 days">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: -25, right: 8, top: 10 }}>
                  <CartesianGrid vertical={false} stroke="#e8eaf0" />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <Bar dataKey="orders" fill="#9174e8" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Revenue trend" subtitle="Net revenue after discounts and fees">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: -18, right: 8, top: 10 }}>
                  <CartesianGrid vertical={false} stroke="#e8eaf0" />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => [INR(value), "Revenue"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#5fb4a9"
                    fill="#5fb4a922"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
            <RecentOrders
              orders={filteredOrders}
              query={query}
              setQuery={setQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              busy={busy}
              onAdvance={advanceOrder}
              onRefresh={load}
            />
            <InventoryCenter />
          </section>

          <QuickActions onSelect={setActiveNav} />
          <section className="grid gap-5 lg:grid-cols-[1.1fr_1fr_1fr]">
            <AnalyticsSnapshot />
            <PaymentsSnapshot />
            <NotificationsSnapshot />
          </section>
        </div>
      </main>
    </div>
  );
}

function SellerSidebar({
  active,
  onSelect,
  sellerName,
}: {
  active: string;
  onSelect: (label: string) => void;
  sellerName: string;
}) {
  const navigate = useNavigate();
  const modulePath: Record<string, string> = {
    Orders: "orders",
    Products: "products",
    Inventory: "inventory",
    Customers: "customers",
    Promotions: "promotions",
    Returns: "returns",
    Analytics: "analytics",
    Reviews: "reviews",
    Payments: "payments",
    Reports: "reports",
  };
  return (
    <aside className="hidden border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-900 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-2">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e96a8d] text-white">
          <Store className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">Seller Central</p>
          <p className="truncate text-xs text-slate-500">{sellerName}</p>
        </div>
      </div>
      <div className="my-6 h-px bg-slate-100 dark:bg-slate-800" />{" "}
      <nav className="flex-1 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map(({ label, icon: Icon, count }) => (
                <button
                  key={label}
                  onClick={() => {
                    onSelect(label);
                    if (label === "Dashboard") void navigate({ to: "/vendor" });
                    else if (modulePath[label])
                      void navigate({
                        to: "/vendor/$module",
                        params: { module: modulePath[label] },
                      });
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${active === label ? "bg-[#fff0f4] text-[#d94f76] dark:bg-[#4c2433] dark:text-[#ff91ad]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"}`}
                >
                  <Icon className="h-[17px] w-[17px]" />
                  <span className="flex-1">{label}</span>
                  {count ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-700">
                      {count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button
          onClick={() => toast.info("Settings module is ready for API connection.")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Settings className="h-[17px] w-[17px]" />
          Settings
        </button>
        <button
          onClick={() => toast.info("Support is available at support@localshoree.com")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Headphones className="h-[17px] w-[17px]" />
          Support
        </button>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <p className="text-xs font-semibold">Need help?</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Talk to our seller success team.
          </p>
        </div>
      </div>
    </aside>
  );
}

function SellerTopbar({ sellerName }: { sellerName: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex h-[72px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="lg:hidden">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e96a8d] text-white">
            <Store className="h-4 w-4" />
          </span>
        </div>
        <div className="relative hidden w-full max-w-md md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search orders, products, customers..."
            className="h-10 border-slate-200 bg-slate-50 pl-9 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <button
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#e96a8d] ring-2 ring-white dark:ring-slate-900" />
          </button>
          <div className="hidden h-7 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#fbe1e8] text-sm font-bold text-[#c94c70]">
              {sellerName.slice(0, 1).toUpperCase()}
            </div>
            <div className="hidden text-left sm:block">
              <p className="max-w-[140px] truncate text-xs font-semibold">{sellerName}</p>
              <p className="text-[11px] text-slate-500">Seller account</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
          </div>
        </div>
      </div>
    </header>
  );
}

function WelcomeCard({ sellerName }: { sellerName: string }) {
  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-br from-[#fff1f5] via-white to-[#f9f5ff] shadow-sm dark:from-[#422333] dark:via-slate-900 dark:to-[#29243f]">
      <CardContent className="relative p-6 sm:p-7">
        <div className="relative z-10 max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d95d7d]">
            Monday, 17 August 2026
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Good morning, {sellerName} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-300">
            Here’s what’s happening with your store today. Keep the momentum going.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              onClick={() => toast.info("Product creation flow is ready for API connection.")}
              className="bg-[#e96a8d] text-white hover:bg-[#d85b7d]"
            >
              <Plus className="mr-2 h-4 w-4" /> Add product
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.info("Reports download will be connected to the reports API.")}
              className="border-slate-200 bg-white/70 dark:bg-slate-900/50"
            >
              <Download className="mr-2 h-4 w-4" /> Download report
            </Button>
          </div>
        </div>
        <div className="absolute -right-8 -top-12 h-48 w-48 rounded-full bg-[#f7c6d4]/50 blur-3xl dark:bg-[#e96a8d]/10" />
        <div className="absolute -bottom-16 right-28 h-36 w-36 rounded-full bg-[#d7ccff]/50 blur-3xl dark:bg-[#9174e8]/10" />
      </CardContent>
    </Card>
  );
}

function HealthCard() {
  const metrics: HealthMetric[] = [
    { label: "Order acceptance", value: "98.4%", score: 98, tone: "bg-emerald-500" },
    { label: "Cancellation rate", value: "1.2%", score: 96, tone: "bg-emerald-500" },
    { label: "Late dispatch", value: "2.8%", score: 91, tone: "bg-amber-500" },
    { label: "Customer rating", value: "4.8 / 5", score: 96, tone: "bg-emerald-500" },
    { label: "Return rate", value: "3.1%", score: 88, tone: "bg-amber-500" },
  ];
  return (
    <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Account health</p>
            <p className="mt-1 text-xs text-slate-500">Your store is performing well</p>
          </div>
          <div
            className="relative grid h-16 w-16 place-items-center rounded-full"
            style={{ background: "conic-gradient(#20b486 0 94%, #edf2f2 94% 100%)" }}
          >
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-lg font-bold dark:bg-slate-900">
              94<span className="text-[10px] text-slate-400">/100</span>
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-5">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[10px] text-slate-500">{metric.label}</span>
                <span className="text-[10px] font-bold">{metric.value}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full ${metric.tone}`}
                  style={{ width: `${metric.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  change,
  positive,
  tone,
}: {
  icon: typeof Store;
  label: string;
  value: string;
  change: string;
  positive?: boolean;
  tone?: "amber" | "rose" | "violet";
}) {
  const iconColor =
    tone === "amber"
      ? "text-amber-600 bg-amber-50"
      : tone === "rose"
        ? "text-rose-600 bg-rose-50"
        : tone === "violet"
          ? "text-violet-600 bg-violet-50"
          : "text-[#d95d7d] bg-[#fff0f4]";
  return (
    <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
      <CardContent className="p-4">
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="mt-3 truncate text-[11px] font-medium text-slate-500">{label}</p>
        <p className="mt-1 truncate text-lg font-bold tracking-tight">{value}</p>
        <p
          className={`mt-1 truncate text-[10px] font-semibold ${positive ? "text-emerald-600" : tone ? "text-amber-600" : "text-slate-400"}`}
        >
          {positive ? <ArrowUpRight className="mr-0.5 inline h-3 w-3" /> : null}
          {change}
        </p>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">{children}</div>
      </CardContent>
    </Card>
  );
}

function RecentOrders({
  orders,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  busy,
  onAdvance,
  onRefresh,
}: {
  orders: SellerOrder[];
  query: string;
  setQuery: (v: string) => void;
  statusFilter: "all" | OrderStatus;
  setStatusFilter: (v: "all" | OrderStatus) => void;
  busy: string | null;
  onAdvance: (order: SellerOrder) => void;
  onRefresh: () => void;
}) {
  return (
    <Card id="orders" className="border-slate-200/80 shadow-sm dark:border-slate-800">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Recent orders</CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            Stay on top of fulfilment and customer promises
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} className="text-[#d95d7d]">
          View all <ExternalLink className="ml-1 h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order ID or customer"
              className="h-9 pl-9 text-xs"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | OrderStatus)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            <option value="all">All statuses</option>
            <option value="placed">Pending</option>
            <option value="packed">Packed</option>
            <option value="ready_for_pickup">Ready for pickup</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-700">
            <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-semibold">No orders match your filters</p>
            <p className="mt-1 text-xs text-slate-500">
              New orders will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400 dark:border-slate-800">
                  <th className="pb-3 font-semibold">Order</th>
                  <th className="pb-3 font-semibold">Customer</th>
                  <th className="pb-3 font-semibold">Amount</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Delivery Partner</th>
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 6).map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-slate-50 last:border-0 dark:border-slate-800/70"
                  >
                    <td className="py-3 font-semibold">{order.order_code}</td>
                    <td className="py-3 text-slate-500">{order.customer_name}</td>
                    <td className="py-3 font-semibold">{INR(order.order_total)}</td>
                    <td className="py-3">
                      <OrderPill status={order.status} />
                    </td>
                    <td className="py-3 text-xs">
                      {order.assigned_partner ? (
                        <div>
                          <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {order.assigned_partner.full_name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {order.assigned_partner.mobile}
                          </div>
                        </div>
                      ) : order.status === "ready_for_pickup" ? (
                        <span className="text-[10px] text-amber-600 font-medium animate-pulse">
                          Dispatching partner...
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 text-slate-500">
                      {new Date(order.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td className="py-3 text-right">
                      {["placed", "vendor_accepted", "picking", "packed"].includes(order.status) ? (
                        <Button
                          size="sm"
                          disabled={busy === order.id}
                          onClick={() => onAdvance(order)}
                          className="h-7 bg-[#e96a8d] px-2.5 text-[10px] hover:bg-[#d85b7d]"
                        >
                          Accept & pack
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={`More actions for ${order.order_code}`}
                          onClick={() =>
                            toast.info(
                              "Order details and invoice actions are ready for the orders API.",
                            )
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrderPill({ status }: { status: string }) {
  const labels: Record<string, string> = {
    placed: "Pending",
    vendor_accepted: "Confirmed",
    picking: "Processing",
    packed: "Packed",
    ready_for_pickup: "Ready",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    returned: "Returned",
  };
  const colors: Record<string, string> = {
    placed: "bg-amber-50 text-amber-700",
    vendor_accepted: "bg-blue-50 text-blue-700",
    picking: "bg-violet-50 text-violet-700",
    packed: "bg-indigo-50 text-indigo-700",
    ready_for_pickup: "bg-cyan-50 text-cyan-700",
    out_for_delivery: "bg-orange-50 text-orange-700",
    delivered: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-rose-50 text-rose-700",
    returned: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${colors[status] ?? colors["returned"]}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function InventoryCenter() {
  return (
    <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Inventory alert center</CardTitle>
          <p className="mt-1 text-xs text-slate-500">Keep your bestsellers in stock</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-[#d95d7d]"
          onClick={() => toast.info("Inventory module is ready for API connection.")}
        >
          Manage <ExternalLink className="ml-1 h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-1">
        {inventoryAlerts.map((item) => (
          <div
            key={item.sku}
            className="flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <div
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${item.type === "out" ? "bg-rose-50 text-rose-600" : item.type === "fast" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}
            >
              <Boxes className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{item.name}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                {item.stock} units · {item.velocity}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 px-2 text-[10px]"
              onClick={() => toast.success(`Restock request started for ${item.name}`)}
            >
              {item.type === "out" ? "Restock" : item.type === "fast" ? "View" : "Reorder"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function QuickActions({ onSelect }: { onSelect: (label: string) => void }) {
  const actions = [
    { label: "Add product", icon: Plus },
    { label: "Manage inventory", icon: Boxes },
    { label: "Create coupon", icon: Tag },
    { label: "View orders", icon: ClipboardList },
    { label: "Download reports", icon: Download },
    { label: "Withdraw earnings", icon: Wallet },
  ];
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Quick actions</h2>
          <p className="mt-1 text-xs text-slate-500">Common tasks, one click away</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {actions.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => {
              onSelect(label);
              toast.info(`${label} is ready for API connection.`);
            }}
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#f1a0b5] hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#fff0f4] text-[#d95d7d] transition group-hover:bg-[#e96a8d] group-hover:text-white">
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold">{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AnalyticsSnapshot() {
  return (
    <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
      <CardHeader>
        <CardTitle className="text-base">Analytics snapshot</CardTitle>
        <p className="mt-1 text-xs text-slate-500">This month vs last month</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {[
          ["Total sales", "₹6.84L", "+14.8%", true],
          ["Conversion rate", "3.62%", "+0.44%", true],
          ["Product views", "48.2K", "+22.1%", true],
          ["Cart additions", "6,840", "-2.3%", false],
        ].map(([label, value, change, positive]) => (
          <div key={String(label)} className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-bold">{value}</p>
            </div>
            <span
              className={`text-xs font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}
            >
              {positive ? (
                <ArrowUpRight className="mr-0.5 inline h-3 w-3" />
              ) : (
                <ArrowDownRight className="mr-0.5 inline h-3 w-3" />
              )}
              {change}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PaymentsSnapshot() {
  return (
    <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
      <CardHeader>
        <CardTitle className="text-base">Payments & settlements</CardTitle>
        <p className="mt-1 text-xs text-slate-500">Your next payout is on 20 Aug</p>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl bg-[#fff5f7] p-4 dark:bg-[#452432]">
          <p className="text-xs text-slate-500 dark:text-slate-300">Available balance</p>
          <p className="mt-1 text-2xl font-bold">₹1,84,650</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-slate-800">
            <div className="h-full w-[68%] rounded-full bg-[#e96a8d]" />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-500">
            <span>₹1.84L available</span>
            <span>₹92K pending</span>
          </div>
        </div>
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={() => toast.info("Settlement statements are ready for payments API connection.")}
        >
          View settlement history <ExternalLink className="ml-2 h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

function NotificationsSnapshot() {
  const items = [
    {
      icon: ShoppingBag,
      text: "12 new orders need attention",
      time: "12 min ago",
      color: "text-blue-600 bg-blue-50",
    },
    {
      icon: AlertTriangle,
      text: "4 products are running low on stock",
      time: "1 hr ago",
      color: "text-amber-600 bg-amber-50",
    },
    {
      icon: Star,
      text: "8 new reviews to respond to",
      time: "3 hrs ago",
      color: "text-violet-600 bg-violet-50",
    },
    {
      icon: CircleDollarSign,
      text: "Settlement of ₹72,450 processed",
      time: "Yesterday",
      color: "text-emerald-600 bg-emerald-50",
    },
  ];
  return (
    <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Notifications</CardTitle>
          <p className="mt-1 text-xs text-slate-500">Stay in the loop</p>
        </div>
        <button
          aria-label="Clear notifications"
          className="text-slate-400 hover:text-slate-700"
          onClick={() => _toast.info("Notifications are managed by the seller notifications API.")}
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map(({ icon: Icon, text, time, color }) => (
          <button
            key={text}
            onClick={() => toast.info(text)}
            className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${color}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{text}</span>
              <span className="mt-1 block text-[10px] text-slate-400">{time}</span>
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
      <AlertTriangle className="h-4 w-4" />
      <span className="flex-1">{message}</span>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="border-rose-200 bg-transparent"
      >
        Try again
      </Button>
    </div>
  );
}
