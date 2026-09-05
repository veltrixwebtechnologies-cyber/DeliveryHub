/**
 * useDriverNavigation – Core navigation hook for delivery partner
 * 
 * Real GPS tracking, OSRM road routing, off-route rerouting,
 * automatic phase transitions, arrival detection, smooth position updates.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { deliveryTracker, type GPSPosition } from "@/services/delivery-location-tracker";
import {
  fetchDeliveryRoute,
  shouldRecalculateRoute,
  distanceToPolylineMeters,
  calculateBearing,
  haversineDistanceMeters,
  findNextStep,
  formatDistanceShort,
  type MapLocation,
  type RouteResult,
  type TurnStep,
} from "@/lib/delivery-routing";

export type NavigationPhase = "to_vendor" | "to_customer";
export type ArrivalZone = "none" | "near_vendor" | "at_vendor" | "near_customer" | "at_customer";

export interface NavigationState {
  /** Current GPS position */
  driverPos: GPSPosition | null;
  /** Smoothed position for map rendering */
  displayPos: { lat: number; lng: number; heading: number } | null;
  /** Current heading (GPS or calculated) */
  heading: number;
  /** Current speed m/s */
  speed: number;
  /** Current phase: heading to vendor or customer */
  phase: NavigationPhase;
  /** Destination coordinates */
  destination: MapLocation | null;
  /** Destination label */
  destinationLabel: string;
  /** Active OSRM route */
  route: RouteResult | null;
  /** Whether the route is being recalculated */
  isRerouting: boolean;
  /** Off-route status */
  isOffRoute: boolean;
  /** Distance to destination in meters */
  distanceToDestM: number;
  /** ETA to destination in seconds */
  etaSeconds: number;
  /** Next navigation instruction */
  nextStep: TurnStep | null;
  /** Distance to next maneuver in meters */
  distanceToNextStep: number;
  /** Arrival zone detection */
  arrivalZone: ArrivalZone;
  /** GPS accuracy in meters */
  accuracy: number | null;
  /** Is GPS tracking active */
  isTracking: boolean;
  /** Is GPS signal stale (>30s old) */
  isStale: boolean;
  /** Last GPS update timestamp */
  lastUpdateAt: number;
  /** Error state */
  error: string | null;
  /** Is follow-driver mode enabled */
  followMode: boolean;
}

interface UseDriverNavigationProps {
  assignmentId: string | null;
  assignmentStatus: string;
  vendorLocation: MapLocation | null;
  vendorLabel: string;
  customerLocation: MapLocation | null;
  customerLabel: string;
  enabled: boolean;
}

const VENDOR_ARRIVAL_RADIUS_M = 50;
const CUSTOMER_ARRIVAL_RADIUS_M = 50;
const NEAR_RADIUS_M = 200;
const GPS_STALE_THRESHOLD_MS = 30_000;
const OFF_ROUTE_THRESHOLD_M = 80;
const MIN_GPS_ACCURACY_M = 100;

// Statuses where driver is heading TO vendor
const TO_VENDOR_STATUSES = ["accepted", "navigating_to_vendor"];
// Statuses where driver is heading TO customer
const TO_CUSTOMER_STATUSES = ["picked_up", "out_for_delivery"];

