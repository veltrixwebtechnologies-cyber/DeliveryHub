/**
 * LocalShore Delivery Partner Hub — OSRM Road Routing & Navigation Engine
 * Uses real OSRM for road-following routes, turn-by-turn instructions,
 * off-route detection, and intelligent recalculation.
 */

import {
  calculateBearing,
  distanceToPolylineMeters,
  haversineDistanceKm,
  haversineDistanceMeters,
  isValidCoordinate,
  normalizeCoordinate,
  type Coordinate,
} from "@/lib/geo";

export type MapLocation = Coordinate;

export interface TurnStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  name: string;
  maneuverType: string;
  maneuverModifier: string;
}

export interface RouteResult {
  distanceMeters: number | null;
  durationSeconds: number | null;
  geometry: [number, number][]; // [lng, lat][]
  steps: TurnStep[];
  formattedDistance: string;
  formattedDuration: string;
  phase: "to_vendor" | "to_customer";
  status: "success" | "fallback" | "error";
}

// ── Maneuver Formatting ──────────────────────────────────────────────

const MANEUVER_ICONS: Record<string, string> = {
  "turn-right": "↱",
  "turn-left": "↰",
  "sharp right": "⤵",
  "sharp left": "⤴",
  "slight right": "↗",
  "slight left": "↖",
  straight: "↑",
  uturn: "↩",
  merge: "⤞",
  "fork-right": "⑂",
  "fork-left": "⑂",
  roundabout: "↻",
  rotary: "↻",
  depart: "🚩",
  arrive: "📍",
};

export function formatManeuver(type: string, modifier: string): string {
  const key = modifier ? `${type}-${modifier}` : type;

  const map: Record<string, string> = {
    "turn-right": "Turn right",
    "turn-left": "Turn left",
    "turn-sharp right": "Sharp right",
    "turn-sharp left": "Sharp left",
    "turn-slight right": "Bear right",
    "turn-slight left": "Bear left",
    "turn-straight": "Continue straight",
    "new name-straight": "Continue straight",
    "new name-right": "Bear right",
    "new name-left": "Bear left",
    "merge-right": "Merge right",
    "merge-left": "Merge left",
    "merge-slight right": "Merge right",
    "merge-slight left": "Merge left",
    "fork-right": "Keep right",
    "fork-left": "Keep left",
    "fork-slight right": "Keep right",
    "fork-slight left": "Keep left",
    "roundabout-": "Enter roundabout",
    "rotary-": "Enter rotary",
    "depart-": "Start",
    "arrive-": "You have arrived",
    "end of road-right": "Turn right",
    "end of road-left": "Turn left",
    continue: "Continue",
  };

  return map[key] || map[`${type}-`] || map[type] || `${type} ${modifier}`.trim();
}

export function getManeuverIcon(type: string, modifier: string): string {
  return (
    MANEUVER_ICONS[`${type}-${modifier}`] || MANEUVER_ICONS[modifier] || MANEUVER_ICONS[type] || "→"
  );
}

