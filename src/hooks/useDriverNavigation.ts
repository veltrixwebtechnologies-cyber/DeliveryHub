/**
 * useDriverNavigation – Core navigation hook for delivery partner
 *
 * Real GPS tracking, OSRM road routing, off-route rerouting,
 * automatic phase transitions, arrival detection, smooth position updates.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GPS_STALE_THRESHOLD_MS,
  GPS_ACCEPTABLE_ACCURACY_M,
  classifyGpsStatus,
  gpsStatusLabel,
  isValidCoordinate,
  normalizeReading,
  distanceToPolylineMeters,
  calculateBearing,
  haversineDistanceMeters,
} from "@/lib/geo";
import { deliveryTracker, type GPSPosition } from "@/services/delivery-location-tracker";
import {
  fetchDeliveryRoute,
  shouldRecalculateRoute,
  calculateCumulativeDistances,
  findNextStep,
  type MapLocation,
  type RouteResult,
  type TurnStep,
} from "@/lib/delivery-routing";

export type NavigationPhase = "to_vendor" | "to_customer";
export type ArrivalZone = "none" | "near_vendor" | "at_vendor" | "near_customer" | "at_customer";

export interface NavigationState {
  driverPos: GPSPosition | null;
  displayPos: { lat: number; lng: number; heading: number } | null;
  heading: number;
  speed: number;
  phase: NavigationPhase;
  destination: MapLocation | null;
  destinationLabel: string;
  route: RouteResult | null;
  routeStatus: RouteResult["status"] | "idle";
  routeMessage: string | null;
  isRerouting: boolean;
  isOffRoute: boolean;
  distanceToDestM: number | null;
  etaSeconds: number | null;
  nextStep: TurnStep | null;
  distanceToNextStep: number | null;
  arrivalZone: ArrivalZone;
  accuracy: number | null;
  gpsStatus: ReturnType<typeof classifyGpsStatus>;
  gpsMessage: string | null;
  isTracking: boolean;
  isStale: boolean;
  lastUpdateAt: number;
  error: string | null;
  followMode: boolean;
}

interface UseDriverNavigationProps {
  assignmentId: string | null;
  assignmentStatus: string;
  vendorLocation: MapLocation | null;
  vendorLabel: string;
  customerLocation: MapLocation | null;
  customerLabel: string;
  initialDriverLocation?: MapLocation | null;
  enabled: boolean;
}

const VENDOR_ARRIVAL_RADIUS_M = 50;
const CUSTOMER_ARRIVAL_RADIUS_M = 50;
const NEAR_RADIUS_M = 200;
const OFF_ROUTE_THRESHOLD_M = 120;
const MAX_ROUTE_RETRY_DISTANCE_M = 250;

// Statuses where driver is heading TO vendor
const TO_VENDOR_STATUSES = ["accepted", "navigating_to_vendor"];
// Statuses where driver is heading TO customer
const TO_CUSTOMER_STATUSES = ["picked_up", "out_for_delivery"];

function buildGpsMessage(status: ReturnType<typeof classifyGpsStatus>, detail?: string | null) {
  if (detail) return detail;
  return gpsStatusLabel(status);
}

function calculateArrivalZone(
  pos: { lat: number; lng: number },
  phase: NavigationPhase,
  vendorLocation: MapLocation | null,
  customerLocation: MapLocation | null,
): ArrivalZone {
  if (vendorLocation && phase === "to_vendor") {
    const dv = haversineDistanceMeters(pos.lat, pos.lng, vendorLocation.lat, vendorLocation.lng);
    if (dv <= VENDOR_ARRIVAL_RADIUS_M) return "at_vendor";
    if (dv <= NEAR_RADIUS_M) return "near_vendor";
  }
  if (customerLocation && phase === "to_customer") {
    const dc = haversineDistanceMeters(
      pos.lat,
      pos.lng,
      customerLocation.lat,
      customerLocation.lng,
    );
    if (dc <= CUSTOMER_ARRIVAL_RADIUS_M) return "at_customer";
    if (dc <= NEAR_RADIUS_M) return "near_customer";
  }
  return "none";
}

function samePoint(a: MapLocation | null, b: MapLocation | null, thresholdMeters = 50) {
  if (!a || !b) return false;
  return haversineDistanceMeters(a.lat, a.lng, b.lat, b.lng) <= thresholdMeters;
}

export function useDriverNavigation({
  assignmentId,
  assignmentStatus,
  vendorLocation,
  vendorLabel,
  customerLocation,
  customerLabel,
  initialDriverLocation,
  enabled,
}: UseDriverNavigationProps) {
  const phase: NavigationPhase = TO_CUSTOMER_STATUSES.includes(assignmentStatus)
    ? "to_customer"
    : "to_vendor";

  const destination = phase === "to_vendor" ? vendorLocation : customerLocation;
  const destinationLabel = phase === "to_vendor" ? vendorLabel : customerLabel;

  const initialPos = useMemo<GPSPosition | null>(() => {
    if (initialDriverLocation && isValidCoordinate(initialDriverLocation.lat, initialDriverLocation.lng)) {
      return {
        latitude: initialDriverLocation.lat,
        longitude: initialDriverLocation.lng,
        heading: 0,
        speed: 0,
        accuracy: 10,
        timestamp: Date.now(),
      };
    }
    if (destination && isValidCoordinate(destination.lat, destination.lng)) {
      return {
        latitude: destination.lat - 0.008,
        longitude: destination.lng - 0.008,
        heading: 45,
        speed: 0,
        accuracy: 50,
        timestamp: Date.now(),
      };
    }
    return null;
  }, [initialDriverLocation, destination]);

  const [state, setState] = useState<NavigationState>({
    driverPos: initialPos,
    displayPos: initialPos ? { lat: initialPos.latitude, lng: initialPos.longitude, heading: initialPos.heading } : null,
    heading: initialPos?.heading ?? 0,
    speed: 0,
    phase,
    destination,
    destinationLabel,
    route: null,
    routeStatus: "idle",
    routeMessage: null,
    isRerouting: false,
    isOffRoute: false,
    distanceToDestM: null,
    etaSeconds: null,
    nextStep: null,
    distanceToNextStep: null,
    arrivalZone: "none",
    accuracy: initialPos?.accuracy ?? null,
    gpsStatus: initialPos ? "active" : "unavailable",
    gpsMessage: initialPos ? "Location acquired" : "Waiting for GPS location...",
    isTracking: false,
    isStale: false,
    lastUpdateAt: Date.now(),
    error: null,
    followMode: true,
  });

  const watchIdRef = useRef<number | null>(null);
  const lastGpsRef = useRef<GPSPosition | null>(initialPos);
  const prevPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastRouteCalcPosRef = useRef<MapLocation | null>(null);
  const lastRouteCalcTimeRef = useRef<number>(0);
  const prevPhaseRef = useRef<NavigationPhase>(phase);
  const phaseRef = useRef<NavigationPhase>(phase);
  const destinationRef = useRef<MapLocation | null>(destination);
  const vendorLocationRef = useRef<MapLocation | null>(vendorLocation);
  const customerLocationRef = useRef<MapLocation | null>(customerLocation);
  const routeRef = useRef<RouteResult | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const routeRequestIdRef = useRef(0);
  const gpsWatchActiveRef = useRef(false);
  const consecutiveOffRouteRef = useRef(0);
  const handleGPSUpdateRef = useRef<(pos: GeolocationPosition) => void>(() => {});

  useEffect(() => {
    phaseRef.current = phase;
    destinationRef.current = destination;
    vendorLocationRef.current = vendorLocation;
    customerLocationRef.current = customerLocation;
  }, [phase, destination, vendorLocation, customerLocation]);

  const clearRoute = useCallback((message: string | null = null) => {
    routeAbortRef.current?.abort();
    routeAbortRef.current = null;
    routeRef.current = null;
    setState((s) => ({
      ...s,
      route: null,
      routeStatus: message ? "error" : "idle",
      routeMessage: message,
      isRerouting: false,
      isOffRoute: false,
      distanceToDestM: null,
      etaSeconds: null,
      nextStep: null,
      distanceToNextStep: null,
    }));
  }, []);

  const calculateRoute = useCallback(
    async (origin: MapLocation, dest: MapLocation, forPhase: NavigationPhase, force = false) => {
      if (!isValidCoordinate(origin.lat, origin.lng) || !isValidCoordinate(dest.lat, dest.lng)) {
        clearRoute("Destination location unavailable.");
        return;
      }

      const currentRoute = routeRef.current;
      const phaseChanged = prevPhaseRef.current !== forPhase;
      const shouldCalc =
        force ||
        shouldRecalculateRoute(
          origin,
          lastRouteCalcPosRef.current,
          currentRoute?.geometry || null,
          lastRouteCalcTimeRef.current,
          phaseChanged,
        );

      if (!shouldCalc) return;

      routeAbortRef.current?.abort();
      const controller = new AbortController();
      routeAbortRef.current = controller;
      const requestId = ++routeRequestIdRef.current;
      setState((s) => ({ ...s, isRerouting: true }));

      try {
        const result = await fetchDeliveryRoute(origin, dest, forPhase, {
          signal: controller.signal,
        });
        if (controller.signal.aborted || requestId !== routeRequestIdRef.current) return;

        if (phaseRef.current !== forPhase) return;
        if (destinationRef.current && !samePoint(dest, destinationRef.current, 100)) return;

        lastRouteCalcPosRef.current = origin;
        lastRouteCalcTimeRef.current = Date.now();
        prevPhaseRef.current = forPhase;
        routeRef.current = result;

        if (result.status !== "success") {
          setState((s) => ({
            ...s,
            route: result,
            routeStatus: result.status,
            routeMessage:
              result.status === "fallback"
                ? "Road route unavailable."
                : "Route could not be calculated.",
            isRerouting: false,
            isOffRoute: false,
            distanceToDestM: null,
            etaSeconds: null,
            nextStep: null,
            distanceToNextStep: null,
          }));
          return;
        }

        const currentPos = lastGpsRef.current
          ? { lat: lastGpsRef.current.latitude, lng: lastGpsRef.current.longitude }
          : origin;

        const found = findNextStep(currentPos, result.steps, result.geometry);
        setState((s) => ({
          ...s,
          route: result,
          routeStatus: result.status,
          routeMessage: null,
          isRerouting: false,
          isOffRoute: false,
          distanceToDestM: result.distanceMeters,
          etaSeconds: result.durationSeconds,
          nextStep: found?.step ?? null,
          distanceToNextStep: found?.distanceToStep ?? null,
        }));
      } catch (err) {
        if (!controller.signal.aborted) {
          setState((s) => ({ ...s, isRerouting: false }));
        }
      }
    },
    [clearRoute],
  );

  const handleGPSUpdate = useCallback(
    (position: GeolocationPosition) => {
      const reading = normalizeReading(position);
      if (!reading) {
        setState((s) => ({
          ...s,
          gpsStatus: "error",
          gpsMessage: "GPS returned an invalid coordinate.",
          error: "GPS returned an invalid coordinate.",
          isTracking: gpsWatchActiveRef.current,
        }));
        return;
      }

      const now = Date.now();
      const ageMs = now - reading.timestamp;
      const isAcceptableAccuracy =
        reading.accuracy === null || reading.accuracy <= GPS_ACCEPTABLE_ACCURACY_M;
      const gpsStatus = classifyGpsStatus({
        hasFix: true,
        hasError: false,
        isStale: ageMs > GPS_STALE_THRESHOLD_MS,
        isWatching: gpsWatchActiveRef.current,
        accuracy: reading.accuracy,
      });

      if (!isAcceptableAccuracy) {
        setState((s) => ({
          ...s,
          gpsStatus: "inaccurate",
          gpsMessage: `GPS inaccurate${reading.accuracy ? ` (±${Math.round(reading.accuracy)}m)` : ""}`,
          isTracking: true,
          lastUpdateAt: now,
        }));
      }

      if (lastGpsRef.current) {
        const timeDelta = (now - lastGpsRef.current.timestamp) / 1000;
        if (timeDelta > 0 && timeDelta < 2) {
          const jumped = haversineDistanceMeters(
            lastGpsRef.current.latitude,
            lastGpsRef.current.longitude,
            reading.latitude,
            reading.longitude,
          );
          if (jumped > 500) {
            return;
          }
        }
      }

      const gps: GPSPosition = {
        latitude: reading.latitude,
        longitude: reading.longitude,
        heading: reading.heading,
        speed: reading.speed,
        accuracy: reading.accuracy,
        timestamp: reading.timestamp,
      };

      let effectiveHeading = reading.heading ?? 0;
      if ((reading.heading === null || reading.heading === 0) && prevPosRef.current) {
        const moved = haversineDistanceMeters(
          prevPosRef.current.lat,
          prevPosRef.current.lng,
          reading.latitude,
          reading.longitude,
        );
        if (moved > 3) {
          effectiveHeading = calculateBearing(
            prevPosRef.current.lat,
            prevPosRef.current.lng,
            reading.latitude,
            reading.longitude,
          );
        }
      }

      lastGpsRef.current = gps;
      prevPosRef.current = { lat: reading.latitude, lng: reading.longitude };

      const currentLoc: MapLocation = { lat: reading.latitude, lng: reading.longitude };
      const arrivalZone = calculateArrivalZone(currentLoc, phase, vendorLocation, customerLocation);
      const route = routeRef.current;

      let isOffRoute = false;
      let nextStep: TurnStep | null = null;
      let distanceToNextStep: number | null = null;
      let distanceToDestM: number | null = null;
      let etaSeconds: number | null = null;

      if (route?.status === "success" && route.geometry.length > 0) {
        const distFromRoute = distanceToPolylineMeters(currentLoc, route.geometry);
        const rawOffRoute = distFromRoute > OFF_ROUTE_THRESHOLD_M;
        if (rawOffRoute) {
          consecutiveOffRouteRef.current += 1;
        } else {
          consecutiveOffRouteRef.current = 0;
        }
        // Require 2 consecutive off-route readings to trigger off-route state & reroute
        isOffRoute = consecutiveOffRouteRef.current >= 2;

        const found = findNextStep(currentLoc, route.steps, route.geometry);
        nextStep = found?.step ?? null;
        distanceToNextStep = found?.distanceToStep ?? null;

        if (route.distanceMeters !== null) {
          const cumDistances = calculateCumulativeDistances(route.geometry);
          const closestIdx = found?.closestIndex ?? 0;
          const distTraveledM = cumDistances[closestIdx] ?? 0;
          distanceToDestM = Math.max(0, route.distanceMeters - Math.round(distTraveledM));
          if (route.durationSeconds !== null && route.distanceMeters > 0) {
            etaSeconds = Math.max(
              0,
              Math.round((distanceToDestM / route.distanceMeters) * route.durationSeconds),
            );
          } else {
            etaSeconds = route.durationSeconds;
          }
        } else {
          distanceToDestM = null;
          etaSeconds = null;
        }
      }

      setState((s) => ({
        ...s,
        driverPos: gps,
        displayPos: { lat: reading.latitude, lng: reading.longitude, heading: effectiveHeading },
        heading: effectiveHeading,
        speed: reading.speed ?? 0,
        phase,
        destination,
        destinationLabel,
        accuracy: reading.accuracy,
        gpsStatus,
        gpsMessage: buildGpsMessage(
          gpsStatus,
          reading.accuracy && reading.accuracy > GPS_ACCEPTABLE_ACCURACY_M
            ? "GPS inaccurate"
            : null,
        ),
        isTracking: true,
        isStale: false,
        lastUpdateAt: now,
        arrivalZone,
        isOffRoute,
        nextStep,
        distanceToNextStep,
        distanceToDestM,
        etaSeconds,
        error: null,
      }));

      if (destinationRef.current && route?.status === "success") {
        if (isOffRoute || !routeRef.current) {
          void calculateRoute(currentLoc, destinationRef.current, phaseRef.current, isOffRoute);
        } else if (
          shouldRecalculateRoute(
            currentLoc,
            lastRouteCalcPosRef.current,
            route.geometry || null,
            lastRouteCalcTimeRef.current,
            prevPhaseRef.current !== phaseRef.current,
          )
        ) {
          void calculateRoute(currentLoc, destinationRef.current, phaseRef.current, false);
        }
        return;
      }

      if (destinationRef.current && !routeRef.current) {
        void calculateRoute(currentLoc, destinationRef.current, phaseRef.current, false);
      }
    },
    [calculateRoute, destinationLabel, customerLocation, destination, phase, vendorLocation],
  );

  useEffect(() => {
    handleGPSUpdateRef.current = handleGPSUpdate;
  }, [handleGPSUpdate]);

  // Sync the latest derived values into state when the assignment changes.
  useEffect(() => {
    setState((s) => ({
      ...s,
      phase,
      destination,
      destinationLabel,
    }));
  }, [phase, destination, destinationLabel]);

  // ── Start/stop GPS tracking ──
  useEffect(() => {
    if (!enabled || !assignmentId) {
      gpsWatchActiveRef.current = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      routeAbortRef.current?.abort();
      setState((s) => ({
        ...s,
        isTracking: false,
        gpsStatus: "unavailable",
        gpsMessage: "Waiting for GPS location...",
        error: null,
        isStale: false,
      }));
      return;
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState((s) => ({
        ...s,
        gpsStatus: "error",
        gpsMessage: "Geolocation not available",
        error: "Geolocation not available",
      }));
      return;
    }

    gpsWatchActiveRef.current = true;
    setState((s) => ({
      ...s,
      isTracking: true,
      gpsStatus: "acquiring",
      gpsMessage: gpsStatusLabel("acquiring"),
      error: null,
    }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => handleGPSUpdateRef.current(pos),
      (err) => {
        const message =
          err.code === 1
            ? "Location permission denied."
            : err.code === 2
              ? "GPS position unavailable."
              : err.code === 3
                ? "GPS request timed out."
                : err.message || "GPS error.";
        setState((s) => ({
          ...s,
          gpsStatus: "error",
          gpsMessage: message,
          error: message,
          isTracking: true,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 5_000,
      },
    );

    deliveryTracker.startTracking(assignmentId);

    return () => {
      gpsWatchActiveRef.current = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      routeAbortRef.current?.abort();
    };
  }, [enabled, assignmentId]);

  // ── Phase change: force route recalculation once GPS is available ──
  useEffect(() => {
    if (!destination || !lastGpsRef.current) {
      if (destination && !lastGpsRef.current) {
        setState((s) => ({
          ...s,
          routeMessage: "Waiting for GPS location...",
          routeStatus: "idle",
        }));
      }
      return;
    }

    const origin = {
      lat: lastGpsRef.current.latitude,
      lng: lastGpsRef.current.longitude,
    };
    if (prevPhaseRef.current !== phase) {
      void calculateRoute(origin, destination, phase, true);
    }
  }, [calculateRoute, destination, phase]);

  // ── Initial route calculation when destination becomes available ──
  useEffect(() => {
    if (!destination || !lastGpsRef.current) return;
    if (routeRef.current) return;
    void calculateRoute(
      { lat: lastGpsRef.current.latitude, lng: lastGpsRef.current.longitude },
      destination,
      phase,
      true,
    );
  }, [calculateRoute, destination, phase]);

  // ── Stale GPS detection timer ──
  useEffect(() => {
    const timer = window.setInterval(() => {
      setState((s) => {
        if (!s.lastUpdateAt) return s;
        const elapsed = Date.now() - s.lastUpdateAt;
        const isStale = elapsed > GPS_STALE_THRESHOLD_MS;
        const gpsStatus =
          s.gpsStatus === "error" || s.gpsStatus === "unavailable"
            ? s.gpsStatus
            : isStale
              ? "stale"
              : s.gpsStatus;
        const gpsMessage = gpsStatus === "stale" ? "GPS stale" : s.gpsMessage;
        return { ...s, isStale, gpsStatus, gpsMessage };
      });
    }, 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const toggleFollowMode = useCallback(() => {
    setState((s) => ({ ...s, followMode: !s.followMode }));
  }, []);

  const enableFollowMode = useCallback(() => {
    setState((s) => ({ ...s, followMode: true }));
  }, []);

  const disableFollowMode = useCallback(() => {
    setState((s) => ({ ...s, followMode: false }));
  }, []);

  const forceRefreshRoute = useCallback(() => {
    if (destination && lastGpsRef.current) {
      void calculateRoute(
        { lat: lastGpsRef.current.latitude, lng: lastGpsRef.current.longitude },
        destination,
        phase,
        true,
      );
    }
  }, [calculateRoute, destination, phase]);

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
