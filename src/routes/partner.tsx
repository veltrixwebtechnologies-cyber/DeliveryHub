import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bike,
  Clock,
  FileText,
  Gift,
  LayoutDashboard,
  Loader2,
  Navigation,
  Package,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/delivery/AppShell";
import { AddressNavigation, MapPanel } from "@/components/delivery/MapPanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { usePartner } from "@/hooks/usePartner";
import { INR, etaMinutes, PARTNER_STATUS_LABEL } from "@/lib/delivery";
import { StatusBadge } from "@/components/delivery/StatusBadge";
import { DELIVERY_ORDER_SELECT, normalizeAssignment } from "@/lib/shared-orders";
import {
  acceptDelivery,
  claimNextDeliveryOffer,
  goOffline,
  rejectDelivery,
} from "@/services/deliveryService";
import { locationService } from "@/services/locationService";
import { setPartnerAvailability } from "@/repositories/partnerRepository";

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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
  { to: "/partner/referral", label: "Refer & Earn", icon: <Gift className="h-4 w-4 text-emerald-500" /> },
  { to: "/partner/rentals", label: "Rent Vehicle", icon: <Bike className="h-4 w-4 text-blue-500" /> },
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
  const [lowPowerMode, setLowPowerMode] = useState(false);
  const [zoneInfo, setZoneInfo] = useState<{
    isOutOfZone: boolean;
    distanceKm: number;
    zoneName: string;
    zoneLat: number;
    zoneLng: number;
  } | null>(null);
  const watchRef = useRef<number | null>(null);
  const locationErrorShownRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const offlineWriteRef = useRef(false);
  const shownNotificationIdsRef = useRef(new Set<string>());
  const shownNotificationKeysRef = useRef(new Set<string>());

  // Zone geofence check
  useEffect(() => {
    if (!partner || partner.availability !== "online") {
      setZoneInfo(null);
      return;
    }

    const checkZone = async () => {
      let zoneLat = 13.0827; // Default Shoreline hub center
      let zoneLng = 80.2707;
      let zoneName = "Shoreline Central Zone";
      let radiusKm = 30.0;

      try {
        const { data: partnerZones } = await db
          .from("delivery_partner_zones")
          .select("delivery_zones(id, name, latitude, longitude, radius_km)")
          .eq("partner_id", partner.id)
          .limit(1);

        if (partnerZones && partnerZones.length > 0 && partnerZones[0].delivery_zones) {
          const z = partnerZones[0].delivery_zones as any;
          if (z.latitude && z.longitude) {
            zoneLat = Number(z.latitude);
            zoneLng = Number(z.longitude);
            zoneName = z.name || "Assigned Zone";
            radiusKm = Math.max(Number(z.radius_km || 30.0), 30.0);
          }
        }
      } catch (zErr) {
        console.error("[zone-check] failed reading zone info", zErr);
      }

      if (Number.isFinite(partner.current_latitude) && Number.isFinite(partner.current_longitude)) {
        const dist = haversineDistanceKm(
          Number(partner.current_latitude),
          Number(partner.current_longitude),
          zoneLat,
          zoneLng,
        );
        const outOfZone = dist > radiusKm;
        setZoneInfo({
          isOutOfZone: outOfZone,
          distanceKm: dist,
          zoneName,
          zoneLat,
          zoneLng,
        });

        if (outOfZone) {
          toast.warning(
            `🚨 You are ${dist.toFixed(1)} km outside your assigned zone (${zoneName}). Return to your zone or sync to your location to receive orders.`,
            { id: "out-of-zone-toast", duration: 8000 },
          );
        }
      }
    };

    void checkZone();
  }, [partner?.id, partner?.availability, partner?.current_latitude, partner?.current_longitude]);

  const handleSyncZoneToCurrentLocation = async () => {
    if (!partner || !partner.current_latitude || !partner.current_longitude) {
      toast.error("Location not acquired yet. Please allow GPS access.");
      return;
    }
    try {
      const { error } = await db.rpc("sync_partner_zone_to_current_location", {
        _partner_id: partner.id,
        _lat: Number(partner.current_latitude),
        _lng: Number(partner.current_longitude),
      });
      if (error) {
        // Fallback: direct table updates if RPC is pending migration execution
        await db.from("delivery_partners").update({
          current_latitude: partner.current_latitude,
          current_longitude: partner.current_longitude,
          location_updated_at: new Date().toISOString(),
        }).eq("id", partner.id);
      }
      toast.success("🎯 Zone synced to your current location!");
      setZoneInfo(null);
      await refresh();
    } catch (err) {
      console.error("[sync-zone] error", err);
      toast.error("Failed to sync zone location.");
    }
  };

  const markOffline = useCallback(
    async (reason: string) => {
      if (!partner || partner.availability !== "online" || offlineWriteRef.current) return;
      offlineWriteRef.current = true;
      let error: unknown = null;
      try {
        await goOffline();
      } catch (rpcError) {
        error = rpcError;
      }
      offlineWriteRef.current = false;
      if (!error) {
        setRequest(null);
        toast.info(`You are offline${reason ? `: ${reason}` : ""}.`);
        await refresh();
      }
    },
    [partner?.availability, partner?.id, refresh],
  );

  const submitPosition = useCallback(async (pos: GeolocationPosition) => {
    // Desktop/browser geolocation can report a very coarse accuracy value.
    // Keep the coordinates, but omit an unusable accuracy value so older
    // deployed RPCs do not reject an otherwise valid location update.
    const reportedAccuracy = pos.coords.accuracy;
    const accuracy =
      Number.isFinite(reportedAccuracy) && reportedAccuracy > 0 && reportedAccuracy <= 2000
        ? reportedAccuracy
        : null;
    try {
      await locationService.submitCurrentLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracyM: accuracy,
        capturedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[delivery-location] update failed", error);
      if (!locationErrorShownRef.current) {
        locationErrorShownRef.current = true;
        toast.error(
          `Location update failed: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
      return false;
    }
    locationErrorShownRef.current = false;
    lastActivityRef.current = Date.now();
    return true;
  }, []);

  const handlePositionError = useCallback(
    (error: GeolocationPositionError) => {
      console.error("[delivery-location] browser geolocation failed", error);
      if (error.code === 1 || error.code === 2) void markOffline("GPS is unavailable");
      if (!locationErrorShownRef.current) {
        locationErrorShownRef.current = true;
        const message =
          error.code === 1
            ? "Allow location access to receive delivery requests."
            : error.code === 3
              ? "Location request timed out. Keep GPS enabled and try again."
              : "Unable to read your location. Keep GPS enabled and try again.";
        toast.error(message);
      }
    },
    [markOffline],
  );

  const requestCurrentPosition = useCallback((): Promise<boolean> => {
    if (!("geolocation" in navigator)) {
      toast.error("Location services are not available in this browser.");
      return Promise.resolve(false);
    }

    // High-accuracy GPS can time out on desktops and indoors. Fall back to
    // the browser/network location so an online partner can still be found.
    return new Promise((resolve) => {
      const submit = (position: GeolocationPosition) => {
        void submitPosition(position).then(resolve);
      };
      const fallback = (error: GeolocationPositionError) => {
        if (error.code !== 3) {
          handlePositionError(error);
          resolve(false);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          submit,
          (fallbackError) => {
            handlePositionError(fallbackError);
            resolve(false);
          },
          { enableHighAccuracy: false, maximumAge: 0, timeout: 30_000 },
        );
      };
      navigator.geolocation.getCurrentPosition(submit, fallback, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15_000,
      });
    });
  }, [handlePositionError, submitPosition]);

  useEffect(() => {
    if (!partner) return;
    type Battery = {
      level: number;
      charging: boolean;
      addEventListener: (event: string, listener: () => void) => void;
      removeEventListener: (event: string, listener: () => void) => void;
    };
    const batteryApi = navigator as Navigator & { getBattery?: () => Promise<Battery> };
    if (!batteryApi.getBattery) return;
    let battery: Battery | null = null;
    const syncBattery = () => {
      const low = !!battery && !battery.charging && battery.level <= 0.15;
      setLowPowerMode(low);
      if (low) toast.warning("Battery is low. Power-saving location updates are enabled.");
    };
    void batteryApi.getBattery().then((value) => {
      battery = value;
      syncBattery();
      value.addEventListener("levelchange", syncBattery);
      value.addEventListener("chargingchange", syncBattery);
    });
    return () => {
      if (battery) {
        battery.removeEventListener("levelchange", syncBattery);
        battery.removeEventListener("chargingchange", syncBattery);
      }
    };
  }, [partner?.id]);

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

    watchRef.current = navigator.geolocation.watchPosition(submitPosition, handlePositionError, {
      enableHighAccuracy: false,
      maximumAge: 30_000,
      timeout: 30_000,
    });

    const refreshLocation = window.setInterval(
      () => {
        requestCurrentPosition();
      },
      lowPowerMode ? 120_000 : 45_000,
    );

    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      window.clearInterval(refreshLocation);
    };
  }, [partner, requestCurrentPosition, submitPosition, handlePositionError, lowPowerMode]);

  // Keep availability truthful without polling aggressively. A browser/network
  // disconnect, revoked GPS permission, or ten minutes without a heartbeat
  // takes the rider offline so new work is not dispatched to a dead session.
  useEffect(() => {
    if (!partner || partner.availability !== "online") return;
    lastActivityRef.current = Date.now();
    const touch = () => {
      lastActivityRef.current = Date.now();
    };
    const onOffline = () => void markOffline("internet connection lost");
    const onOnline = () => {
      lastActivityRef.current = Date.now();
      toast.info("Connection restored. Location will refresh shortly.");
    };
    window.addEventListener("pointerdown", touch, { passive: true });
    window.addEventListener("keydown", touch, { passive: true });
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= 10 * 60 * 1000) {
        void markOffline("inactive for 10 minutes");
      }
    }, 60_000);
    return () => {
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [partner?.availability, partner?.id, markOffline]);

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
        const unseen = notifications.filter(
          (notification: { id: string; title: string; body: string | null }) => {
            const key = `${notification.title}|${notification.body ?? ""}`;
            if (shownNotificationKeysRef.current.has(key)) return false;
            shownNotificationKeysRef.current.add(key);
            return !shownNotificationIdsRef.current.has(notification.id);
          },
        );
        unseen.forEach((notification: (typeof notifications)[number]) => {
          shownNotificationIdsRef.current.add(notification.id);
          toast.info(notification.title, { description: notification.body ?? undefined });
        });
        const ids = notifications.map((notification: { id: string }) => notification.id);
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
        .in("status", [
          "accepted",
          "navigating_to_vendor",
          "reached_vendor",
          "picked_up",
          "out_for_delivery",
        ])
        .limit(1);
      if (!activeError && activeAssignments?.length) {
        setRequest(null);
        loadInFlight = false;
        return;
      }

      // Realtime/server dispatch can be delayed or unavailable. This secure
      // RPC atomically creates one eligible offer for this authenticated,
      // approved online partner without exposing unassigned order data.
      try {
        await claimNextDeliveryOffer();
      } catch (claimError) {
        console.error("[delivery-assignments] offer claim failed", {
          message: claimError instanceof Error ? claimError.message : "unknown error",
        });
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

      if (
        !["pending", "requested"].includes(assignment.status) ||
        !assignment.expires_at ||
        new Date(assignment.expires_at).getTime() <= Date.now()
      ) {
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
      // A stale assignment must never be processed when the order has already
      // been assigned (including after an accept/realtime race).
      if (order?.assigned_partner_id) {
        setRequest(null);
        loadInFlight = false;
        return;
      }

      // Auto-approve incoming delivery request (No manual Accept/Decline step)
      try {
        const acceptedData = await acceptDelivery(assignment.id);
        if (acceptedData) {
          toast.success("⚡ Order Auto-Approved & Assigned!", {
            description: `Pickup: ${order?.vendors?.shop_name ?? "Local Shop"} · Drop: ${order?.customer_name ?? "Customer"}`,
            duration: 6000,
          });
          void requestCurrentPosition().then(() => refresh());
          navigate({ to: "/partner/deliveries" });
          loadInFlight = false;
          return;
        }
      } catch (autoErr) {
        console.error("[auto-approval] failed auto-accepting delivery", autoErr);
      }

      setRequest(normalizeAssignment({ ...assignment, orders: order ?? null }));
      loadInFlight = false;
    };
    void load();

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
    if (accept && new Date(request.expires_at).getTime() <= Date.now()) {
      setRequest(null);
      toast.info("This delivery request has expired. Stay online for the next request.");
      return;
    }
    setBusy(true);
    if (accept) {
      let data: string | null = null;
      let error: unknown = null;
      try {
        data = await acceptDelivery(request.id);
      } catch (caught) {
        error = caught;
      }
      setBusy(false);
      if (error) {
        console.error("[delivery-assignments] accept failed", {
          assignmentId: request.id,
          message: error instanceof Error ? error.message : "unknown error",
        });
        toast.error(
          error instanceof Error ? error.message : "Could not accept this delivery request.",
        );
        setRequest(null);
        return;
      }
      if (!data) {
        const message =
          new Date(request.expires_at).getTime() <= Date.now()
            ? "This delivery request expired before it could be accepted. Stay online for the next request."
            : "Another delivery partner accepted this request first.";
        toast.info(message);
        setRequest(null);
        return;
      }
      // Never delay acceptance for a GPS callback: a request is timed and can
      // expire while a phone acquires a high-accuracy fix. The accepted
      // assignment is now available, so this update becomes its first tracked
      // location point.
      // Refresh the shared partner cache after the first post-accept GPS
      // write so the deliveries page can render the current origin instead of
      // the coordinates that were cached before acceptance.
      void requestCurrentPosition().then(() => refresh());
      toast.success("Delivery accepted");
      setRequest(null);
      navigate({ to: "/partner/deliveries" });
    } else {
      try {
        await rejectDelivery(request.id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not reject this request.");
      }
      setBusy(false);
      setRequest(null);
    }
  }

  function closeRequestDialog() {
    setRequest(null);
    toast.info("Delivery request is still available and will reappear shortly.");
  }

  async function toggleOnline(on: boolean) {
    if (!partner) return;
    if (on && partner.status !== "approved") {
      toast.error("Your application is still under review.");
      return;
    }
    if (on && typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Reconnect to the internet before going online.");
      return;
    }
    if (!on) {
      await markOffline("you chose to go offline");
      return;
    }
    try {
      await setPartnerAvailability(partner.id, "online");
    } catch (error) {
      console.error("[delivery-availability] update failed", error);
      toast.error(error instanceof Error ? error.message : "Could not update availability.");
      return;
    }
    if (on) {
      // Every online session starts with a fresh location attempt. This keeps
      // an old location timestamp from carrying over after going offline.
      locationErrorShownRef.current = false;
      lastActivityRef.current = Date.now();
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
  const requestHasVendorCoordinates =
    Number.isFinite(vendor?.latitude) && Number.isFinite(vendor?.longitude);
  const requestFrom: [number, number] | null =
    Number.isFinite(partner.current_latitude) && Number.isFinite(partner.current_longitude)
      ? [partner.current_latitude!, partner.current_longitude!]
      : null;

  return (
    <AppShell
      title="Local Shore Partners"
      nav={NAV}
      right={
        <div className="flex items-center gap-2">
          {zoneInfo?.isOutOfZone && partner.availability === "online" ? (
            <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-xs hidden sm:inline-flex">
              ⚠️ Out of Zone
            </Badge>
          ) : null}
          <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5">
            <span className="text-xs font-medium text-secondary-foreground flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  partner.availability === "online"
                    ? zoneInfo?.isOutOfZone
                      ? "bg-amber-500 animate-pulse"
                      : "bg-emerald-500 animate-pulse"
                    : "bg-muted-foreground"
                }`}
              />
              {partner.availability === "online" ? "Online" : "Offline"}
            </span>
            <Switch
              checked={partner.availability === "online"}
              onCheckedChange={toggleOnline}
              disabled={partner.status !== "approved"}
              aria-label="Toggle online"
            />
          </div>
        </div>
      }
    >
      {zoneInfo?.isOutOfZone && partner.availability === "online" ? (
        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border-2 border-amber-500/80 bg-amber-500/10 p-4 text-amber-950 dark:text-amber-200 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">🚨 Out of Operating Zone ({zoneInfo.zoneName})</p>
              <p className="text-xs opacity-90 mt-0.5">
                You are currently {zoneInfo.distanceKm.toFixed(1)} km outside your assigned delivery zone. Head back to your zone or sync to receive orders.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-600 text-amber-800 dark:text-amber-200 font-semibold hover:bg-amber-500/20"
              onClick={handleSyncZoneToCurrentLocation}
            >
              Sync Zone to My Location
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${zoneInfo.zoneLat},${zoneInfo.zoneLng}`,
                  "_blank",
                )
              }
            >
              <Navigation className="mr-1.5 h-4 w-4" /> Go to Zone
            </Button>
          </div>
        </div>
      ) : null}

      {partner.status !== "approved" && !window.location.pathname.includes("/partner/documents") ? (
        <div className="mx-auto max-w-2xl py-8 px-4 text-center">
          <Card className="border-2 border-amber-500/40 bg-gradient-to-b from-amber-500/10 via-background to-background p-8 shadow-xl rounded-3xl">
            <CardContent className="space-y-6 flex flex-col items-center">
              <div className="grid h-20 w-20 place-items-center rounded-3xl bg-amber-500/20 text-amber-600 dark:text-amber-400 ring-8 ring-amber-500/10">
                <Clock className="h-10 w-10 animate-pulse" />
              </div>
              <div>
                <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-xs px-3 py-1 font-semibold">
                  Status: {PARTNER_STATUS_LABEL[partner.status] ?? partner.status}
                </Badge>
                <h2 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  ⏳ Application Under Review
                </h2>
                <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-lg">
                  Your delivery partner profile and verification documents have been submitted to the LocalShore Admin team.
                </p>
                <div className="mt-5 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-950 dark:text-amber-200 text-sm font-medium leading-relaxed">
                  ⌛ <strong>24-Hour Review Window:</strong> It will take up to 24 hours to review and wait for admin approval. Once approved by the admin, all features (Deliveries, Earnings, Refer & Earn, Vehicle Rentals) will be unlocked automatically.
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm pt-2">
                <Button
                  className="w-full font-semibold shadow-md"
                  onClick={() => navigate({ to: "/partner/documents" })}
                >
                  <FileText className="mr-2 h-4 w-4" /> View / Upload Documents
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Outlet />
      )}
      {lowPowerMode ? (
        <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Low battery: power-saving mode is active. Location refreshes less often until you charge
          your phone.
        </div>
      ) : null}

      <Dialog open={!!request} onOpenChange={(o) => (!o ? closeRequestDialog() : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New delivery request</DialogTitle>
          </DialogHeader>
          {request ? (
            <div className="space-y-4">
              <Progress value={(secondsLeft / 60) * 100} />
              <p className="text-center text-sm text-muted-foreground">{secondsLeft}s to respond</p>
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
              {requestHasVendorCoordinates ? (
                <MapPanel
                  lat={vendor.latitude}
                  lng={vendor.longitude}
                  label={vendor.shop_name}
                  height={160}
                  from={requestFrom}
                />
              ) : vendor?.address ? (
                <AddressNavigation
                  address={vendor.address}
                  label={vendor.shop_name ?? "Pickup location"}
                  from={requestFrom}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  Pickup address is still loading. Use the shop contact button after accepting if
                  needed.
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => respond(false)}
                >
                  Reject
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy || secondsLeft === 0}
                  onClick={() => respond(true)}
                >
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
