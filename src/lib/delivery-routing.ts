import { parseCoordinates } from "./coordinates";
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
  startDistanceMeters?: number;
  distanceMeters: number;
  durationSeconds: number;
  name: string;
  maneuverType: string;
  maneuverModifier: string;
}

export interface RouteResult {
  status: "success";
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
    "arrive-": "Arrive at destination",
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
  retries = 1,
  signal?: AbortSignal,
): Promise<RouteResult> {
  if (
    !parseCoordinates(origin.lat, origin.lng) ||
    !parseCoordinates(destination.lat, destination.lng)
  ) {
    throw new Error("A confirmed pickup/drop-off pin and rider location are required.");
  }
  const baseUrl =
    import.meta.env?.["VITE_ROUTING_API_URL"] || "https://router.project-osrm.org/route/v1/driving";
  const url =
    baseUrl.replace(/\/$/, "") +
    "/" +
    origin.lng +
    "," +
    origin.lat +
    ";" +
    destination.lng +
    "," +
    destination.lat +
    "?overview=full&geometries=geojson&steps=true&radiuses=150;150";
  let failure: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 8000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("Routing service returned HTTP " + response.status);
      const data = await response.json();
      signal?.throwIfAborted();
      const route = data.routes?.[0];
      if (data.code !== "Ok" || !route)
        throw new Error(
          "No road route connects these pins. Check the pickup and delivery entrances.",
        );
      const geometry = route.geometry?.coordinates;
      if (
        !Array.isArray(geometry) ||
        geometry.length < 2 ||
        geometry.some((p: unknown) => !Array.isArray(p) || !parseCoordinates(p[1], p[0]))
      ) {
        throw new Error("Routing service returned invalid geometry.");
      }
      if (
        !Number.isFinite(route.distance) ||
        route.distance < 0 ||
        !Number.isFinite(route.duration) ||
        route.duration < 0
      ) {
        throw new Error("Routing service returned invalid distance or duration.");
      }
      if (
        !Array.isArray(data.waypoints) ||
        data.waypoints.length !== 2 ||
        data.waypoints.some((w: any) => !Number.isFinite(w.distance) || w.distance > 150)
      ) {
        throw new Error("A pin is too far from a routable road. Confirm the road entrance.");
      }
      let startDistanceMeters = 0;
      const steps: TurnStep[] = (route.legs?.[0]?.steps ?? []).map((step: any) => {
        const distanceMeters = Math.max(0, Number(step.distance) || 0);
        const result = {
          instruction: formatManeuver(
            step.maneuver?.type ?? "continue",
            step.maneuver?.modifier ?? "",
          ),
          startDistanceMeters,
          distanceMeters,
          durationSeconds: Math.max(0, Number(step.duration) || 0),
          name: step.name || "",
          maneuverType: step.maneuver?.type || "",
          maneuverModifier: step.maneuver?.modifier || "",
        };
        startDistanceMeters += distanceMeters;
        return result;
      });
      return {
        status: "success",
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        geometry,
        steps,
        phase,
        formattedDistance: formatDistanceShort(route.distance),
        formattedDuration: formatDurationShort(route.duration),
      };
    } catch (error) {
      if (signal?.aborted) throw error;
      failure = error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
  throw failure instanceof Error
    ? failure
    : new Error("Road routing is unavailable. Please retry.");
}

// ── Geometry Helpers ─────────────────────────────────────────────────

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  return haversineDistanceKm(lat1, lon1, lat2, lon2) * 1000;
}

/**
 * Shortest distance in meters from a point to a polyline
 */
export function routeProgress(point: MapLocation, geometry: [number, number][]) {
  let offRouteMeters = Infinity,
    alongMeters = 0,
    totalMeters = 0;
  for (let i = 1; i < geometry.length; i++) {
    const a = geometry[i - 1]!,
      b = geometry[i]!;
    const scale = Math.cos((point.lat * Math.PI) / 180);
    const ax = (a[0] - point.lng) * scale,
      ay = a[1] - point.lat;
    const bx = (b[0] - point.lng) * scale,
      by = b[1] - point.lat;
    const dx = bx - ax,
      dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    const lat = a[1] + (b[1] - a[1]) * t,
      lng = a[0] + (b[0] - a[0]) * t;
    const distance = haversineDistanceMeters(point.lat, point.lng, lat, lng);
    const length = haversineDistanceMeters(a[1], a[0], b[1], b[0]);
    if (distance < offRouteMeters) {
      offRouteMeters = distance;
      alongMeters = totalMeters + length * t;
    }
    totalMeters += length;
  }
  return {
    offRouteMeters,
    alongMeters,
    totalMeters,
    remainingMeters: Math.max(0, totalMeters - alongMeters),
  };
}

export function distanceToPolylineMeters(point: MapLocation, geometry: [number, number][]): number {
  return routeProgress(point, geometry).offRouteMeters;
}

export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = (lat1 * Math.PI) / 180,
    b = (lat2 * Math.PI) / 180;
  const delta = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(delta) * Math.cos(b);
  const x = Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) * Math.cos(delta);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function findNextStep(
  driverPos: MapLocation,
  steps: TurnStep[],
  geometry: [number, number][],
): { step: TurnStep; distanceToStep: number; index: number } | null {
  if (!steps.length || geometry.length < 2) return null;
  const progress = routeProgress(driverPos, geometry);
  const roadLength = steps.reduce((sum, step) => sum + step.distanceMeters, 0);
  const travelled = progress.totalMeters
    ? (progress.alongMeters / progress.totalMeters) * roadLength
    : 0;
  let offset = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const start = step.startDistanceMeters ?? offset;
    if (start > travelled + 5 || i === steps.length - 1) {
      return { step, index: i, distanceToStep: Math.max(0, start - travelled) };
    }
    offset += step.distanceMeters;
  }
  return null;
}