export function useDriverNavigation({
  assignmentId,
  assignmentStatus,
  vendorLocation,
  vendorLabel,
  customerLocation,
  customerLabel,
  enabled,
}: UseDriverNavigationProps) {
  const [state, setState] = useState<NavigationState>({
    driverPos: null,
    displayPos: null,
    heading: 0,
    speed: 0,
    phase: "to_vendor",
    destination: null,
    destinationLabel: "",
    route: null,
    isRerouting: false,
    isOffRoute: false,
    distanceToDestM: 0,
    etaSeconds: 0,
    nextStep: null,
    distanceToNextStep: 0,
    arrivalZone: "none",
    accuracy: null,
    isTracking: false,
    isStale: false,
    lastUpdateAt: 0,
    error: null,
    followMode: true,
  });

  const watchIdRef = useRef<number | null>(null);
  const lastGpsRef = useRef<GPSPosition | null>(null);
  const prevPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastRouteCalcPosRef = useRef<MapLocation | null>(null);
  const lastRouteCalcTimeRef = useRef<number>(0);
  const prevPhaseRef = useRef<NavigationPhase>("to_vendor");
  const routeRequestInFlightRef = useRef(false);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // ── Determine phase from assignment status ──
  const phase: NavigationPhase = TO_CUSTOMER_STATUSES.includes(assignmentStatus)
    ? "to_customer"
    : "to_vendor";

  // ── Determine destination based on phase ──
  const destination = phase === "to_vendor" ? vendorLocation : customerLocation;
  const destinationLabel = phase === "to_vendor" ? vendorLabel : customerLabel;

  // ── Calculate arrival zone ──
  const calcArrivalZone = useCallback(
    (pos: { lat: number; lng: number }): ArrivalZone => {
      if (vendorLocation && phase === "to_vendor") {
        const dv = haversineDistanceMeters(pos.lat, pos.lng, vendorLocation.lat, vendorLocation.lng);
        if (dv <= VENDOR_ARRIVAL_RADIUS_M) return "at_vendor";
        if (dv <= NEAR_RADIUS_M) return "near_vendor";
      }
      if (customerLocation && phase === "to_customer") {
        const dc = haversineDistanceMeters(pos.lat, pos.lng, customerLocation.lat, customerLocation.lng);
        if (dc <= CUSTOMER_ARRIVAL_RADIUS_M) return "at_customer";
        if (dc <= NEAR_RADIUS_M) return "near_customer";
      }
      return "none";
    },
    [vendorLocation, customerLocation, phase]
  );

  // ── Route calculation (debounced) ──
  const calculateRoute = useCallback(
    async (origin: MapLocation, dest: MapLocation, forPhase: NavigationPhase, force = false) => {
      if (routeRequestInFlightRef.current && !force) return;

      const phaseChanged = prevPhaseRef.current !== forPhase;
      const shouldCalc = force || shouldRecalculateRoute(
        origin,
        lastRouteCalcPosRef.current,
        state.route?.geometry || null,
        lastRouteCalcTimeRef.current,
        phaseChanged
      );

      if (!shouldCalc) return;

      routeRequestInFlightRef.current = true;
      setState((s) => ({ ...s, isRerouting: true }));

      try {
        const result = await fetchDeliveryRoute(origin, dest, forPhase);
        lastRouteCalcPosRef.current = origin;
        lastRouteCalcTimeRef.current = Date.now();
        prevPhaseRef.current = forPhase;

        setState((s) => ({
          ...s,
          route: result,
          isRerouting: false,
          isOffRoute: false,
          distanceToDestM: result.distanceMeters,
          etaSeconds: result.durationSeconds,
          error: null,
        }));
      } catch (err) {
        console.error("[Navigation] Route calculation failed", err);
        setState((s) => ({ ...s, isRerouting: false, error: "Unable to calculate route" }));
      } finally {
        routeRequestInFlightRef.current = false;
      }
    },
    [state.route?.geometry]
  );

  // ── GPS position handler ──
  const handleGPSUpdate = useCallback(
    (position: GeolocationPosition) => {
      const { latitude, longitude, heading, speed, accuracy } = position.coords;
      const now = Date.now();

      // Validate GPS reading
      if (
        !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180
      ) {
        return;
      }

      // Reject readings with very poor accuracy
      if (accuracy !== null && accuracy > MIN_GPS_ACCURACY_M) {
        return;
      }

      // Reject impossible jumps (> 500m in < 2 seconds)
      if (lastGpsRef.current) {
        const timeDelta = (now - lastGpsRef.current.timestamp) / 1000;
        if (timeDelta > 0 && timeDelta < 2) {
          const jumped = haversineDistanceMeters(
            lastGpsRef.current.latitude, lastGpsRef.current.longitude,
            latitude, longitude
          );
          if (jumped > 500) return; // Impossible jump
        }
      }

      const gps: GPSPosition = {
        latitude, longitude,
        heading: heading ?? null,
        speed: speed ?? null,
        accuracy: accuracy ?? null,
        timestamp: now,
      };

      // Calculate heading from movement if GPS heading unavailable
      let effectiveHeading = heading ?? 0;
      if ((heading === null || heading === 0) && prevPosRef.current) {
        const moved = haversineDistanceMeters(prevPosRef.current.lat, prevPosRef.current.lng, latitude, longitude);
        if (moved > 3) {
          effectiveHeading = calculateBearing(prevPosRef.current.lat, prevPosRef.current.lng, latitude, longitude);
        } else {
          effectiveHeading = lastGpsRef.current?.heading ?? 0;
        }
      }

      lastGpsRef.current = gps;
      prevPosRef.current = { lat: latitude, lng: longitude };

      const currentLoc: MapLocation = { lat: latitude, lng: longitude };
      const arrivalZone = calcArrivalZone(currentLoc);

      // Off-route detection
      let isOffRoute = false;
      if (state.route?.geometry && state.route.geometry.length > 0) {
        const distFromRoute = distanceToPolylineMeters(currentLoc, state.route.geometry);
        isOffRoute = distFromRoute > OFF_ROUTE_THRESHOLD_M;
      }

      // Find next navigation step
      let nextStep: TurnStep | null = null;
      let distToStep = 0;
      if (state.route?.steps && state.route.geometry) {
        const found = findNextStep(currentLoc, state.route.steps, state.route.geometry);
        if (found) {
          nextStep = found.step;
          distToStep = found.distanceToStep;
        }
      }

      // Calculate distance to destination
      let distToDest = state.distanceToDestM;
      if (destination) {
        distToDest = haversineDistanceMeters(latitude, longitude, destination.lat, destination.lng);
      }

      setState((s) => ({
        ...s,
        driverPos: gps,
        displayPos: { lat: latitude, lng: longitude, heading: effectiveHeading },
        heading: effectiveHeading,
        speed: speed ?? 0,
        phase,
        destination,
        destinationLabel,
        accuracy: accuracy ?? null,
        isTracking: true,
        isStale: false,
        lastUpdateAt: now,
        arrivalZone,
        isOffRoute,
        nextStep,
        distanceToNextStep: distToStep,
        distanceToDestM: distToDest,
      }));

      // Trigger route recalculation if off-route or conditions met
      if (destination && (isOffRoute || !state.route)) {
        void calculateRoute(currentLoc, destination, phase, isOffRoute);
      } else if (destination) {
        void calculateRoute(currentLoc, destination, phase, false);
      }
    },
    [destination, destinationLabel, phase, calcArrivalZone, calculateRoute, state.route, state.distanceToDestM]
  );

  // ── Start/stop GPS tracking ──
  useEffect(() => {
    if (!enabled || !assignmentId) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setState((s) => ({ ...s, isTracking: false }));
      return;
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState((s) => ({ ...s, error: "Geolocation not available" }));
      return;
    }

    // Start the GPS watch with fallback for desktop browsers
    const startWatch = (highAccuracy: boolean) => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleGPSUpdate,
        (err) => {
          console.warn("[Navigation] GPS error (highAccuracy=" + highAccuracy + "):", err.message);
          if (highAccuracy && err.code === 3) {
            // Timeout on high accuracy (common on desktops); retry with standard accuracy
            startWatch(false);
            return;
          }
          setState((s) => ({
            ...s,
            error: err.code === 1 ? "Location permission denied" : `GPS: ${err.message}`,
          }));
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 10000 : 20000,
          maximumAge: 5000,
        }
      );
    };

    startWatch(true);

    // Also ensure the delivery tracker is running for server sync
    deliveryTracker.startTracking(assignmentId);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, assignmentId, handleGPSUpdate]);

  // ── Phase change: force route recalculation ──
  useEffect(() => {
    if (prevPhaseRef.current !== phase && destination) {
      const origin: MapLocation = lastGpsRef.current
        ? { lat: lastGpsRef.current.latitude, lng: lastGpsRef.current.longitude }
        : phase === "to_customer" && vendorLocation
        ? vendorLocation
        : { lat: 11.0168, lng: 76.9558 };
      void calculateRoute(origin, destination, phase, true);
    }
  }, [phase, destination, vendorLocation, calculateRoute]);

  // ── Initial route calculation when destination becomes available ──
  useEffect(() => {
    if (destination && !state.route) {
      const origin: MapLocation = lastGpsRef.current
        ? { lat: lastGpsRef.current.latitude, lng: lastGpsRef.current.longitude }
        : phase === "to_customer" && vendorLocation
        ? vendorLocation
        : { lat: 11.0168, lng: 76.9558 };
      void calculateRoute(origin, destination, phase, true);
    }
  }, [destination, state.route, phase, vendorLocation, calculateRoute]);

  // ── Stale GPS detection timer ──
  useEffect(() => {
    if (staleTimerRef.current) clearInterval(staleTimerRef.current);
    staleTimerRef.current = setInterval(() => {
      if (state.lastUpdateAt > 0) {
        const elapsed = Date.now() - state.lastUpdateAt;
        setState((s) => ({ ...s, isStale: elapsed > GPS_STALE_THRESHOLD_MS }));
      }
    }, 5000);
    return () => {
      if (staleTimerRef.current) clearInterval(staleTimerRef.current);
    };
  }, [state.lastUpdateAt]);

  // ── Follow mode toggle ──
  const toggleFollowMode = useCallback(() => {
    setState((s) => ({ ...s, followMode: !s.followMode }));
  }, []);

  const enableFollowMode = useCallback(() => {
    setState((s) => ({ ...s, followMode: true }));
  }, []);

  const disableFollowMode = useCallback(() => {
    setState((s) => ({ ...s, followMode: false }));
  }, []);

  // ── Force route refresh ──
  const forceRefreshRoute = useCallback(() => {
    if (destination && lastGpsRef.current) {
      const origin: MapLocation = {
        lat: lastGpsRef.current.latitude,
        lng: lastGpsRef.current.longitude,
      };
      void calculateRoute(origin, destination, phase, true);
    }
  }, [destination, phase, calculateRoute]);

  return {
    ...state,
    phase,
    destination,
    destinationLabel,
    toggleFollowMode,
    enableFollowMode,
    disableFollowMode,
    forceRefreshRoute,
  };
}
