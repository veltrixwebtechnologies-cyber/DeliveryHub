import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { AppShell, EmptyState } from "@/components/delivery/AppShell";
import { StatusBadge } from "@/components/delivery/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { INR } from "@/lib/delivery";
import { DELIVERY_ORDER_SELECT, normalizeOrder } from "@/lib/shared-orders";

export const Route = createFileRoute("/vendor")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Vendor pickup console — Local Shore" },
      {
        name: "description",
        content:
          "Shop-side console to mark packed orders ready for pickup and broadcast the delivery request to nearby online riders.",
      },
      { property: "og:title", content: "Vendor pickup console — Local Shore" },
      {
        property: "og:description",
        content: "Mark orders ready and dispatch them to the nearest available delivery partners.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VendorConsole,
});

function VendorConsole() {
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      setOrders([]);
      return;
    }
    const { data: seller, error: sellerError } = await db
      .from("sellers")
      .select("id")
      .eq("user_id", user.user.id)
      .maybeSingle();
    if (sellerError || !seller) {
      setOrders([]);
      return;
    }
    const { data } = await db
      .from("orders")
      .select(DELIVERY_ORDER_SELECT)
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setOrders((data ?? []).map(normalizeOrder));
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("vendor-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  async function markReady(order: any) {
    setBusy(order.id);
    const { data, error: rpcErr } = await db.rpc("advance_seller_order", {
      _order_id: order.id,
    });
    setBusy(null);
    if (rpcErr) {
      toast.error(rpcErr.message);
      return;
    }
    toast.success(
      Number(data?.dispatched ?? 0) > 0
        ? `Request sent to ${data.dispatched} nearby partner(s)`
        : "Order is ready. No online partners are available yet.",
    );
    load();
  }

  return (
    <AppShell
      title="Local Shore Vendor"
      nav={[{ to: "/vendor", label: "Orders", icon: <Store className="h-4 w-4" /> }]}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Mark a packed order ready for pickup to alert the nearest online delivery partners.
          </p>
        </div>

        {orders.length === 0 ? (
          <EmptyState title="No orders" description="New customer orders will appear here." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {orders.map((o) => (
              <Card key={o.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{o.order_code}</p>
                    <StatusBadge status={o.status} kind="order" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {o.vendors?.shop_name ?? "Local Shore shop"} → {o.customer_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{o.customer_address}</p>
                  <p className="text-sm font-medium text-foreground">
                    {INR(o.order_total)} · delivery {INR(o.delivery_fee)}
                  </p>
                  {["placed", "accepted", "packed"].includes(o.status) ? (
                    <Button
                      size="sm"
                      className="mt-1"
                      disabled={busy === o.id}
                      onClick={() => markReady(o)}
                    >
                      Mark ready for pickup
                    </Button>
                  ) : o.status === "ready_for_pickup" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-1"
                      disabled={busy === o.id}
                      onClick={() => markReady(o)}
                    >
                      Re-broadcast request
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
