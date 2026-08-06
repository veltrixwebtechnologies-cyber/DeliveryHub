import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Bike,
  FileText,
  LayoutDashboard,
  Loader2,
  Package,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/delivery/AppShell";
import { MapPanel } from "@/components/delivery/MapPanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { usePartner } from "@/hooks/usePartner";
import { INR, etaMinutes, PARTNER_STATUS_LABEL } from "@/lib/delivery";
import { StatusBadge } from "@/components/delivery/StatusBadge";
import { DELIVERY_ORDER_SELECT, normalizeAssignment } from "@/lib/shared-orders";

export const Route = createFileRoute("/partner")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Partner dashboard — Local Shore Delivery" },
      {
        name: "description",
        content:
          "Go online, accept nearby delivery requests, track live orders, and follow your earnings and performance as a Local Shore delivery partner.",
      },
      { property: "og:title", content: "Partner dashboard — Local Shore Delivery" },
      {
        property: "og:description",
        content: "Live delivery requests, order flow, earnings and documents in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PartnerLayout,
});

const NAV = [
  { to: "/partner", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/partner/deliveries", label: "Deliveries", icon: <Package className="h-4 w-4" /> },
  { to: "/partner/earnings", label: "Earnings", icon: <Wallet className="h-4 w-4" /> },
  { to: "/partner/documents", label: "Documents", icon: <FileText className="h-4 w-4" /> },
];

type RequestRow = {
  id: string;
  order_id: string;
  distance_km: number;
  estimated_earning: number;
  expires_at: string;
  status: string;
  orders: any;
};

function PartnerLayout() {
  const { partner, user, isLoading: loading, refetch: refresh } = usePartner();
  const navigate = useNavigate();
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const watchRef = useRef<number | null>(null);
  const locationErrorShownRef = useRef(false);
  const shownNotificationIdsRef = useRef(new Set<string>());
  const shownNotificationKeysRef = useRef(new Set<string>());

  const submitPosition = useCallback(async (pos: GeolocationPosition) => {
    // Desktop/browser geolocation can report a very coarse accuracy value.
    // Keep the coordinates, but omit an unusable accuracy value so older
    // deployed RPCs do not reject an otherwise valid location update.
    const reportedAccuracy = pos.coords.accuracy;
    const accuracy = Number.isFinite(reportedAccuracy) && reportedAccuracy > 0 && reportedAccuracy <= 2000
      ? reportedAccuracy
      : null;
    const { error } = await db.rpc("submit_partner_location", {
      _latitude: pos.coords.latitude,
      _longitude: pos.coords.longitude,
      _accuracy_m: accuracy,
      // Browser fallback providers can return a stale device timestamp even
      // though the callback is current. The server validates this timestamp,
      // so use the callback time for the location update.
      _captured_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[delivery-location] update failed", error);
      if (!locationErrorShownRef.current) {
        locationErrorShownRef.current = true;
        toast.error(`Location update failed: ${error.message}`);
      }
      return false;
    }
    locationErrorShownRef.current = false;
    return true;
  }, []);

  const handlePositionError = useCallback((error: GeolocationPositionError) => {
    console.error("[delivery-location] browser geolocation failed", error);
    if (!locationErrorShownRef.current) {
      locationErrorShownRef.current = true;
      const message = error.code === 1
        ? "Allow location access to receive delivery requests."
        : error.code === 3
          ? "Location request timed out. Keep GPS enabled and try again."
          : "Unable to read your location. Keep GPS enabled and try again.";
      toast.error(message);
    }
  }, []);

  const requestCurrentPosition = useCallback(() => {
    // High-accuracy GPS can time out on desktops and indoors. Fall back to
    // the browser/network location so an online partner can still be found.
    navigator.geolocation.getCurrentPosition(
      submitPosition,
      (error) => {
        if (error.code !== 3) {
          handlePositionError(error);
          return;
        }
        navigator.geolocation.getCurrentPosition(submitPosition, handlePositionError, {
          enableHighAccuracy: false,
          maximumAge: 0,
          timeout: 30_000,
        });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  }, [handlePositionError, submitPosition]);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth" });
    else if (!partner) navigate({ to: "/register" });
    else if (partner.status === "draft") navigate({ to: "/register" });
  }, [loading, user, partner, navigate]);

  // Live location while online
  useEffect(() => {
    if (!partner || partner.availability === "offline") return;
    if (!("geolocation" in navigator)) return;

    // Submit immediately so a newly-online partner can receive dispatches
    // without waiting for movement or a browser watch callback.
    requestCurrentPosition();

    watchRef.current = navigator.geolocation.watchPosition(
      submitPosition,
      handlePositionError,
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 30_000 },
    );

    const refreshLocation = window.setInterval(() => {
      requestCurrentPosition();
    }, 45_000);

    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      window.clearInterval(refreshLocation);
    };
  }, [partner, requestCurrentPosition, submitPosition, handlePositionError]);

  // Incoming request realtime + initial fetch
  useEffect(() => {
    if (!partner) return;
    let loadInFlight = false;
    let refreshTimer: number | null = null;
    const load = async () => {
      if (loadInFlight) return;
      loadInFlight = true;
      const { data: notifications, error: notificationError } = await db
        .from("delivery_notifications")
        .select("id, title, body")
        .eq("partner_id", partner.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(5);
      if (!notificationError && notifications?.length) {
        const unseen = notifications.filter((notification) => {
          const key = `${notification.title}|${notification.body ?? ""}`;
          if (shownNotificationKeysRef.current.has(key)) return false;
          shownNotificationKeysRef.current.add(key);
          return !shownNotificationIdsRef.current.has(notification.id);
        });
        unseen.forEach((notification) => {
          shownNotificationIdsRef.current.add(notification.id);
          toast.info(notification.title, { description: notification.body ?? undefined });
        });
        const ids = notifications.map((notification) => notification.id);
        await db.from("delivery_notifications").update({ is_read: true }).in("id", ids);
      }

      if (partner.availability !== "online") {
        setRequest(null);
        loadInFlight = false;
        return;
      }
      const { data: activeAssignments, error: activeError } = await db
        .from("delivery_assignments")
        .select("id")
        .eq("partner_id", partner.id)
        .in("status", ["accepted", "navigating_to_vendor", "reached_vendor", "picked_up", "out_for_delivery"])
        .limit(1);
      if (!activeError && activeAssignments?.length) {
        setRequest(null);
        loadInFlight = false;
        return;
      }
      const { data, error } = await db
        .from("delivery_assignments")
        // Keep the notification query independent from the orders relation.
        // A broken/overly restrictive orders policy must not hide a delivery
        // assignment from the partner.
        .select("*")
        .eq("partner_id", partner.id)
        // The shared SQL workflow creates delivery requests as `pending`.
        // Keep `requested` for compatibility with older assignment rows.
        .in("status", ["pending", "requested"])
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) {
        console.error("[delivery-assignments] incoming request load failed", error);
        toast.error("Could not load delivery requests. Please try again.");
        loadInFlight = false;
        return;
      }
      const assignment = (data ?? [])[0] ?? null;
      if (!assignment) {
        setRequest(null);
        loadInFlight = false;
        return;
      }

      // Order details are supplemental to the alert. If this relation query
      // is blocked by an orders RLS issue, the partner can still see and act
      // on the incoming assignment.
      const { data: order, error: orderError } = await db
        .from("orders")
        .select(DELIVERY_ORDER_SELECT)
        .eq("id", assignment.order_id)
        .maybeSingle();
      if (orderError) {
        console.error("[delivery-assignments] order details load failed", orderError);
      }
      // A stale assignment must never be shown when the order has already
      // been assigned (including after an accept/realtime race).
      if (order?.assigned_partner_id) {
        setRequest(null);
        loadInFlight = false;
        return;
      }
      setRequest(normalizeAssignment({ ...assignment, orders: order ?? null }));
      loadInFlight = false;
    };
    void load();

    // Realtime is preferred, but polling keeps assignment alerts working when
    // the table is not present in the project's Realtime publication.
    const poll = window.setInterval(() => void load(), 5000);

    const channel = supabase
      .channel(`partner-${partner.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_assignments",
          filter: `partner_id=eq.${partner.id}`,
        },
        () => {
          if (refreshTimer !== null) window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(() => void load(), 250);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "delivery_notifications",
          filter: `partner_id=eq.${partner.id}`,
        },
        () => {
          if (refreshTimer !== null) window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(() => void load(), 250);
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(poll);
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [partner]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!request) return 0;
    return Math.max(0, Math.round((new Date(request.expires_at).getTime() - now) / 1000));
  }, [request, now]);

  useEffect(() => {
    if (request && secondsLeft === 0) setRequest(null);
  }, [request, secondsLeft]);

  async function respond(accept: boolean) {
    if (!request) return;
    setBusy(true);
    if (accept) {
      const { data, error } = await db.rpc("accept_delivery_request", { _assignment_id: request.id });
      setBusy(false);
      if (error) {
        console.error("[delivery-assignments] accept failed", {
          assignmentId: request.id,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        toast.error(error.message || "Could not accept this delivery request.");
        setRequest(null);
        return;
      }
      if (!data) {
        toast.info("This request is no longer available.");
        setRequest(null);
        return;
      }
      toast.success("Delivery accepted");
      setRequest(null);
      navigate({ to: "/partner/deliveries" });
    } else {
      const { error } = await db.rpc("reject_delivery_request", {
        _assignment_id: request.id,
      });
      if (error) toast.error(error.message);
      setBusy(false);
      setRequest(null);
    }
  }

  async function dismissRequest() {
    const pending = request;
    setRequest(null);
    if (!pending) return;

    // Closing a request is a decline, not just a visual dismissal. This
    // prevents the polling loop from reopening the same pending assignment.
    const { error } = await db.rpc("reject_delivery_request", {
      _assignment_id: pending.id,
    });
    if (error) console.error("[delivery-assignments] dismiss failed", error);
  }

  async function toggleOnline(on: boolean) {
    if (!partner) return;
    if (on && partner.status !== "approved") {
      toast.error("Your application is still under review.");
      return;
    }
    if (!on) void dismissRequest();
    const { error } = await db
      .from("delivery_partners")
      .update({ availability: on ? "online" : "offline" })
      .eq("id", partner.id);
    if (error) {
      console.error("[delivery-availability] update failed", error);
      toast.error(error.message);
      return;
    }
    if (on) {
      // Every online session starts with a fresh location attempt. This keeps
      // an old location timestamp from carrying over after going offline.
      locationErrorShownRef.current = false;
    }
    await refresh();
    if (on && "geolocation" in navigator) requestCurrentPosition();
  }

  if (loading || !partner) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-12">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const order = request?.orders;
  const vendor = order?.vendors;

  return (
    <AppShell
      title="Local Shore Partners"
      nav={NAV}
      right={
        <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5">
          <span className="text-xs font-medium text-secondary-foreground">
            {partner.availability === "online" ? "Online" : "Offline"}
          </span>
          <Switch
            checked={partner.availability === "online"}
            onCheckedChange={toggleOnline}
            aria-label="Toggle online"
          />
        </div>
      }
    >
      {partner.status !== "approved" ? (
        <Card className="mb-6 border-primary/30 bg-secondary">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Bike className="h-5 w-5 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Application {PARTNER_STATUS_LABEL[partner.status] ?? partner.status}
              </p>
              <p className="text-sm text-muted-foreground">
                {partner.admin_note ??
                  "Our team is verifying your documents. You can go online once approved."}
              </p>
            </div>
            <StatusBadge status={partner.status} kind="partner" />
          </CardContent>
        </Card>
      ) : null}

      <Outlet />

      <Dialog open={!!request} onOpenChange={(o) => (!o ? void dismissRequest() : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New delivery request</DialogTitle>
          </DialogHeader>
          {request ? (
            <div className="space-y-4">
              <Progress value={(secondsLeft / 60) * 100} />
              <p className="text-center text-sm text-muted-foreground">
                {secondsLeft}s to respond
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Info label="Earning" value={INR(request.estimated_earning)} />
                <Info label="Distance" value={`${Number(request.distance_km).toFixed(1)} km`} />
                <Info label="ETA" value={`${etaMinutes(Number(request.distance_km))} min`} />
              </div>
              <div className="space-y-1 rounded-lg bg-secondary p-3 text-sm">
                <p className="font-semibold text-foreground">
                  Pickup · {vendor?.shop_name ?? "Vendor"}
                </p>
                <p className="text-muted-foreground">{vendor?.address}</p>
                <p className="mt-2 font-semibold text-foreground">Drop · {order?.customer_name}</p>
                <p className="text-muted-foreground">{order?.customer_address}</p>
              </div>
              {vendor?.latitude ? (
                <MapPanel
                  lat={vendor.latitude}
                  lng={vendor.longitude}
                  label={vendor.shop_name}
                  height={160}
                  from={
                    partner.current_latitude
                      ? [partner.current_latitude, partner.current_longitude!]
                      : null
                  }
                />
              ) : null}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => respond(false)}
                >
                  Reject
                </Button>
                <Button className="flex-1" disabled={busy} onClick={() => respond(true)}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Accept
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
