/**
 * DeliveryNavigationScreen — Full Swiggy/Zomato-style real-time delivery navigation
 * 
 * This is a dedicated mobile-first navigation view for the delivery partner.
 * It replaces the static MapPanel with:
 * - Live GPS tracking on Leaflet + OSM
 * - OSRM road-following route
 * - Turn-by-turn navigation instructions
 * - Auto phase transition (vendor → customer)
 * - Arrival detection
 * - Follow-driver mode
 * - Off-route rerouting
 * - External nav link
 * - Status advance controls
 */

import { useCallback, useMemo } from "react";
import { useDriverNavigation, type ArrivalZone } from "@/hooks/useDriverNavigation";
import { LiveNavigationMap } from "@/components/delivery/LiveNavigationMap";
import { NavigationBar } from "@/components/delivery/NavigationBar";
import { StatusBadge } from "@/components/delivery/StatusBadge";
import { Button } from "@/components/ui/button";
import { DELIVERY_FLOW, nextFlowStep, INR, ASSIGNMENT_STATUS_LABEL } from "@/lib/delivery";
import { ChevronDown, ChevronUp, MapPin, Navigation, X } from "lucide-react";
import { useState } from "react";

interface DeliveryNavigationScreenProps {
  active: any; // normalized delivery assignment
  order: any;
  vendor: any;
  partner: any;
  onAdvance: () => void;
  busy: boolean;
  otp: string;
  setOtp: (val: string) => void;
  photo: File | null;
  setPhoto: (file: File | null) => void;
  onRequestContact: (party: "vendor" | "customer") => void;
}

