/**
 * LocalShore Delivery Partner Hub — OSRM Road Routing & Navigation Engine
 * Uses real OSRM for road-following routes, turn-by-turn instructions,
 * off-route detection, and intelligent recalculation.
 */

export interface MapLocation {
  lat: number;
  lng: number;
}

export interface TurnStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  name: string;
  maneuverType: string;
  maneuverModifier: string;
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: [number, number][]; // [lng, lat][]
  steps: TurnStep[];
  formattedDistance: string;
  formattedDuration: string;
  phase: "to_vendor" | "to_customer";
}

// ── Maneuver Formatting ──────────────────────────────────────────────

const MANEUVER_ICONS: Record<string, string> = {
  "turn-right": "↱",
  "turn-left": "↰",
  "sharp right": "⤵",
  "sharp left": "⤴",
  "slight right": "↗",
  "slight left": "↖",
  "straight": "↑",
  "uturn": "↩",
  "merge": "⤞",
  "fork-right": "⑂",
  "fork-left": "⑂",
  "roundabout": "↻",
  "rotary": "↻",
  "depart": "🚩",
  "arrive": "📍",
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
  return MANEUVER_ICONS[`${type}-${modifier}`] || MANEUVER_ICONS[modifier] || MANEUVER_ICONS[type] || "→";
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
  retries = 2
): Promise<RouteResult> {
  const baseUrl =
    (typeof import.meta !== "undefined" && import.meta.env?.["VITE_ROUTING_API_URL"]) ||
    "https://router.project-osrm.org/route/v1/driving";

  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${baseUrl}/${coords}?overview=full&geometries=geojson&steps=true`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

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
          instruction: formatManeuver(step.maneuver?.type ?? "continue", step.maneuver?.modifier ?? ""),
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
      };
    } catch (err) {
      if (attempt === retries) {
        console.warn(`[Routing] OSRM failed after ${retries + 1} attempts, using fallback`, err);
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
  phase: "to_vendor" | "to_customer"
): RouteResult {
  const distKm = haversineDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
  const distMeters = Math.round(distKm * 1000);
  const durSec = Math.round((distKm / 22) * 3600);
  return {
    distanceMeters: distMeters,
    durationSeconds: durSec,
    geometry: [
      [origin.lng, origin.lat],
      [destination.lng, destination.lat],
    ],
    steps: [{ instruction: "Head toward destination", distanceMeters: distMeters, durationSeconds: durSec, name: "", maneuverType: "depart", maneuverModifier: "" }],
    formattedDistance: formatDistanceShort(distMeters),
    formattedDuration: formatDurationShort(durSec),
    phase,
  };
}

// ── Geometry Helpers ─────────────────────────────────────────────────

export function haversineDistanceKm(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function haversineDistanceMeters(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  return haversineDistanceKm(lat1, lon1, lat2, lon2) * 1000;
}

/**
 * Shortest distance in meters from a point to a polyline
 */
export function distanceToPolylineMeters(
  point: MapLocation,
  geometry: [number, number][]
): number {
  if (!geometry || geometry.length === 0) return Infinity;
  let minDist = Infinity;
  for (const [lng, lat] of geometry) {
    const d = haversineDistanceMeters(point.lat, point.lng, lat, lng);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Calculate bearing (0-360°) between two points
 */
export function calculateBearing(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Should we recalculate the route? Smart debounce logic.
 */
export function shouldRecalculateRoute(
  currentPos: MapLocation,
  lastCalculatedPos: MapLocation | null,
  geometry: [number, number][] | null,
  lastCalculatedAt: number,
  phaseChanged: boolean
): boolean {
  // Always recalculate if phase changed (vendor → customer)
  if (phaseChanged) return true;

  // If no previous route exists
  if (!geometry || geometry.length === 0 || !lastCalculatedPos) return true;

  // Off-route check (> 80 meters away from polyline)
  const offRouteDistance = distanceToPolylineMeters(currentPos, geometry);
  if (offRouteDistance > 80) {
    console.info(`[Routing] Off-route: ${offRouteDistance.toFixed(0)}m from path`);
    return true;
  }

  // Meaningful distance & time elapsed (> 200m moved AND > 25s elapsed)
  const movedKm = haversineDistanceKm(
    currentPos.lat, currentPos.lng,
    lastCalculatedPos.lat, lastCalculatedPos.lng
  );
  const timeElapsedSec = (Date.now() - lastCalculatedAt) / 1000;

  if (movedKm > 0.2 && timeElapsedSec > 25) return true;

  // Periodic refresh every 60 seconds if route exists
  if (timeElapsedSec > 60) return true;

  return false;
}

/**
 * Find the next upcoming step based on driver position
 */
export function findNextStep(
  driverPos: MapLocation,
  steps: TurnStep[],
  geometry: [number, number][]
): { step: TurnStep; distanceToStep: number; index: number } | null {
  if (!steps.length || !geometry.length) return null;

  // Find which segment of the route we're closest to
  let minDist = Infinity;
  let closestIdx = 0;
  for (let i = 0; i < geometry.length; i++) {
    const coord = geometry[i];
    if (!coord) continue;
    const d = haversineDistanceMeters(driverPos.lat, driverPos.lng, coord[1], coord[0]);
    if (d < minDist) {
      minDist = d;
      closestIdx = i;
    }
  }

  // Accumulate distances from steps to match geometry progress
  let accumulatedDist = 0;
  let geoIdx = 0;
  const totalDist = steps.reduce((s, st) => s + st.distanceMeters, 0) || 1;
  for (let i = 0; i < steps.length; i++) {
    const currentStep = steps[i];
    if (!currentStep) continue;
    accumulatedDist += currentStep.distanceMeters;
    // Rough mapping of distance to geometry index
    const targetGeoIdx = Math.min(
      geometry.length - 1,
      Math.round((accumulatedDist / totalDist) * geometry.length)
    );
    geoIdx = targetGeoIdx;

    if (geoIdx >= closestIdx) {
      const geoCoord = geometry[Math.min(geoIdx, geometry.length - 1)];
      const distToStep = geoCoord
        ? haversineDistanceMeters(driverPos.lat, driverPos.lng, geoCoord[1], geoCoord[0])
        : minDist;
      return { step: currentStep, distanceToStep: distToStep, index: i };
    }
  }

  // Default to last step
  const lastStep = steps[steps.length - 1];
  if (lastStep) {
    return { step: lastStep, distanceToStep: minDist, index: steps.length - 1 };
  }

  return null;
}
