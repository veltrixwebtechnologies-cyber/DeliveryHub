import { watchGPS } from "@/lib/gps-watch";
import { useCallback, useEffect, useRef, useState } from "react";
import { deliveryTracker, type GPSPosition } from "@/services/delivery-location-tracker";
import { usableGPS, MAX_LOCATION_AGE_MS } from "@/lib/coordinates";
import { RouteRequest } from "@/lib/route-request";
import {
  fetchDeliveryRoute,
  routeProgress,
  calculateBearing,
  haversineDistanceMeters,
  findNextStep,
  type RouteResult,
  type MapLocation,
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

function initialState(): NavigationState {
  return {
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
    isStale: true,
    lastUpdateAt: 0,
    error: null,
    followMode: true,
  };
}

export function useDriverNavigation(props: UseDriverNavigationProps) {
  const {
    assignmentId,
    assignmentStatus,
    vendorLocation,
    customerLocation,
    vendorLabel,
    customerLabel,
    enabled,
  } = props;
  const phase: NavigationPhase = ["picked_up", "out_for_delivery", "going_to_customer"].includes(
    assignmentStatus,
  )
    ? "to_customer"
    : "to_vendor";
  const destination = phase === "to_vendor" ? vendorLocation : customerLocation;
  const destinationLabel = phase === "to_vendor" ? vendorLabel : customerLabel;
  const context = [assignmentId, phase, destination?.lat, destination?.lng].join(":");
  const config = useRef({ enabled, destination, phase, context });
  config.current = { enabled, destination, phase, context };
  const [state, setState] = useState(initialState);
  const current = useRef(state);
  const requests = useRef(new RouteRequest());
  const routeContext = useRef("");
  const routeFailure = useRef<string | null>(null);
  const lastAttempt = useRef(0);
  const lastOrigin = useRef<MapLocation | null>(null);
  const patch = useCallback((values: Partial<NavigationState>) => {
    current.current = { ...current.current, ...values };
    setState(current.current);
  }, []);

  const refreshRoute = useCallback(
    (force = false) => {
      const c = config.current;
      const gps = current.current.driverPos;
      if (!c.enabled || !c.destination || !gps || Date.now() - gps.timestamp > MAX_LOCATION_AGE_MS)
        return;
      if (requests.current.busy && !force) return;
      const origin = { lat: gps.latitude, lng: gps.longitude };
      const elapsed = Date.now() - lastAttempt.current;
      const moved = lastOrigin.current
        ? haversineDistanceMeters(
            origin.lat,
            origin.lng,
            lastOrigin.current.lat,
            lastOrigin.current.lng,
          )
        : Infinity;
      const due =
        !current.current.route ||
        current.current.isOffRoute ||
        elapsed > 60000 ||
        (moved > 200 && elapsed > 25000);
      if (!force && (elapsed < 10000 || !due)) return;
      lastAttempt.current = Date.now();
      patch({ isRerouting: true });
      void requests.current.run(
        (signal) => fetchDeliveryRoute(origin, c.destination!, c.phase, 1, signal),
        (result) => {
          if (config.current.context !== c.context) return;
          routeContext.current = c.context;
          routeFailure.current = null;
          lastOrigin.current = origin;
          const latest = current.current.driverPos;
          const location = latest ? { lat: latest.latitude, lng: latest.longitude } : origin;
          const progress = routeProgress(location, result.geometry);
          const ratio = progress.totalMeters ? progress.remainingMeters / progress.totalMeters : 0;
          const next = findNextStep(location, result.steps, result.geometry);
          patch({
            route: result,
            isRerouting: false,
            error: null,
            isOffRoute: progress.offRouteMeters > 80,
            distanceToDestM: result.distanceMeters * ratio,
            etaSeconds: result.durationSeconds * ratio,
            nextStep: next?.step ?? null,
            distanceToNextStep: next?.distanceToStep ?? 0,
          });
        },
        (error) => {
          if (config.current.context !== c.context) return;
          routeFailure.current =
            error instanceof Error ? error.message : "Road routing unavailable. Please retry.";
          patch({
            route: null,
            nextStep: null,
            isRerouting: false,
            error: routeFailure.current,
          });
        },
      );
    },
    [patch],
  );

  // One watch per assignment. Changing route/distance does not recreate it.
  useEffect(() => {
    requests.current.cancel();
    current.current = initialState();
    setState(current.current);
    lastAttempt.current = 0;
    routeContext.current = "";
    routeFailure.current = null;
    lastOrigin.current = null;
    if (!enabled || !assignmentId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      patch({ error: "This browser cannot provide your location." });
      return;
    }
    let alive = true;
    let stopWatch: (() => void) | undefined;
    const receive = (position: GeolocationPosition) => {
      if (!alive) return;
      if (!usableGPS(position)) {
        patch({
          error:
            "Waiting for a fresh, precise location. Enable precise location or move to an open area.",
        });
        return;
      }
      const previous = current.current.driverPos;
      if (previous && position.timestamp <= previous.timestamp) return;
      const { latitude, longitude, accuracy, heading, speed } = position.coords;
      if (previous) {
        const seconds = (position.timestamp - previous.timestamp) / 1000;
        const moved = haversineDistanceMeters(
          previous.latitude,
          previous.longitude,
          latitude,
          longitude,
        );
        if (seconds > 0 && moved > 70 * seconds + accuracy + (previous.accuracy ?? 0)) return;
      }
      const effectiveHeading = Number.isFinite(heading)
        ? heading!
        : previous
          ? calculateBearing(previous.latitude, previous.longitude, latitude, longitude)
          : 0;
      const gps: GPSPosition = {
        latitude,
        longitude,
        accuracy,
        heading: effectiveHeading,
        speed,
        timestamp: position.timestamp,
      };
      const c = config.current;
      const location = { lat: latitude, lng: longitude };
      const route = routeContext.current === c.context ? current.current.route : null;
      const progress = route ? routeProgress(location, route.geometry) : null;
      const next = route ? findNextStep(location, route.steps, route.geometry) : null;
      const ratio = progress?.totalMeters ? progress.remainingMeters / progress.totalMeters : 0;
      let arrivalZone: ArrivalZone = "none";
      if (c.destination) {
        const distance = haversineDistanceMeters(
          latitude,
          longitude,
          c.destination.lat,
          c.destination.lng,
        );
        // Do not announce arrival unless the uncertainty circle is within the zone.
        if (distance + accuracy <= 50)
          arrivalZone = c.phase === "to_vendor" ? "at_vendor" : "at_customer";
        else if (distance <= 200)
          arrivalZone = c.phase === "to_vendor" ? "near_vendor" : "near_customer";
      }
      patch({
        driverPos: gps,
        displayPos: { ...location, heading: effectiveHeading },
        heading: effectiveHeading,
        accuracy,
        speed: Number.isFinite(speed) ? speed! : 0,
        isTracking: true,
        isStale: false,
        lastUpdateAt: position.timestamp,
        arrivalZone,
        error: routeFailure.current,
        isOffRoute: !!progress && progress.offRouteMeters > Math.max(80, accuracy),
        nextStep: next?.step ?? null,
        distanceToNextStep: next?.distanceToStep ?? 0,
        distanceToDestM: route ? route.distanceMeters * ratio : 0,
        etaSeconds: route ? route.durationSeconds * ratio : 0,
      });
      // Send precisely the same accepted fix to the backend; no competing GPS watch.
      void deliveryTracker.submitPosition(position, assignmentId);
      refreshRoute();
    };
    stopWatch = watchGPS(receive, (error) => {
      if (!alive) return;
      patch({
        isTracking: false,
        isStale: true,
        error:
          error.code === 1
            ? "Allow precise location to navigate."
            : "Unable to obtain a precise location. Check GPS or retry outdoors.",
      });
    });
    const timer = window.setInterval(() => {
      if (
        !current.current.lastUpdateAt ||
        Date.now() - current.current.lastUpdateAt > MAX_LOCATION_AGE_MS
      ) {
        patch({ isStale: true, isTracking: false });
      } else refreshRoute();
    }, 5000);
    return () => {
      alive = false;
      stopWatch?.();
      clearInterval(timer);
      requests.current.cancel();
    };
  }, [enabled, assignmentId, patch, refreshRoute]);

  // Changing either endpoint or phase invalidates both the route and all pending responses.
  useEffect(() => {
    requests.current.cancel();
    routeContext.current = "";
    routeFailure.current = null;
    lastAttempt.current = 0;
    patch({
      route: null,
      nextStep: null,
      isRerouting: false,
      isOffRoute: false,
      arrivalZone: "none",
      error: null,
    });
    refreshRoute(true);
  }, [context, patch, refreshRoute]);

  return {
    ...state,
    gpsStatus: !state.driverPos
      ? ("acquiring" as const)
      : state.isStale
        ? ("stale" as const)
        : ("active" as const),
    gpsMessage: !state.driverPos
      ? "Waiting for precise GPS"
      : state.isStale
        ? "GPS stale"
        : `GPS ±${Math.round(state.accuracy ?? 0)}m`,
    phase,
    destination,
    destinationLabel,
    route: routeContext.current === context ? state.route : null,
    error: !destination
      ? "The destination pin is missing. Contact the shop or customer to confirm it."
      : state.error,
    toggleFollowMode: () => patch({ followMode: !current.current.followMode }),
    enableFollowMode: () => patch({ followMode: true }),
    disableFollowMode: () => patch({ followMode: false }),
    forceRefreshRoute: () => refreshRoute(true),
  };
}
