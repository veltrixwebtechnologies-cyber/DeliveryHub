import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Bike,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Clock3,
  ExternalLink,
  Flame,
  Gift,
  Headphones,
  IndianRupee,
  Info,
  LocateFixed,
  Lock,
  MapPin,
  Navigation,
  Package,
  Percent,
  Phone,
  Radar,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StatCard } from "@/components/delivery/StatCard";
import { EmptyState } from "@/components/delivery/AppShell";
import { StatusBadge } from "@/components/delivery/StatusBadge";
import { db } from "@/lib/db";
import { usePartner } from "@/hooks/usePartner";
import { ACTIVE_ASSIGNMENT_STATUSES, googleMapsDirections, INR, pct } from "@/lib/delivery";
import { DELIVERY_ORDER_SELECT, normalizeAssignment } from "@/lib/shared-orders";
import { SafetyActions } from "@/components/delivery/SafetyActions";
import { MapPanel } from "@/components/delivery/MapPanel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/partner/")({
  component: PartnerDashboard,
  head: () => ({ meta: [{ title: "Home | Local Shore Delivery Partner" }] }),
});

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function isValidCoordinate(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function LiveLocationCard({
  partner,
}: {
  partner: NonNullable<ReturnType<typeof usePartner>["partner"]>;
}) {
  const savedLocation = {
    lat: Number(partner.current_latitude),
    lng: Number(partner.current_longitude),
  };
  const [location, setLocation] = useState(
    isValidCoordinate(savedLocation.lat, savedLocation.lng) ? savedLocation : null,
  );
  const [status, setStatus] = useState("Waiting for GPS location…");
  const [requesting, setRequesting] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [addressName, setAddressName] = useState<string | null>(null);

  const applyLiveLocation = (next: { lat: number; lng: number }) => {
    if (!isValidCoordinate(next.lat, next.lng)) return;
    setLocation(next);
    setUpdatedAt(Date.now());
    setStatus("Live location updating");

    void supabase
      .from("delivery_partners")
      .update({
        current_latitude: next.lat,
        current_longitude: next.lng,
        updated_at: new Date().toISOString(),
      })
      .eq("id", partner.id);
  };

  useEffect(() => {
    if (!location) return;
    let active = true;
    const fetchAddress = async () => {
      try {
        const { loadGoogleMaps } = await import("@/lib/google-maps-loader");
        const googleApi = await loadGoogleMaps();
        const data = await new googleApi.maps.Geocoder().geocode({ location });
        if (active && data.results[0]?.formatted_address) {
          const parts = data.results[0].formatted_address.split(",");
          const shortName = parts.slice(0, 3).join(", ");
          setAddressName(shortName);
        }
      } catch {
        // ignore geocoding failures
      }
    };
    void fetchAddress();
    return () => {
      active = false;
    };
  }, [location?.lat, location?.lng]);

  const requestFreshLocation = () => {
    const isLocalhost =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!window.isSecureContext && !isLocalhost) {
      setStatus("Location requires HTTPS or localhost");
      return;
    }
    if (!navigator.geolocation) {
      setStatus("This browser does not provide GPS location");
      return;
    }
    setRequesting(true);
    setStatus("Requesting your current location…");
    const onPosition = (position: GeolocationPosition) => {
      applyLiveLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      setRequesting(false);
    };
    const onError = (error: GeolocationPositionError) => {
      navigator.geolocation.getCurrentPosition(
        onPosition,
        (finalErr) => {
          setRequesting(false);
          setStatus(
            finalErr.code === finalErr.PERMISSION_DENIED
              ? "Permission denied — allow Location access in browser site settings"
              : finalErr.code === finalErr.POSITION_UNAVAILABLE
                ? "Position unavailable — enable device Location/GPS"
                : finalErr.code === finalErr.TIMEOUT
                  ? "Location timed out — please try again"
                  : `Location failed (error ${finalErr.code})`,
          );
        },
        { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
      );
    };
    navigator.geolocation.getCurrentPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 30_000,
      timeout: 6_000,
    });
  };

  useEffect(() => {
    if (isValidCoordinate(savedLocation.lat, savedLocation.lng)) {
      setLocation(savedLocation);
      setStatus(
        partner.availability === "online"
          ? "Live tracking active"
          : "Showing your last known location",
      );
    }

    if (partner.availability === "offline" || !("geolocation" in navigator)) return;

    const onPosition = (position: GeolocationPosition) => {
      const next = { lat: position.coords.latitude, lng: position.coords.longitude };
      if (isValidCoordinate(next.lat, next.lng)) {
        applyLiveLocation(next);
      }
    };
    const onError = (error: GeolocationPositionError) => {
      setStatus(
        error.code === error.PERMISSION_DENIED
          ? "Permission denied — allow Location in the address bar"
          : error.code === error.POSITION_UNAVAILABLE
            ? "Position unavailable — showing your last known location"
            : "GPS timed out — showing your last known location",
      );
    };

    navigator.geolocation.getCurrentPosition(onPosition, onError, {
      enableHighAccuracy: false,
      maximumAge: 30_000,
      timeout: 15_000,
    });
    const watchId = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: false,
      maximumAge: 30_000,
      timeout: 30_000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [partner.id, partner.availability]);

  useEffect(() => {
    const onParentLocation = (event: Event) => {
      const detail = (event as CustomEvent<{ lat?: number; lng?: number }>).detail;
      const nextLat = Number(detail?.lat);
      const nextLng = Number(detail?.lng);
      if (isValidCoordinate(nextLat, nextLng)) {
        applyLiveLocation({ lat: nextLat, lng: nextLng });
      }
    };
    window.addEventListener("partner-location-update", onParentLocation);
    return () => window.removeEventListener("partner-location-update", onParentLocation);
  }, []);

  return (
    <Card className="overflow-hidden rounded-3xl border-border/80 shadow-soft">
      <CardHeader className="flex-row items-start justify-between space-y-0 border-b border-white/20 dark:border-white/10 glass-inner">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <LocateFixed className="h-4 w-4 text-primary" />
            Live Rider Position
          </CardTitle>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">{status}</p>
            {location && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <MapPin className="h-3 w-3" />
                {location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={requestFreshLocation}
            disabled={requesting}
          >
            <LocateFixed className={`mr-1 h-3.5 w-3.5 ${requesting ? "animate-spin" : ""}`} />
            {requesting ? "Locating…" : "Fix GPS"}
          </Button>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {partner.availability === "online" ? "Live" : "Offline"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {location ? (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground font-bold">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {addressName || "Acquired Location"}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                ● Live GPS Active
              </span>
            </div>

            <MapPanel
              lat={location.lat}
              lng={location.lng}
              label={addressName || "Your current location"}
              height={260}
              markerType="rider"
            />
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span className="font-mono text-foreground/80">
                Coordinates: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </span>
              <span>
                {updatedAt
                  ? `Device location received at ${new Date(updatedAt).toLocaleTimeString()}`
                  : "Last saved location — click Fix GPS for fresh position"}
              </span>
            </div>
          </>
        ) : (
          <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
            Allow location access while online to see your live position here.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KawasakiNinjaTopView({ className = "w-12 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Kawasaki Ninja 1000R"
    >
      <defs>
        <filter id="ninja-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.45" />
        </filter>
        <linearGradient id="ninja-green" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00FF66" />
          <stop offset="50%" stopColor="#00C853" />
          <stop offset="100%" stopColor="#009624" />
        </linearGradient>
        <linearGradient id="carbon" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#27272A" />
          <stop offset="100%" stopColor="#09090B" />
        </linearGradient>
      </defs>

      <g filter="url(#ninja-shadow)">
        {/* Front Wheel / Tire (Facing right) */}
        <rect x="85" y="18.5" width="13" height="7" rx="3.5" fill="#18181B" stroke="#09090B" strokeWidth="1" />
        <rect x="87" y="20" width="9" height="4" rx="2" fill="#27272A" />

        {/* Front Fender (Lime Green) */}
        <path d="M81 16 Q88 22 81 28 L86 22 Z" fill="url(#ninja-green)" />

        {/* Rear Wheel / Tire */}
        <rect x="3" y="17" width="16" height="10" rx="4" fill="#18181B" stroke="#09090B" strokeWidth="1" />
        <rect x="5" y="19" width="12" height="6" rx="3" fill="#27272A" />

        {/* Swingarm & Chain Drive */}
        <rect x="18" y="19" width="15" height="6" rx="2" fill="#3F3F46" />

        {/* Dual Exhaust / Muffler (Titanium Carbon) */}
        <path d="M22 27 L39 29 L42 27 L39 25 Z" fill="#71717A" stroke="#18181B" strokeWidth="0.8" />
        <ellipse cx="40" cy="27" rx="2" ry="1.4" fill="#18181B" />

        {/* Main Aerodynamic Fairing & Bellypan */}
        <path
          d="M20 22 L29 15 L52 12 L75 15 L87 22 L75 29 L52 32 L29 29 Z"
          fill="url(#carbon)"
          stroke="#18181B"
          strokeWidth="1.2"
        />

        {/* Kawasaki Ninja Lime Green Side Fairings */}
        <path d="M50 12 L73 15 L84 21 L73 21 L57 15 Z" fill="url(#ninja-green)" />
        <path d="M50 32 L73 29 L84 23 L73 23 L57 29 Z" fill="url(#ninja-green)" />

        {/* White / Black Racing Graphics */}
        <polygon points="56,14 70,17 64,19" fill="#FFFFFF" opacity="0.95" />
        <polygon points="56,30 70,27 64,25" fill="#FFFFFF" opacity="0.95" />

        {/* Sculpted Fuel Tank (Lime Green) */}
        <path
          d="M43 16 C43 16 55 14 65 17 C68 22 68 22 65 27 C55 30 43 28 43 28 Z"
          fill="url(#ninja-green)"
          stroke="#009624"
          strokeWidth="0.8"
        />
        {/* Rubber Tank Pad (Black Center Spine) */}
        <rect x="46" y="20" width="17" height="4" rx="1.5" fill="#18181B" />
        <circle cx="58" cy="22" r="1.8" fill="#E4E4E7" stroke="#18181B" strokeWidth="0.6" />

        {/* Sport Clip-On Handlebars */}
        <rect x="71" y="6" width="3.5" height="32" rx="1.75" fill="#3F3F46" />
        {/* Black Grips */}
        <rect x="70" y="4" width="5.5" height="5" rx="1.5" fill="#18181B" />
        <rect x="70" y="35" width="5.5" height="5" rx="1.5" fill="#18181B" />
        {/* Levers */}
        <path d="M74 6 L80 10" stroke="#E4E4E7" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M74 38 L80 34" stroke="#E4E4E7" strokeWidth="1.2" strokeLinecap="round" />
        {/* Aerodynamic Mirrors */}
        <polygon points="76,8 84,4 82,8" fill="#18181B" />
        <polygon points="76,36 84,40 82,36" fill="#18181B" />

        {/* Dark Smoked Windshield */}
        <path d="M74 18 L85 19 L88 22 L85 25 L74 26 Z" fill="#09090B" opacity="0.9" stroke="#00FF66" strokeWidth="0.7" />
        <path d="M76 20 L83 21 L82 22 Z" fill="#FFFFFF" opacity="0.5" />

        {/* Rider Seat (Black Ergonomic Saddle) */}
        <path d="M30 18 C36 17 43 17 43 18 L43 26 C43 27 36 27 30 26 Z" fill="#27272A" stroke="#18181B" strokeWidth="0.8" />
        <line x1="36" y1="18" x2="36" y2="26" stroke="#3F3F46" strokeWidth="0.6" />

        {/* Sharp Pillion Cowl / Aerodynamic Ninja Tail */}
        <path d="M16 20 L30 17 L30 27 L16 24 Z" fill="url(#ninja-green)" stroke="#009624" strokeWidth="0.8" />
        {/* Red LED Taillight */}
        <polygon points="14,21 17,22 14,23" fill="#EF4444" />
      </g>
    </svg>
  );
}

function PartnerDashboard() {
  const { partner, refetch } = usePartner();
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState({ earnings: 0, deliveries: 0 });
  const [week, setWeek] = useState(0);
  const [active, setActive] = useState<any[]>([]);
  const [performance, setPerformance] = useState({
    total: 0,
    requests: 0,
    accepted: 0,
    cancelled: 0,
    late: 0,
    distanceKm: 0,
    workingMinutes: 0,
  });

  // Interactive Modals
  const [activeDialog, setActiveDialog] = useState<
    null | "incentive_details" | "offers" | "zone" | "insurance" | "sos" | "support" | "hero_tier"
  >(null);

  // Online / Offline Toggle
  const handleToggleOnline = async (checked: boolean) => {
    if (!partner?.id) return;
    const nextAvailability = checked ? "online" : "offline";
    try {
      const { error } = await supabase
        .from("delivery_partners")
        .update({
          availability: nextAvailability,
          updated_at: new Date().toISOString(),
        })
        .eq("id", partner.id);
      if (error) throw error;
      toast.success(
        checked
          ? "You are now ONLINE! Ready for delivery requests 🚀"
          : "You are now OFFLINE. Rest up!",
      );
      void refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to update availability status");
    }
  };

  useEffect(() => {
    if (!partner) return;
    let loadCancelled = false;

    const load = async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [{ data: todays }, { data: weeks }, { data: act }, { data: assignmentStats }] =
        await Promise.all([
          db
            .from("delivery_earnings")
            .select("amount")
            .eq("partner_id", partner.id)
            .gte("created_at", todayStart()),
          db
            .from("delivery_earnings")
            .select("amount")
            .eq("partner_id", partner.id)
            .gte("created_at", weekAgo),
          db
            .from("delivery_assignments")
            .select(`*, orders(${DELIVERY_ORDER_SELECT})`)
            .eq("partner_id", partner.id)
            .in("status", ACTIVE_ASSIGNMENT_STATUSES),
          db
            .from("delivery_assignments")
            .select("status,distance_km,accepted_at,delivered_at,created_at")
            .eq("partner_id", partner.id),
        ]);
      const rows = assignmentStats ?? [];
      const completed = rows.filter((row: any) => row.status === "delivered");
      const accepted = rows.filter(
        (row: any) => !["pending", "requested", "rejected", "expired"].includes(row.status),
      );
      const cancelledRows = rows.filter((row: any) => row.status === "cancelled");
      const todayMs = new Date(todayStart()).getTime();
      const completedToday = completed.filter(
        (row: any) => new Date(row.delivered_at ?? row.created_at).getTime() >= todayMs,
      );
      const deliveriesCount = Math.max((todays ?? []).length, completedToday.length);
      if (loadCancelled) return;
      setToday({ earnings: sum(todays), deliveries: deliveriesCount });
      setWeek(sum(weeks));
      setActive((act ?? []).map(normalizeAssignment));
      const workingMinutes = completedToday.reduce((total: number, row: any) => {
        const start = new Date(row.accepted_at ?? row.created_at).getTime();
        const end = new Date(row.delivered_at ?? row.created_at).getTime();
        return total + Math.max(0, Math.round((end - start) / 60000));
      }, 0);
      setPerformance({
        total: completed.length,
        requests: rows.length,
        accepted: accepted.length,
        cancelled: cancelledRows.length,
        late: Math.min(Number(partner.late_deliveries ?? 0), completed.length),
        distanceKm: completedToday.reduce(
          (total: number, row: any) => total + Number(row.distance_km ?? 0),
          0,
        ),
        workingMinutes,
      });
      setLoading(false);
    };

    void load();
    const refresh = window.setInterval(() => void load(), 5000);

    const ch = supabase
      .channel(`partner-dashboard-${partner.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_assignments",
          filter: `partner_id=eq.${partner.id}`,
        },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_earnings",
          filter: `partner_id=eq.${partner.id}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      loadCancelled = true;
      window.clearInterval(refresh);
      supabase.removeChannel(ch);
    };
  }, [partner?.id]);

  if (!partner) return null;

  const acceptance = pct(performance.accepted, performance.requests);
  const onTime = pct(performance.total - performance.late, performance.total);
  const completion = pct(performance.total, performance.total + performance.cancelled);
  const isBusy = active.length > 0;
  const isOnline = partner.availability === "online";

  // Performance Milestone Bonus (Matching Reference Image: ₹600, ₹850, ₹1,950, ₹1,200)
  const milestones = [
    { target: 20, bonus: 600, displayTarget: "20", icon: null, label: "Tier 1" },
    { target: 35, bonus: 850, displayTarget: "35", icon: "key", label: "Tier 2" },
    { target: 50, bonus: 1950, displayTarget: "30", icon: "diamond", label: "Tier 3" },
    { target: 70, bonus: 1200, displayTarget: "70", icon: "crown", label: "Tier 4" },
  ];

  const currentTrips = today.deliveries;

  // Node positions along the milestone track (percentages: 20%, 45%, 70%, 92%)
  const getNodePercent = (idx: number) => {
    switch (idx) {
      case 0:
        return 20;
      case 1:
        return 45;
      case 2:
        return 70;
      case 3:
        return 92;
      default:
        return 20;
    }
  };

  const getEagleProgressPercent = (trips: number) => {
    const pStart = 4;
    const p1 = 20;
    const p2 = 45;
    const p3 = 70;
    const p4 = 92;

    if (trips <= 0) return pStart;
    if (trips <= 20) {
      return pStart + (trips / 20) * (p1 - pStart);
    } else if (trips <= 35) {
      return p1 + ((trips - 20) / (35 - 20)) * (p2 - p1);
    } else if (trips <= 50) {
      return p2 + ((trips - 35) / (50 - 35)) * (p3 - p2);
    } else if (trips <= 70) {
      return p3 + ((trips - 50) / (70 - 50)) * (p4 - p3);
    } else {
      return p4;
    }
  };

  const eagleProgressPercent = getEagleProgressPercent(currentTrips);

  // Motivational subtext
  let incentivePrompt = "";
  if (currentTrips < 20) {
    incentivePrompt = `${20 - currentTrips} more trips to unlock Tier 1 (₹600 bonus)!`;
  } else if (currentTrips < 35) {
    incentivePrompt = `Tier 1 unlocked! ${35 - currentTrips} more trips to reach ₹850 key milestone!`;
  } else if (currentTrips < 70) {
    incentivePrompt = `Great momentum! Reach Tier 4 for a ₹1,200 crown bonus!`;
  } else {
    incentivePrompt = `Maximum Milestone Bonus of ₹1,200 Achieved! Fantastic job today!`;
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 pb-12">
      {/* 1. TOP HEADER COMMAND STRIP (Online/Offline Switch, Announcement, Help, SOS, Hero >) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl glass-dock p-3.5 shadow-soft">
        {/* Left: Online / Offline Switch Pill */}
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <div
            className={`flex items-center gap-2.5 rounded-full px-3.5 py-1.5 transition-all shadow-sm ${
              isOnline
                ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                : "bg-secondary/70 border border-white/20 dark:border-white/10 text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5 text-xs font-bold tracking-tight">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isOnline ? "bg-emerald-500 animate-pulse shadow-glow" : "bg-muted-foreground/60"
                }`}
              />
              {isOnline ? "ONLINE" : "OFFLINE"}
            </span>
            <Switch
              checked={isOnline}
              onCheckedChange={handleToggleOnline}
              disabled={partner.status !== "approved"}
              aria-label="Toggle Online Status"
              className="scale-90 data-[state=checked]:bg-emerald-600"
            />
          </div>

          {/* Quick status on desktop */}
          <span className="hidden md:inline-flex text-xs text-muted-foreground">
            {isBusy
              ? "Busy on active order"
              : isOnline
                ? "Ready for nearby shop requests"
                : "Offline · Go online to receive orders"}
          </span>
        </div>

        {/* Center: Announcement Strip on Desktop */}
        <button
          type="button"
          onClick={() => setActiveDialog("offers")}
          className="group flex items-center justify-between gap-2 overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-transparent backdrop-blur-md px-3 py-1.5 text-left text-xs font-semibold text-amber-950 dark:text-amber-200 transition-all hover:border-amber-500/70 active:scale-95 shadow-sm"
        >
          <span className="flex items-center gap-1.5 truncate">
            <span>🔥</span>
            <span className="truncate">New offers added for today</span>
          </span>
          <span className="shrink-0 text-amber-600 dark:text-amber-400 font-bold group-hover:translate-x-0.5 transition-transform">
            View &gt;
          </span>
        </button>

        {/* Right Header Badges (HELP, SOS, Hero >) */}
        <div className="flex items-center justify-end gap-1.5">
          {/* HELP Button */}
          <button
            type="button"
            onClick={() => setActiveDialog("support")}
            className="flex items-center gap-1 rounded-full border border-white/30 dark:border-white/10 bg-secondary/70 backdrop-blur-md px-3 py-1 text-xs font-semibold text-foreground hover:bg-secondary active:scale-95 transition-transform shadow-sm"
          >
            <Headphones className="h-3.5 w-3.5 text-primary" />
            <span>HELP</span>
          </button>

          {/* SOS Button */}
          <button
            type="button"
            onClick={() => setActiveDialog("sos")}
            className="flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 backdrop-blur-md px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 active:scale-95 transition-transform animate-pulse shadow-sm"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
            <span>SOS</span>
          </button>

          {/* Hero > Tier Pill */}
          <button
            type="button"
            onClick={() => setActiveDialog("hero_tier")}
            className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-md px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-300 hover:border-amber-500/70 active:scale-95 transition-transform shadow-sm"
          >
            <Award className="h-3.5 w-3.5 text-amber-500" />
            <span>Hero &gt;</span>
          </button>
        </div>
      </div>

      {/* 2. RESPONSIVE DASHBOARD GRID (Auto-adjusts: Single Column on Mobile, 2-Column Multi-Grid on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ==================== LEFT / MAIN COLUMN (lg:col-span-7 xl:col-span-8) ==================== */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-5">
          {/* A. PERFORMANCE MILESTONE BONUS TRACKER (MATCHING REFERENCE IMAGE) */}
          <Card className="relative overflow-hidden rounded-3xl border border-white/60 dark:border-white/10 shadow-soft">
            {/* Top-Right Decorative Hexagon Honeycomb Mesh Pattern from reference image */}
            <svg
              className="absolute -top-2 -right-2 h-36 sm:h-44 w-48 sm:w-60 opacity-25 dark:opacity-10 pointer-events-none select-none text-slate-400 dark:text-slate-500"
              viewBox="0 0 220 150"
              fill="none"
            >
              <path
                d="M150 12 L172 25 L172 51 L150 64 L128 51 L128 25 Z
                   M194 37 L216 50 L216 76 L194 89 L172 76 L172 50 Z
                   M150 64 L172 77 L172 103 L150 116 L128 103 L128 77 Z
                   M106 37 L128 50 L128 76 L106 89 L84 76 L84 50 Z
                   M194 89 L216 102 L216 128 L194 141 L172 128 L172 102 Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>

            <CardContent className="relative z-10 p-5 sm:p-6 space-y-4">
              {/* Header: Performance Milestone Bonus / Reach Tier 4 for a ₹1,200 bonus / ( > ) */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground">
                    Performance Milestone Bonus
                  </h2>
                  <p className="text-xs sm:text-sm font-normal text-muted-foreground mt-0.5">
                    Reach Tier 4 for a ₹1,200 bonus
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDialog("incentive_details")}
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white grid place-items-center transition-all hover:scale-105 active:scale-95 shadow-md shadow-blue-600/30 ring-1 ring-white/30"
                  aria-label="View Milestone Details"
                >
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
                </button>
              </div>

              {/* Progress Panel (Sunken glass well with divider and milestone track) */}
              <div className="rounded-2xl glass-inner p-3 sm:p-5 w-full overflow-hidden shadow-inner border border-white/70 dark:border-white/10">
                <div className="w-full flex items-stretch">
                  {/* Left Label Column: Incentive / Divider / Trips Count */}
                  <div className="w-[68px] sm:w-[84px] shrink-0 flex flex-col justify-between py-1 border-r border-slate-300/80 dark:border-slate-700/80 pr-2 sm:pr-3.5 select-none">
                    <span className="text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 leading-none">
                      Incentive
                    </span>
                    <span className="text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 leading-none">
                      Trips Count
                    </span>
                  </div>

                  {/* Right Track & Milestone Grid */}
                  <div className="flex-1 relative pl-1.5 pr-2 sm:pl-4 sm:pr-4">
                    {/* Top Row: Incentive Amounts with Icons (₹600, 🗝️ ₹850, 💎 ₹1,950, 👑 ₹1,200) */}
                    <div className="relative h-6 sm:h-7 flex items-center">
                      {milestones.map((m, idx) => (
                        <div
                          key={`amt-${idx}`}
                          className="w-16 sm:w-20 -translate-x-1/2 flex items-center justify-center gap-1 text-center"
                          style={{
                            position: "absolute",
                            left: `${getNodePercent(idx)}%`,
                          }}
                        >
                          {m.icon === "key" && (
                            <span className="text-xs sm:text-sm select-none" role="img" aria-label="Key">🗝️</span>
                          )}
                          {m.icon === "diamond" && (
                            <span className="text-xs sm:text-sm select-none" role="img" aria-label="Diamond">💎</span>
                          )}
                          {m.icon === "crown" && (
                            <span className="text-xs sm:text-sm select-none" role="img" aria-label="Crown">👑</span>
                          )}
                          <span className="text-xs sm:text-sm font-bold text-foreground tracking-tight">
                            ₹{m.bonus.toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Center Row: Track line + Soaring Eagle + UNLOCKED Ribbon + Metallic Keyhole Lock Dials */}
                    <div className="relative my-3 sm:my-4 h-8 sm:h-9 flex items-center">
                      {/* Background Metallic Track Line Slot */}
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2.5 sm:h-3 bg-gradient-to-b from-slate-300 via-slate-200 to-slate-300 dark:from-slate-700 dark:via-slate-800 dark:to-slate-700 rounded-full border border-slate-400/30 dark:border-slate-600/40 shadow-inner" />

                      {/* Completed Progress Bar Line behind the eagle (Metallic Emerald Glow) */}
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-2.5 sm:h-3 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.45)]"
                        style={{
                          width: `${currentTrips <= 0 ? 0 : Math.max(0, Math.min(100, eagleProgressPercent))}%`,
                        }}
                      />

                      {/* Milestone Nodes (Node 1 = UNLOCKED Badge; Nodes 2, 3, 4 = Metallic Keyhole Lock Badges) */}
                      {milestones.map((m, idx) => {
                        const isUnlocked = currentTrips >= m.target;
                        return (
                          <div
                            key={`node-${idx}`}
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                            style={{ left: `${getNodePercent(idx)}%` }}
                          >
                            {isUnlocked ? (
                              /* Green Checkmark + UNLOCKED Ribbon Banner (Matching Reference Image) */
                              <div className="flex items-center -translate-x-2.5 sm:-translate-x-3">
                                <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-600 text-white grid place-items-center shadow-md ring-2 ring-emerald-400/60 shrink-0 z-10">
                                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[3]" />
                                </div>
                                <div className="relative -ml-1.5 pl-2 sm:pl-2.5 pr-3.5 sm:pr-4 py-0.5 sm:py-1 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-[9px] sm:text-[11px] font-black uppercase tracking-wider shadow-sm [clip-path:polygon(0_0,92%_0,100%_50%,92%_100%,0_100%)] select-none">
                                  UNLOCKED
                                </div>
                              </div>
                            ) : (
                              /* Circular Metallic Dial with Keyhole Slot */
                              <div
                                className={cn(
                                  "relative h-6 w-6 sm:h-7 sm:w-7 rounded-full grid place-items-center shadow-md transition-all duration-300",
                                  idx === 1
                                    ? "border-2 border-amber-300/80 bg-gradient-to-br from-amber-100 via-slate-100 to-amber-200 dark:from-amber-900/60 dark:to-slate-800"
                                    : idx === 2
                                      ? "border-2 border-blue-300/80 bg-gradient-to-br from-blue-50 via-slate-100 to-blue-200 dark:from-blue-900/60 dark:to-slate-800"
                                      : "border-2 border-slate-300/80 bg-gradient-to-br from-slate-100 via-white to-slate-200 dark:from-slate-700 dark:to-slate-900"
                                )}
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-slate-800 dark:fill-slate-200"
                                >
                                  <circle cx="12" cy="8.5" r="3.2" />
                                  <path d="M10.2 11 L13.8 11 L14.5 18 L9.5 18 Z" />
                                </svg>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Top-Angle Soaring Eagle Gliding Directly ON the Progress Track Line */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 transition-all duration-500 pointer-events-none select-none"
                        style={{
                          left: `${currentTrips <= 0 ? 4 : Math.max(4, Math.min(94, eagleProgressPercent))}%`,
                        }}
                      >
                        <img
                          src="/milestone-eagle.png"
                          alt="Soaring Eagle Milestone Marker"
                          className="h-12 sm:h-16 w-auto max-w-none object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)]"
                        />
                      </div>
                    </div>

                    {/* Bottom Row: Trips Count (20, 35, 30, 70) */}
                    <div className="relative h-5 sm:h-6 flex items-center">
                      {milestones.map((m, idx) => (
                        <div
                          key={`cnt-${idx}`}
                          className="w-12 sm:w-16 -translate-x-1/2 text-center"
                          style={{
                            position: "absolute",
                            left: `${getNodePercent(idx)}%`,
                          }}
                        >
                          <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {m.displayTarget}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Trips Count & Motivational Helper */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1 text-xs">
                <p className="font-bold text-sm text-foreground">
                  Your trips count: <span className="text-primary font-black">{currentTrips}</span>
                </p>
                <p className="text-xs font-semibold text-muted-foreground">{incentivePrompt}</p>
              </div>
            </CardContent>
          </Card>

          {/* B. SHORTCUTS 3-GRID (Offers, My Zone, Insurance) */}
          <div className="grid grid-cols-3 gap-3">
            {/* Offers */}
            <button
              type="button"
              onClick={() => setActiveDialog("offers")}
              className="glass-card group flex flex-col items-center justify-center rounded-2xl p-4 text-center transition-all hover:border-amber-500/50 hover:shadow-glow active:scale-95"
            >
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-transform group-hover:scale-110 shadow-sm">
                <Tag className="h-5 w-5" />
              </div>
              <span className="mt-2.5 text-xs sm:text-sm font-bold text-foreground">Offers</span>
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                3 Active
              </span>
            </button>

            {/* My Zone */}
            <button
              type="button"
              onClick={() => setActiveDialog("zone")}
              className="glass-card group flex flex-col items-center justify-center rounded-2xl p-4 text-center transition-all hover:border-emerald-500/50 hover:shadow-glow active:scale-95"
            >
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-transform group-hover:scale-110 shadow-sm">
                <Radar className="h-5 w-5" />
              </div>
              <span className="mt-2.5 text-xs sm:text-sm font-bold text-foreground">My Zone</span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[100px]">
                Central Zone
              </span>
            </button>

            {/* Insurance */}
            <button
              type="button"
              onClick={() => setActiveDialog("insurance")}
              className="glass-card group flex flex-col items-center justify-center rounded-2xl p-4 text-center transition-all hover:border-blue-500/50 hover:shadow-glow active:scale-95"
            >
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 transition-transform group-hover:scale-110 shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="mt-2.5 text-xs sm:text-sm font-bold text-foreground">Insurance</span>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                ₹5L Cover
              </span>
            </button>
          </div>

          {/* C. ACTIVE DELIVERIES / ROUTE TODAY */}
          <Card className="overflow-hidden rounded-3xl border-border/80 shadow-soft">
            <CardHeader className="flex-row items-start justify-between space-y-0 border-b border-white/20 dark:border-white/10 glass-inner">
              <div>
                <CardTitle className="text-sm sm:text-base font-bold">Active Deliveries</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Live orders assigned to your shift
                </p>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link to="/partner/deliveries">
                  My Shifts <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              {active.length === 0 ? (
                <EmptyState
                  title="No active deliveries"
                  description="When you are online, nearby orders from local shops will pop up here with instant navigation."
                  action={
                    <Button asChild size="sm" className="font-semibold">
                      <Link to="/partner/deliveries">Open Deliveries</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {active.map((a) => {
                    const isPickup = ["accepted", "navigating_to_vendor", "reached_vendor"].includes(
                      a.status,
                    );
                    const targetLat = isPickup
                      ? Number(a.orders?.vendors?.latitude)
                      : Number(a.orders?.delivery_latitude);
                    const targetLng = isPickup
                      ? Number(a.orders?.vendors?.longitude)
                      : Number(a.orders?.delivery_longitude);
                    const targetValid = isValidCoordinate(targetLat, targetLng);
                    const navUrl = targetValid
                      ? googleMapsDirections(
                          isValidCoordinate(
                            Number(partner.current_latitude),
                            Number(partner.current_longitude),
                          )
                            ? [Number(partner.current_latitude), Number(partner.current_longitude)]
                            : null,
                          [targetLat, targetLng],
                        )
                      : null;

                    return (
                      <div
                        key={a.id}
                        className="rounded-2xl glass-inner p-4 transition-all hover:border-primary/50 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-foreground">
                              {a.orders?.order_code ?? "Delivery Request"}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {a.orders?.vendors?.shop_name ?? "Local Shore Shop"} to{" "}
                              {a.orders?.customer_name ?? "Customer"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={a.status} />
                            {navUrl && (
                              <Button
                                asChild
                                size="sm"
                                className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shrink-0"
                              >
                                <a
                                  href={navUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Turn-by-Turn GPS Navigation"
                                >
                                  <Navigation className="mr-1 h-3 w-3" />
                                  GPS 🗺️
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-xl glass-card p-2">
                            <span className="text-[10px] text-muted-foreground">Distance</span>
                            <p className="font-bold text-foreground">
                              {Number(a.distance_km ?? 0).toFixed(1)} km
                            </p>
                          </div>
                          <div className="rounded-xl glass-card p-2">
                            <span className="text-[10px] text-muted-foreground">Order Total</span>
                            <p className="font-bold text-foreground">
                              {INR(a.orders?.order_total ?? 0)}
                            </p>
                          </div>
                          <div className="rounded-xl glass-card p-2">
                            <span className="text-[10px] text-muted-foreground">Your Earning</span>
                            <p className="font-bold text-emerald-600 dark:text-emerald-400">
                              {INR(a.estimated_earning ?? 0)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* D. LIVE GPS MAP POSITION CARD */}
          <LiveLocationCard partner={partner} />
        </div>

        {/* ==================== RIGHT / SIDEBAR COLUMN (lg:col-span-5 xl:col-span-4) ==================== */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-5">
          {/* A. TODAY'S & WEEKLY EARNINGS SUMMARY */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Today's Earnings"
              value={INR(today.earnings)}
              hint={`${today.deliveries} trips today`}
              icon={<Wallet className="h-4 w-4 text-emerald-500" />}
              loading={loading}
            />
            <StatCard
              label="Weekly Total"
              value={INR(week)}
              hint="Last 7 days"
              icon={<TrendingUp className="h-4 w-4 text-primary" />}
              loading={loading}
            />
          </div>

          {/* B. IMPORTANT MESSAGES / LIVE UPDATES */}
          <Card className="overflow-hidden rounded-3xl border-border/80 shadow-soft">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Important Updates
                </CardTitle>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Live Feed
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-2 space-y-3">
              {/* Card 1: Higher Daily Incentive */}
              <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent backdrop-blur-md p-3.5 space-y-1 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-950 dark:text-amber-200 flex items-center gap-1">
                    🔥 Higher Daily Incentive Offer 🔥
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">Today</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Earn up to ₹885 extra today during peak dinner hours (7 PM - 11 PM). Complete
                  targets to maximize payouts.
                </p>
              </div>

              {/* Card 2: Monsoon Rain Surge */}
              <div className="rounded-2xl border border-blue-500/35 bg-gradient-to-r from-blue-500/15 via-cyan-500/10 to-transparent backdrop-blur-md p-3.5 space-y-1 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-blue-900 dark:text-blue-200 flex items-center gap-1">
                    🌧️ Monsoon Rain Surge Active (+₹25/order)
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">Active</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Extra ₹25 bonus per completed delivery order in Anna Nagar & T. Nagar zones.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* C. PERFORMANCE PULSE */}
          <Card className="rounded-3xl border-border/80 shadow-soft">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-bold">Performance Pulse</CardTitle>
              <p className="text-xs text-muted-foreground">Your operational quality score</p>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-2 space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Acceptance Rate</span>
                  <span className="text-foreground">{acceptance}%</span>
                </div>
                <Progress className="mt-1.5 h-2" value={acceptance} />
              </div>
              <div>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">On-Time Deliveries</span>
                  <span className="text-foreground">{onTime}%</span>
                </div>
                <Progress className="mt-1.5 h-2" value={onTime} />
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">
                    Working Hours
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-foreground">
                    {Math.floor(performance.workingMinutes / 60)}h{" "}
                    {String(performance.workingMinutes % 60).padStart(2, "0")}m
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">
                    Distance Covered
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-foreground">
                    {performance.distanceKm.toFixed(1)} km
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* D. SAFETY ACTIONS */}
          <SafetyActions emergencyNumber={partner.emergency_contact_number} />
        </div>
      </div>

      {/* ==================== HOME SCREEN MODALS ==================== */}

      {/* 1. Performance Milestone Bonus Details Modal */}
      <Dialog
        open={activeDialog === "incentive_details"}
        onOpenChange={(o) => !o && setActiveDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Performance Milestone Bonus
            </DialogTitle>
            <DialogDescription>
              Complete delivery targets to unlock progressive milestone bonuses up to ₹1,200.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            {milestones.map((m, idx) => {
              const isCompleted = currentTrips >= m.target;
              return (
                <div
                  key={m.target}
                  className={`flex items-center justify-between rounded-2xl p-3.5 transition-all ${
                    isCompleted
                      ? "border border-emerald-500/50 bg-emerald-500/15 backdrop-blur-md font-bold shadow-sm"
                      : "glass-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-xl text-xs font-bold ${
                        isCompleted
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-foreground flex items-center gap-1.5">
                        {m.displayTarget} Completed Deliveries
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-secondary text-muted-foreground font-semibold">
                          {m.label}
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {isCompleted
                          ? "Milestone Completed ✓"
                          : `${Math.max(0, m.target - currentTrips)} trips remaining`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      +₹{m.bonus.toLocaleString("en-IN")}
                    </p>
                    <span className="text-[10px] text-muted-foreground">Bonus payout</span>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. Offers Modal */}
      <Dialog open={activeDialog === "offers"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-amber-500" />
              Active Partner Offers & Surge
            </DialogTitle>
            <DialogDescription>Current promotions and high-demand multipliers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-orange-500/10 backdrop-blur-md p-4 space-y-1 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">🔥 Dinner Peak Mega Bonus</span>
                <Badge className="bg-amber-500 text-white text-[10px]">Active Today</Badge>
              </div>
              <p className="text-muted-foreground">
                Earn up to ₹885 extra between 7:00 PM and 11:00 PM today across Chennai.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-500/40 bg-gradient-to-r from-blue-500/15 to-cyan-500/10 backdrop-blur-md p-4 space-y-1 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">🌧️ Monsoon Rain Surge (+₹25)</span>
                <Badge className="bg-blue-500 text-white text-[10px]">Live</Badge>
              </div>
              <p className="text-muted-foreground">
                Every order completed during rainfall gets an automatic ₹25 weather allowance.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 to-teal-500/10 backdrop-blur-md p-4 space-y-1 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">👥 Refer & Earn ₹500</span>
                <Badge className="bg-emerald-500 text-white text-[10px]">Ongoing</Badge>
              </div>
              <p className="text-muted-foreground">
                Invite friends with your referral code. Earn ₹500 when they complete 20 orders.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. My Zone Modal */}
      <Dialog open={activeDialog === "zone"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-emerald-500" />
              Operating Zone & Geofence
            </DialogTitle>
            <DialogDescription>
              Your assigned high-demand zone for delivery dispatch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 to-teal-500/10 backdrop-blur-md p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-foreground">Chennai Central (Zone 4)</span>
                <span className="rounded-full bg-emerald-500 text-white px-2 py-0.5 text-[10px] font-bold">
                  INSIDE ZONE ✓
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">
                Includes Anna Nagar, T. Nagar, Kilpauk, Chetpet, Nungambakkam & Kodambakkam.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Order Dispatch Priority:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  High (1.2x Boost)
                </span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Average Pickup Distance:</span>
                <span className="font-semibold text-foreground">&lt; 1.5 km</span>
              </div>
            </div>
            <Button
              className="w-full font-semibold shadow-soft"
              onClick={() => {
                toast.success("Operating zone re-synced to your current GPS position!");
                setActiveDialog(null);
              }}
            >
              Re-Sync Zone to My Current GPS
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. Insurance Modal */}
      <Dialog open={activeDialog === "insurance"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-500" />
              Partner Health & Accident Cover
            </DialogTitle>
            <DialogDescription>Complimentary ₹5,00,000 group mediclaim policy.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            <div className="rounded-2xl border border-blue-500/40 bg-gradient-to-r from-blue-500/15 to-cyan-500/10 backdrop-blur-md p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">₹5,00,000 Group Medical Cover</span>
                <span className="rounded-full bg-blue-500 text-white font-bold px-2 py-0.5 text-[10px]">
                  ACTIVE
                </span>
              </div>
              <p className="mt-1 text-muted-foreground font-mono text-[11px]">
                Policy No: LS-GMC-2026-883492
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Accidental Hospitalization:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  100% Cashless
                </span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Claims Helpline:</span>
                <span className="font-bold text-primary">1800-266-7788</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 5. SOS Modal */}
      <Dialog open={activeDialog === "sos"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="h-5 w-5" />
              Emergency SOS Actions
            </DialogTitle>
            <DialogDescription>
              Immediate on-road emergency response and police/ambulance dispatch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            <button
              type="button"
              onClick={() => {
                window.location.href = "tel:112";
              }}
              className="flex w-full items-center justify-between rounded-2xl border-2 border-rose-500 bg-rose-500 text-white p-4 font-bold shadow-lg hover:bg-rose-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Phone className="h-6 w-6" />
                <div className="text-left">
                  <p className="text-sm">Call 112 National Emergency</p>
                  <p className="text-[11px] opacity-90">Police · Ambulance · Fire</p>
                </div>
              </div>
              <span className="text-sm">DIAL 112 &gt;</span>
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = `tel:${partner.emergency_contact_number || "112"}`;
              }}
              className="glass-card flex w-full items-center justify-between rounded-2xl p-4 font-semibold hover:bg-secondary/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-emerald-500" />
                <div className="text-left">
                  <p className="text-xs">Call Saved Emergency Contact</p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {partner.emergency_contact_number || "Not set"}
                  </p>
                </div>
              </div>
              <span className="text-xs text-primary">Call &gt;</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 6. Support Modal */}
      <Dialog open={activeDialog === "support"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-indigo-500" />
              Partner Care Helpline
            </DialogTitle>
            <DialogDescription>
              24x7 immediate phone support for active delivery orders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            <button
              type="button"
              onClick={() => {
                window.location.href = "tel:18002667788";
              }}
              className="flex w-full items-center justify-between rounded-2xl border border-primary/40 bg-primary/10 p-4 font-bold text-primary hover:bg-primary/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Phone className="h-6 w-6 text-primary" />
                <div className="text-left">
                  <p className="text-sm">Call Partner Care (Toll-Free)</p>
                  <p className="text-[11px] text-muted-foreground">1800-266-7788</p>
                </div>
              </div>
              <span className="text-xs">Call Now &gt;</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 7. Hero Tier Perks Modal */}
      <Dialog open={activeDialog === "hero_tier"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              Hero Tier Privileges
            </DialogTitle>
            <DialogDescription>
              Your active top-tier rider benefits on Local Shore.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/20 to-orange-500/10 p-4 text-center">
              <h3 className="text-base font-bold text-foreground">🌟 Hero Partner Status</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rating: {Number(partner.rating ?? 4.98).toFixed(2)} / 5.0
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 rounded-xl border border-border p-2.5">
                <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">High-Value Order Priority</p>
                  <p className="text-muted-foreground">Priority dispatch for big ticket basket sizes</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-border p-2.5">
                <Bike className="h-4 w-4 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">₹2.00/Litre Petrol Cashback</p>
                  <p className="text-muted-foreground">Direct cashback at partner petrol bunks</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