export function formatDistanceShort(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function formatDurationShort(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.ceil((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  return `${Math.max(1, Math.ceil(seconds / 60))} min`;
}

// ── OSRM Route Fetcher ──────────────────────────────────────────────

export async function fetchDeliveryRoute(
  origin: MapLocation,
  destination: MapLocation,
  phase: "to_vendor" | "to_customer" = "to_customer",
  options?: { retries?: number; signal?: AbortSignal },
): Promise<RouteResult> {
  const retries = options?.retries ?? 2;
  if (!normalizeCoordinate(origin) || !normalizeCoordinate(destination)) {
    return {
      distanceMeters: null,
      durationSeconds: null,
      geometry: [],
      steps: [],
      formattedDistance: "Road route unavailable",
      formattedDuration: "Road route unavailable",
      phase,
      status: "error",
    };
  }

  const baseUrl =
    (typeof import.meta !== "undefined" && import.meta.env?.["VITE_ROUTING_API_URL"]) ||
    "https://router.project-osrm.org/route/v1/driving";

  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${baseUrl}/${coords}?overview=full&geometries=geojson&steps=true`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const abortListener = () => controller.abort();
      options?.signal?.addEventListener("abort", abortListener, { once: true });

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      options?.signal?.removeEventListener("abort", abortListener);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (!data.routes || data.routes.length === 0) throw new Error("No routes returned");

      const route = data.routes[0];
      const distanceMeters = Math.round(route.distance);
      const durationSeconds = Math.round(route.duration);
      const geometry = route.geometry.coordinates as [number, number][];

      const steps: TurnStep[] = (route.legs?.[0]?.steps || [])
        .filter((step: any) => step.distance > 0 || step.maneuver?.type === "arrive")
        .map((step: any) => ({
          instruction: formatManeuver(
            step.maneuver?.type ?? "continue",
            step.maneuver?.modifier ?? "",
          ),
          distanceMeters: Math.round(step.distance || 0),
          durationSeconds: Math.round(step.duration || 0),
          name: step.name || "",
          maneuverType: step.maneuver?.type ?? "",
          maneuverModifier: step.maneuver?.modifier ?? "",
        }));

      return {
        distanceMeters,
        durationSeconds,
        geometry,
        steps,
        formattedDistance: formatDistanceShort(distanceMeters),
        formattedDuration: formatDurationShort(durationSeconds),
        phase,
        status: "success",
      };
    } catch (err) {
      if (options?.signal?.aborted) {
        return {
          distanceMeters: null,
          durationSeconds: null,
          geometry: [],
          steps: [],
          formattedDistance: "Road route unavailable",
          formattedDuration: "Road route unavailable",
          phase,
          status: "error",
        };
      }
      if (attempt === retries) {
        console.warn(
          `[Routing] OSRM failed after ${retries + 1} attempts, using preview fallback`,
          err,
        );
        return straightLineFallback(origin, destination, phase);
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * Math.pow(2, attempt)));
    }
  }
  return straightLineFallback(origin, destination, phase);
}

function straightLineFallback(
  origin: MapLocation,
  destination: MapLocation,
  phase: "to_vendor" | "to_customer",
): RouteResult {
  return {
    distanceMeters: null,
    durationSeconds: null,
    geometry: [
      [origin.lng, origin.lat],
      [destination.lng, destination.lat],
    ],
    steps: [],
    formattedDistance: "Road route unavailable",
    formattedDuration: "Road route unavailable",
    phase,
    status: "fallback",
  };
}

// ── Geometry Helpers ─────────────────────────────────────────────────

/**
 * Should we recalculate the route? Smart debounce logic.
 */
export function shouldRecalculateRoute(
  currentPos: MapLocation,
  lastCalculatedPos: MapLocation | null,
  geometry: [number, number][] | null,
  lastCalculatedAt: number,
  phaseChanged: boolean,
): boolean {
  // Always recalculate if phase changed (vendor → customer)
  if (phaseChanged) return true;

  // If no previous route exists
  if (!geometry || geometry.length === 0 || !lastCalculatedPos) return true;

  // Off-route check (> 80 meters away from polyline)
  const offRouteDistance = distanceToPolylineMeters(currentPos, geometry);
  if (offRouteDistance > 120) {
    console.info(`[Routing] Off-route: ${offRouteDistance.toFixed(0)}m from path`);
    return true;
  }

  // Meaningful distance & time elapsed (> 200m moved AND > 25s elapsed)
  const movedKm = haversineDistanceKm(
    currentPos.lat,
    currentPos.lng,
    lastCalculatedPos.lat,
    lastCalculatedPos.lng,
  );
  const timeElapsedSec = (Date.now() - lastCalculatedAt) / 1000;

  if (movedKm > 0.2 && timeElapsedSec > 25) return true;

  // Periodic refresh every 60 seconds if route exists
  if (timeElapsedSec > 60) return true;

  return false;
}

/**
 * Calculate cumulative distance along polyline geometry array in meters
 */
export function calculateCumulativeDistances(geometry: [number, number][]): number[] {
  const distances: number[] = [0];
  for (let i = 1; i < geometry.length; i += 1) {
    const prev = geometry[i - 1];
    const curr = geometry[i];
    const d = prev && curr ? haversineDistanceMeters(prev[1], prev[0], curr[1], curr[0]) : 0;
    distances.push((distances[i - 1] ?? 0) + d);
  }
  return distances;
}

/**
 * Find the next upcoming step based on driver position and cumulative polyline distance
 */
export function findNextStep(
  driverPos: MapLocation,
  steps: TurnStep[],
  geometry: [number, number][],
): { step: TurnStep; distanceToStep: number; index: number; closestIndex: number } | null {
  if (!steps.length || !geometry.length) return null;

  let minDist = Infinity;
  let closestGeometryIndex = 0;
  for (let i = 0; i < geometry.length; i += 1) {
    const coord = geometry[i];
    if (!coord) continue;
    const d = haversineDistanceMeters(driverPos.lat, driverPos.lng, coord[1], coord[0]);
    if (d < minDist) {
      minDist = d;
      closestGeometryIndex = i;
    }
  }

  const cumDist = calculateCumulativeDistances(geometry);
  const driverCumDist = cumDist[closestGeometryIndex] ?? 0;

  let accumulated = 0;
  let selectedStepIndex = 0;

  for (let s = 0; s < steps.length; s += 1) {
    const stepDist = steps[s]?.distanceMeters ?? 0;
    accumulated += stepDist;
    if (driverCumDist <= accumulated || s === steps.length - 1) {
      selectedStepIndex = s;
      break;
    }
  }

  const step = steps[selectedStepIndex] ?? steps[steps.length - 1];
  if (!step) return null;

  const distanceToStep = Math.max(0, accumulated - driverCumDist);

  return { step, distanceToStep, index: selectedStepIndex, closestIndex: closestGeometryIndex };
}
