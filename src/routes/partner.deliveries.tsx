import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Camera, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MapPanel } from "@/components/delivery/MapPanel";
import { StatusBadge } from "@/components/delivery/StatusBadge";
import { EmptyState } from "@/components/delivery/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { usePartner } from "@/hooks/usePartner";
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  DELIVERY_FLOW,
  INR,
  nextFlowStep,
} from "@/lib/delivery";
import { DELIVERY_ORDER_SELECT, normalizeAssignment, normalizeOrder } from "@/lib/shared-orders";

export const Route = createFileRoute("/partner/deliveries")({
  component: Deliveries,
  head: () => ({
    meta: [
      { title: "Active & Past Deliveries | Delivery Partner" },
      {
        name: "description",
        content:
          "Navigate to the vendor, confirm pickup and complete deliveries with OTP or photo proof.",
      },
      { property: "og:title", content: "Active & Past Deliveries | Delivery Partner" },
      {
        property: "og:description",
        content: "Live delivery flow with navigation, pickup confirmation and OTP verification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Deliveries() {
  const { partner } = usePartner();
  const [active, setActive] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const loadInFlightRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!partner || loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    try {
      const [{ data: act, error: activeError }, { data: past, error: historyError }] = await Promise.all([
        db
          .from("delivery_assignments")
          .select(`*, orders(${DELIVERY_ORDER_SELECT})`)
          .eq("partner_id", partner.id)
          .in("status", ACTIVE_ASSIGNMENT_STATUSES)
          .order("created_at", { ascending: false })
          .limit(1),
        db
          .from("delivery_assignments")
          .select(`*, orders(order_number, order_items(*), total, shipping_fee, buyer_name)`)
          .eq("partner_id", partner.id)
          .in("status", ["delivered", "cancelled", "rejected", "expired"])
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (activeError || historyError) {
        console.error("[deliveries] load failed", { activeError, historyError });
        toast.error(activeError?.message ?? historyError?.message ?? "Could not load deliveries");
        return;
      }
      setActive(normalizeAssignment((act ?? [])[0] ?? null));
      setHistory((past ?? []).map((row: any) => normalizeAssignment({ ...row, orders: normalizeOrder(row.orders) })));
    } finally {
      loadInFlightRef.current = false;
    }
  }, [partner?.id]);

  useEffect(() => {
    load();
    if (!partner) return;
    const ch = supabase
      .channel(`deliveries-${partner.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_assignments",
          filter: `partner_id=eq.${partner.id}`,
        },
        () => {
          if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = window.setTimeout(() => void load(), 250);
        },
      )
      .subscribe();
    return () => {
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(ch);
    };
  }, [partner?.id, load]);

  async function advance() {
    if (!active) return;
    const next = nextFlowStep(active.status);
    if (!next) return;
    setBusy(true);

    if (next.status === "delivered") {
      let proofType = "otp";
      let proofValue = otp.trim();
      if (photo) {
        const path = `${partner!.user_id}/proof-${active.id}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("delivery-docs")
          .upload(path, photo, { upsert: true });
        if (upErr) {
          setBusy(false);
          toast.error(upErr.message);
          return;
        }
        proofType = "photo";
        proofValue = path;
      }
      const { error } = await db.rpc("complete_delivery", {
        _assignment_id: active.id,
        _proof_type: proofType,
        _proof_value: proofValue,
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Delivery completed — earnings credited");
      setOtp("");
      setPhoto(null);
      load();
      return;
    }

    const { error } = await db.rpc("advance_delivery_assignment", {
      _assignment_id: active.id,
      _next_status: next.status,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next.label);
    load();
  }

  async function requestContact(party: "vendor" | "customer") {
    if (!active) return;
    const { data, error } = await db.rpc("request_delivery_contact", {
      _assignment_id: active.id,
      _party: party,
    });
    if (error) {
      console.error("[delivery-contact] request failed", error);
      toast.error(error.message);
      return;
    }
    toast.info(data?.message ?? "Masked calling is not configured yet.");
  }

  if (!partner) return null;

  const order = active?.orders;
  const vendor = order?.vendors;
  const step = active ? DELIVERY_FLOW.findIndex((s) => s.status === active.status) : -1;
  const next = active ? nextFlowStep(active.status) : null;
  const dropping = active?.status === "out_for_delivery";
  const from: [number, number] | null = partner.current_latitude
    ? [partner.current_latitude, partner.current_longitude!]
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Deliveries</h1>

      {!active ? (
        <EmptyState
          title="No delivery in progress"
          description="Go online from the header and accept a nearby request to start a delivery."
        />
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              <span>{order?.order_code}</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Order total: {INR(Number(order?.order_total ?? 0))} · Partner earning: {INR(active.estimated_earning)}
              </span>
            </CardTitle>
            <StatusBadge status={active.status} />
          </CardHeader>
          <CardContent className="space-y-5">
            <ol className="flex flex-wrap gap-2">
              {DELIVERY_FLOW.map((s, i) => (
                <li
                  key={s.status}
                  className={
                    "rounded-full px-3 py-1 text-xs font-medium " +
                    (i <= step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {s.label}
                </li>
              ))}
            </ol>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Pickup</p>
                <p className="text-sm text-muted-foreground">
                  {vendor?.shop_name}
                  <br />
                  {vendor?.address}
                </p>
                <Button size="sm" variant="secondary" onClick={() => requestContact("vendor")}>
                  <Phone className="mr-1 h-3.5 w-3.5" /> Call shop
                </Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Drop</p>
                <p className="text-sm text-muted-foreground">
                  {order?.customer_name}
                  <br />
                  {order?.customer_address}
                </p>
                <Button size="sm" variant="secondary" onClick={() => requestContact("customer")}>
                  <Phone className="mr-1 h-3.5 w-3.5" /> Call customer
                </Button>
              </div>
            </div>

            {dropping && order?.customer_latitude ? (
              <MapPanel
                lat={order.customer_latitude}
                lng={order.customer_longitude}
                label={order.customer_address}
                from={from}
              />
            ) : vendor?.latitude ? (
              <MapPanel
                lat={vendor.latitude}
                lng={vendor.longitude}
                label={vendor.address}
                from={from}
              />
            ) : null}

            {order?.items?.length ? (
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-sm font-semibold text-foreground">Items</p>
                <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                  {order.items.map((it: any, i: number) => (
                    <li key={i}>
                      {it.qty ?? 1} × {it.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {next?.status === "delivered" ? (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-sm font-semibold text-foreground">Delivery verification</p>
                <div className="space-y-2">
                  <Label htmlFor="otp">Customer OTP (4–6 digits)</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter customer OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Or upload a proof photo</Label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground hover:bg-muted">
                    <Camera className="h-4 w-4" />
                    {photo ? photo.name : "Take or choose a photo"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {next ? (
              <Button
                className="w-full"
                disabled={busy || (next.status === "delivered" && otp.length < 4 && !photo)}
                onClick={advance}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {DELIVERY_FLOW[step]?.action ?? "Continue"}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {h.orders?.order_code} · {h.orders?.customer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {INR(h.estimated_earning)}
                    </span>
                    <StatusBadge status={h.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