export function DeliveryNavigationScreen({
  active,
  order,
  vendor,
  partner,
  onAdvance,
  busy,
  otp,
  setOtp,
  photo,
  setPhoto,
  onRequestContact,
}: DeliveryNavigationScreenProps) {
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // ── Parse locations ──
  const vendorLocation = useMemo(() => {
    const lat = Number(vendor?.latitude ?? vendor?.lat);
    const lng = Number(vendor?.longitude ?? vendor?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  }, [vendor]);

  const customerLocation = useMemo(() => {
    const lat = Number(order?.customer_latitude);
    const lng = Number(order?.customer_longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  }, [order]);

  const vendorLabel = vendor?.shop_name || vendor?.business_name || "Shop";
  const customerLabel = order?.customer_name || order?.buyer_name || "Customer";

  // ── Navigation hook ──
  const nav = useDriverNavigation({
    assignmentId: active?.id || null,
    assignmentStatus: active?.status || "",
    vendorLocation,
    vendorLabel: `${vendorLabel} - ${vendor?.address || ""}`,
    customerLocation,
    customerLabel: `${customerLabel} - ${order?.customer_address || order?.buyer_address || ""}`,
    enabled: !!active?.id,
  });

  // ── Status progression ──
  const step = active ? DELIVERY_FLOW.findIndex((s) => s.status === active.status) : -1;
  const next = active ? nextFlowStep(active.status) : null;

  // ── Map interaction handlers ──
  const handleMapInteraction = useCallback(() => {
    nav.disableFollowMode();
  }, [nav]);

  const handleRecenter = useCallback(() => {
    nav.enableFollowMode();
  }, [nav]);

  // ── Arrival-aware CTA logic ──
  const getCtaProps = (): { label: string; enabled: boolean; highlight: boolean } => {
    if (!next) return { label: "Completed", enabled: false, highlight: false };

    if (active.status === "picked_up") {
      return { label: "Start delivery to customer", enabled: true, highlight: true };
    }

    // At vendor: show "Confirm Pickup" prominently
    if (nav.arrivalZone === "at_vendor" && (active.status === "accepted" || active.status === "navigating_to_vendor")) {
      return { label: "I've arrived at the shop", enabled: true, highlight: true };
    }
    if (nav.arrivalZone === "at_vendor" && active.status === "reached_vendor") {
      return { label: "Confirm pickup", enabled: true, highlight: true };
    }

    // At customer: show delivery action
    if (active.status === "out_for_delivery") {
      return { label: "Complete delivery & Enter OTP", enabled: true, highlight: true };
    }

    return {
      label: DELIVERY_FLOW[step]?.action || "Continue",
      enabled: true,
      highlight: false,
    };
  };

  const cta = getCtaProps();

  const handleCtaClick = () => {
    if (next?.status === "delivered") {
      setShowVerificationModal(true);
    } else {
      onAdvance();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] sm:h-[calc(100vh-8rem)] max-h-[850px] w-full bg-background rounded-xl border border-border shadow-xl overflow-hidden relative">
      {/* ── Mini header ── */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 shrink-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <StatusBadge status={active.status} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {order?.order_code || "Delivery"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {INR(active.estimated_earning)} earning
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {nav.route && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
              {nav.route.formattedDuration} · {nav.route.formattedDistance}
            </span>
          )}
        </div>
      </div>

      {/* ── Map area (fills remaining space) ── */}
      <div className="relative flex-1 min-h-0">
        <LiveNavigationMap
          driverPos={nav.displayPos}
          vendorLocation={vendorLocation}
          customerLocation={customerLocation}
          destination={nav.destination}
          route={nav.route}
          phase={nav.phase}
          followMode={nav.followMode}
          isOffRoute={nav.isOffRoute}
          isRerouting={nav.isRerouting}
          isStale={nav.isStale}
          arrivalZone={nav.arrivalZone}
          onMapInteraction={handleMapInteraction}
          onRecenter={handleRecenter}
          className="absolute inset-0"
        />
      </div>

      {/* ── Bottom navigation overlay ── */}
      <div className="shrink-0 bg-background/95 backdrop-blur-lg border-t border-border z-10">
        {/* Navigation instructions */}
        <div className="px-3 pt-3 pb-2">
          <NavigationBar
            route={nav.route}
            phase={nav.phase}
            nextStep={nav.nextStep}
            distanceToNextStep={nav.distanceToNextStep}
            distanceToDestM={nav.distanceToDestM}
            etaSeconds={nav.etaSeconds}
            destinationLabel={nav.destinationLabel}
            destination={nav.destination}
            driverPos={nav.displayPos}
            arrivalZone={nav.arrivalZone}
            isOffRoute={nav.isOffRoute}
            isRerouting={nav.isRerouting}
            isStale={nav.isStale}
            accuracy={nav.accuracy}
            speed={nav.speed}
            followMode={nav.followMode}
            onRecenter={handleRecenter}
            onRefreshRoute={nav.forceRefreshRoute}
          />
        </div>

        {/* Order details collapsible */}
        <button
          type="button"
          onClick={() => setPanelExpanded(!panelExpanded)}
          className="flex w-full items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            {panelExpanded ? "Hide order details" : "Show order details"}
          </span>
          {panelExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>

        {panelExpanded && (
          <div className="border-t border-border px-4 py-3 space-y-3 max-h-44 overflow-y-auto">
            {/* Pickup info */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pickup</p>
              <p className="text-sm font-medium text-foreground">{vendor?.shop_name || vendor?.business_name}</p>
              <p className="text-xs text-muted-foreground">{vendor?.address}</p>
              <button
                type="button"
                className="mt-1 text-xs text-primary font-medium underline"
                onClick={() => onRequestContact("vendor")}
              >
                Call Shop
              </button>
            </div>
            {/* Drop info */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Drop</p>
              <p className="text-sm font-medium text-foreground">{order?.customer_name || order?.buyer_name}</p>
              <p className="text-xs text-muted-foreground">{order?.customer_address || order?.buyer_address}</p>
              <button
                type="button"
                className="mt-1 text-xs text-primary font-medium underline"
                onClick={() => onRequestContact("customer")}
              >
                Call Customer
              </button>
            </div>
            {/* Items */}
            {order?.items?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Items</p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {order.items.map((it: any, i: number) => (
                    <li key={i}>{it.qty ?? 1} × {it.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Action button */}
        {next && (
          <div className="border-t border-border px-3 py-3 bg-card">
            <Button
              type="button"
              className={`w-full h-12 text-base font-semibold shadow-lg transition-all ${
                cta.highlight
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 scale-[1.01]"
                  : ""
              }`}
              disabled={busy || !cta.enabled}
              onClick={handleCtaClick}
            >
              {busy ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Processing…
                </div>
              ) : (
                <>
                  <Navigation className="mr-2 h-4 w-4" />
                  {cta.label}
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* ── Delivery Verification Modal for final step ── */}
      {showVerificationModal && (
        <div className="absolute inset-0 z-[700] flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Delivery Verification</h3>
              <button
                type="button"
                onClick={() => setShowVerificationModal(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ask the customer for the delivery OTP code or upload proof of delivery photo to complete order.
            </p>

            <div className="space-y-2">
              <label htmlFor="modal-otp" className="text-xs font-semibold text-foreground">Customer OTP (4-6 digits)</label>
              <input
                id="modal-otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter OTP (e.g. 1234)"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="w-full h-11 px-3 rounded-lg border border-input bg-background text-lg font-mono tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="relative flex items-center justify-center my-2">
              <span className="bg-card px-2 text-[10px] text-muted-foreground uppercase font-semibold">Or photo proof</span>
              <div className="absolute inset-0 -z-10 flex items-center"><div className="w-full border-t border-border" /></div>
            </div>

            <div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs font-medium text-muted-foreground hover:bg-muted">
                {photo ? photo.name : "Take or upload photo"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowVerificationModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                disabled={busy || (!otp.trim() && !photo)}
                onClick={() => {
                  onAdvance();
                  setShowVerificationModal(false);
                }}
              >
                {busy ? "Completing…" : "Submit & Complete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
