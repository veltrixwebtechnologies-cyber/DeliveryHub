/**
 * LiveNavigationMap — Full-screen Google Maps navigation map for delivery driver
 *
 * Features:
 * - Real GPS driver position with smooth animation
 * - Road-following Google Maps route polyline
 * - Heading-based marker rotation
 * - Follow-driver mode with re-center button
 * - Vendor/Customer destination markers
 * - Phase awareness (to_vendor / to_customer)
 * - Off-route visual indicator
 * - Arrival zone highlighting
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { MapLocation, RouteResult } from "@/lib/delivery-routing";

import { loadGoogleMaps } from "@/lib/google-maps-loader";

interface LiveNavMapProps {
  driverPos: { lat: number; lng: number; heading: number } | null;
  vendorLocation: MapLocation | null;
  vendorLiveLocation?: MapLocation | null | undefined;
  customerLocation: MapLocation | null;
  destination: MapLocation | null;
  route: RouteResult | null;
  phase: "to_vendor" | "to_customer";
  followMode: boolean;
  isOffRoute: boolean;
  isRerouting: boolean;
  isStale: boolean;
  arrivalZone: string;
  onMapInteraction?: () => void;
  onRecenter?: () => void;
  className?: string;
}

// ── SVG Marker Generators ──────────────────────────────────────────

function driverMarkerSvg(heading: number, color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>
    <defs>
      <filter id='dropshadow' x='-20%' y='-20%' width='140%' height='140%'>
        <feDropShadow dx='0' dy='2' stdDeviation='3' flood-color='rgba(0,0,0,0.35)'/>
      </filter>
    </defs>
    <g filter='url(#dropshadow)' transform='rotate(${heading}, 24, 24)'>
      <circle cx='24' cy='24' r='18' fill='${color}' stroke='#FFFFFF' stroke-width='3'/>
      <polygon points='24,8 20,20 24,18 28,20' fill='#FFFFFF' opacity='0.95'/>
      <circle cx='24' cy='24' r='5' fill='#FFFFFF' opacity='0.9'/>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function destinationPinSvg(color: string, emoji: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='36' height='48' viewBox='0 0 36 48'>
    <defs>
      <filter id='pinshadow' x='-15%' y='-10%' width='130%' height='130%'>
        <feDropShadow dx='0' dy='2' stdDeviation='2' flood-color='rgba(0,0,0,0.3)'/>
      </filter>
    </defs>
    <g filter='url(#pinshadow)'>
      <path d='M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0z' fill='${color}' stroke='#FFFFFF' stroke-width='2'/>
      <text x='18' y='24' text-anchor='middle' font-size='16'>${emoji}</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function isValidLocation(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

const DEFAULT_VISUAL_CENTER: [number, number] = [11.02, 76.99];

// ── Component ──────────────────────────────────────────────────────

export function LiveNavigationMap({
  driverPos,
  vendorLocation,
  vendorLiveLocation,
  customerLocation,
  destination,
  route,
  phase,
  followMode,
  isOffRoute,
  isRerouting,
  isStale,
  arrivalZone,
  onMapInteraction,
  onRecenter,
  className,
}: LiveNavMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Record<string, google.maps.Marker>>({});
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const pulseRef = useRef<google.maps.Circle | null>(null);
  const mountedRef = useRef(true);
  const [isUserPanning, setIsUserPanning] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // ── Initialize Google Map (once) ──
  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    (async () => {
      try {
        const googleApi = await loadGoogleMaps();
        if (cancelled || !containerRef.current) return;

        // Start at destination or a visual-only fallback location.
        const center: [number, number] =
          driverPos && isValidLocation(driverPos.lat, driverPos.lng)
            ? [driverPos.lat, driverPos.lng]
            : destination
              ? [destination.lat, destination.lng]
              : vendorLocation && isValidLocation(vendorLocation.lat, vendorLocation.lng)
                ? [vendorLocation.lat, vendorLocation.lng]
                : customerLocation && isValidLocation(customerLocation.lat, customerLocation.lng)
                  ? [customerLocation.lat, customerLocation.lng]
                  : DEFAULT_VISUAL_CENTER;

        const map = new googleApi.maps.Map(containerRef.current, {
          center: { lat: center[0], lng: center[1] },
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
        });

        // Detect manual panning
        map.addListener("dragstart", () => {
          setIsUserPanning(true);
          onMapInteraction?.();
        });

        mapRef.current = map;
        setMapReady(true);
      } catch (err) {
        console.error("[LiveNavMap] Google Maps init error:", err);
        if (!cancelled) {
          setMapError(err instanceof Error ? err.message : "Google Maps is unavailable right now.");
        }
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (mapRef.current) {
        google.maps.event.clearInstanceListeners(mapRef.current);
        mapRef.current = null;
      }
      Object.values(markersRef.current).forEach((marker) => marker.setMap(null));
      markersRef.current = {};
      pulseRef.current?.setMap(null);
      pulseRef.current = null;
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
    };
  }, []);

  // ── Marker update helper with smooth animation ──
  const upsertMarker = useCallback(
    (
      id: string,
      pos: { lat: number; lng: number } | null,
      iconUrl: string,
      size: [number, number],
      anchor?: [number, number],
    ) => {
      const map = mapRef.current;
      if (!map) return;

      if (!pos) {
        if (markersRef.current[id]) {
          markersRef.current[id].setMap(null);
          delete markersRef.current[id];
        }
        return;
      }

      const [width, height] = size;
      const [anchorX, anchorY] = anchor || [width / 2, height / 2];
      const icon: google.maps.Icon = {
        url: iconUrl,
        scaledSize: new google.maps.Size(width, height),
        anchor: new google.maps.Point(anchorX, anchorY),
      };

      let marker = markersRef.current[id];
      if (!marker) {
        marker = new google.maps.Marker({
          position: pos,
          title:
            id === "driver"
              ? "Delivery partner"
              : id === "vendor"
                ? "Pickup shop"
                : "Delivery location",
          icon,
          map,
          zIndex: id === "driver" ? 1000 : 500,
        });
        markersRef.current[id] = marker;
      } else {
        const existingMarker = marker;
        existingMarker.setIcon(icon);
        // Smooth animation for driver marker
        if (id === "driver") {
          const startLL = existingMarker.getPosition();
          if (!startLL) return;
          const startLat = startLL.lat();
          const startLng = startLL.lng();
          const startTime = performance.now();
          const duration = 500;

          const animate = (now: number) => {
            if (!mountedRef.current || !mapRef.current) return;
            const t = Math.min(1, (now - startTime) / duration);
            const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
            existingMarker.setPosition({
              lat: startLat + (pos.lat - startLat) * ease,
              lng: startLng + (pos.lng - startLng) * ease,
            });
            if (t < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        } else {
          existingMarker.setPosition(pos);
        }
      }
    },
    [],
  );

  // ── Update markers when positions change ──
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    // Driver marker with heading rotation
    if (driverPos && isValidLocation(driverPos.lat, driverPos.lng)) {
      const driverColor = isOffRoute ? "#EF4444" : isStale ? "#F59E0B" : "#10B981";
      upsertMarker("driver", driverPos, driverMarkerSvg(driverPos.heading, driverColor), [48, 48]);

      // GPS accuracy pulse circle
      if (!pulseRef.current) {
        pulseRef.current = new google.maps.Circle({
          map,
          center: driverPos,
          radius: 28,
          strokeOpacity: 0,
          fillColor: driverColor,
          fillOpacity: 0.16,
          clickable: false,
          zIndex: 1,
        });
      } else {
        pulseRef.current.setCenter(driverPos);
        pulseRef.current.setOptions({ fillColor: driverColor });
      }
    }

    // Vendor verified location marker (Permanent shop location)
    if (vendorLocation) {
      const vendorColor = phase === "to_vendor" ? "#8B5CF6" : "#6B7280";
      upsertMarker(
        "vendor",
        vendorLocation,
        destinationPinSvg(vendorColor, "🏪"),
        [36, 48],
        [18, 48],
      );
    }

    // Vendor Live Location marker (Temporary live guidance)
    if (vendorLiveLocation && isValidLocation(vendorLiveLocation.lat, vendorLiveLocation.lng)) {
      upsertMarker(
        "vendor_live",
        vendorLiveLocation,
        destinationPinSvg("#10B981", "📍"),
        [36, 48],
        [18, 48],
      );
    } else {
      upsertMarker("vendor_live", null, "", [0, 0]);
    }

    // Customer marker
    if (customerLocation) {
      const customerColor = phase === "to_customer" ? "#E3A72E" : "#6B7280";
      upsertMarker(
        "customer",
        customerLocation,
        destinationPinSvg(customerColor, "🏠"),
        [36, 48],
        [18, 48],
      );
    }
  }, [
    driverPos,
    vendorLocation,
    vendorLiveLocation,
    customerLocation,
    phase,
    isOffRoute,
    isStale,
    mapReady,
    upsertMarker,
  ]);

  // ── Update route polyline ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Remove old polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (route?.geometry && route.geometry.length > 0) {
      const path = route.geometry.map(([lng, lat]: [number, number]) => ({ lat, lng }));

      const routeColor = phase === "to_vendor" ? "#8B5CF6" : "#3B82E6";
      const routeStyle: google.maps.PolylineOptions =
        route.status === "success"
          ? { strokeColor: routeColor, strokeWeight: 6, strokeOpacity: 0.9 }
          : {
              strokeColor: "#94A3B8",
              strokeWeight: 4,
              strokeOpacity: 0.75,
              icons: [
                {
                  icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 },
                  offset: "0",
                  repeat: "16px",
                },
              ],
            };

      polylineRef.current = new google.maps.Polyline({ path, map, ...routeStyle });

      // Only auto-fit bounds on initial load if not panning
      if (!isUserPanning && route.status === "success") {
        try {
          const bounds = new google.maps.LatLngBounds();
          path.forEach((point) => bounds.extend(point));
          map.fitBounds(bounds, 50);
        } catch {
          // bounds may be invalid
        }
      }
    }
  }, [route, phase, mapReady, isUserPanning]);

  // ── Follow driver mode: center map on driver ──
  useEffect(() => {
    if (!followMode || !driverPos || !mapRef.current || isUserPanning) return;

    const map = mapRef.current;
    const currentZoom = map.getZoom() ?? 16;
    map.panTo(driverPos);
    map.setZoom(Math.max(currentZoom, 16));
  }, [driverPos?.lat, driverPos?.lng, followMode, isUserPanning]);

  // ── Re-center handler ──
  const handleRecenter = useCallback(() => {
    setIsUserPanning(false);
    onRecenter?.();
    if (driverPos && mapRef.current) {
      mapRef.current.panTo(driverPos);
      mapRef.current.setZoom(16);
    }
  }, [driverPos, onRecenter]);

  return (
    <div className={`relative ${className ?? ""}`} style={{ minHeight: "100%" }}>
      <div ref={containerRef} className="absolute inset-0 z-0" />
      {mapError && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-slate-100 p-6 text-center text-sm text-slate-700">
          <div>
            <p className="font-semibold">Google Maps unavailable</p>
            <p className="mt-1">{mapError}</p>
            <p className="mt-2 text-xs">
              Configure VITE_GOOGLE_MAPS_API_KEY for this app and enable Maps JavaScript API.
            </p>
          </div>
        </div>
      )}

      {/* Rerouting overlay */}
      {isRerouting && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[500] rounded-xl bg-slate-900/90 px-5 py-3 text-white shadow-2xl backdrop-blur-md flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span className="text-sm font-medium">Recalculating route…</span>
        </div>
      )}

      {/* Off-route warning banner */}
      {isOffRoute && !isRerouting && (
        <div className="absolute top-3 left-3 right-3 z-[500] rounded-xl bg-red-600/95 px-4 py-2.5 text-white shadow-lg backdrop-blur-sm text-center">
          <p className="text-sm font-semibold">⚠️ You are off route</p>
          <p className="text-xs opacity-80">Rerouting automatically…</p>
        </div>
      )}

      {route?.status && route.status !== "success" && (
        <div className="absolute bottom-16 left-3 z-[500] max-w-[calc(100%-1.5rem)] rounded-lg bg-slate-950/90 px-3 py-2 text-white shadow-lg backdrop-blur-sm">
          <p className="text-xs font-semibold">
            {route.status === "fallback" ? "Road route unavailable." : "Route unavailable."}
          </p>
          <p className="text-[10px] text-slate-300">Showing a preview connection only.</p>
        </div>
      )}

      {/* Stale GPS indicator */}
      {isStale && (
        <div className="absolute top-3 left-3 right-3 z-[500] rounded-xl bg-amber-600/95 px-4 py-2 text-white shadow-lg backdrop-blur-sm text-center">
          <p className="text-xs font-medium">📡 Updating your location…</p>
        </div>
      )}

      {/* Floating Recenter button (GMaps style) */}
      {(isUserPanning || !followMode) && (
        <button
          type="button"
          onClick={handleRecenter}
          className="absolute bottom-4 right-4 z-[500] flex items-center gap-2 rounded-full bg-slate-900/95 text-white px-4 py-2.5 shadow-2xl ring-2 ring-emerald-500/80 hover:bg-slate-800 active:scale-95 transition-all animate-in fade-in zoom-in-95 duration-200"
          aria-label="Re-center map on driver"
        >
          <div className="relative grid h-4 w-4 place-items-center">
            <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Recenter Map
          </span>
        </button>
      )}
    </div>
  );
}
