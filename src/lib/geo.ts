export interface Coordinate {
  lat: number;
  lng: number;
}

export type CoordinateLike =
  Coordinate | { latitude: number; longitude: number } | [number, number] | null | undefined;

export interface GPSReading {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export type GpsStatus = "unavailable" | "acquiring" | "active" | "stale" | "inaccurate" | "error";

export const GPS_GOOD_ACCURACY_M = 100;
export const GPS_ACCEPTABLE_ACCURACY_M = 10_000;
export const GPS_STALE_THRESHOLD_MS = 30_000;

export function isFiniteNumber(value: unknown): value is number {
  if (value === null || value === undefined || value === "" || typeof value === "boolean")
    return false;
  const num = Number(value);
  return Number.isFinite(num);
}

export function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return false;
  const numLat = Number(lat);
  const numLng = Number(lng);
  return Math.abs(numLat) <= 90 && Math.abs(numLng) <= 180 && !(numLat === 0 && numLng === 0);
}

export function isValidCoordinatePair(value: CoordinateLike): value is Coordinate {
  if (!value) return false;
  if (Array.isArray(value)) {
    return isValidCoordinate(value[0], value[1]);
  }
  if ("lat" in value && "lng" in value) {
    return isValidCoordinate(value.lat, value.lng);
  }
  if ("latitude" in value && "longitude" in value) {
    return isValidCoordinate(value.latitude, value.longitude);
  }
  return false;
}

export function normalizeCoordinate(value: CoordinateLike): Coordinate | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return isValidCoordinate(value[0], value[1]) ? { lat: value[0], lng: value[1] } : null;
  }
  if ("lat" in value && "lng" in value) {
    return isValidCoordinate(value.lat, value.lng) ? { lat: value.lat, lng: value.lng } : null;
  }
  if ("latitude" in value && "longitude" in value) {
    return isValidCoordinate(value.latitude, value.longitude)
      ? { lat: value.latitude, lng: value.longitude }
      : null;
  }
  return null;
}

export function normalizeReading(position: GeolocationPosition): GPSReading | null {
  const { latitude, longitude, accuracy, heading, speed } = position.coords;
  if (!isValidCoordinate(latitude, longitude)) return null;
  return {
    latitude,
    longitude,
    accuracy: isFiniteNumber(accuracy) ? accuracy : null,
    heading: isFiniteNumber(heading) ? heading : null,
    speed: isFiniteNumber(speed) ? speed : null,
    timestamp: position.timestamp || Date.now(),
  };
}

export function classifyGpsStatus(options: {
  hasFix: boolean;
  hasError: boolean;
  isStale: boolean;
  isWatching: boolean;
  accuracy: number | null;
}): GpsStatus {
  if (options.hasError) return "error";
  if (!options.hasFix) return options.isWatching ? "acquiring" : "unavailable";
  if (options.isStale) return "stale";
  if (options.accuracy !== null && options.accuracy > GPS_GOOD_ACCURACY_M) return "inaccurate";
  return "active";
}

export function gpsStatusLabel(status: GpsStatus): string {
  switch (status) {
    case "unavailable":
      return "Waiting for GPS location...";
    case "acquiring":
      return "Acquiring GPS fix...";
    case "active":
      return "GPS active";
    case "stale":
      return "GPS stale";
    case "inaccurate":
      return "GPS inaccurate";
    case "error":
      return "GPS error";
  }
}

const EARTH_RADIUS_M = 6_371_000;

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function project(lat: number, lng: number, originLat: number): { x: number; y: number } {
  const latRad = toRad(lat);
  const lngRad = toRad(lng);
  const originLatRad = toRad(originLat);
  return {
    x: EARTH_RADIUS_M * lngRad * Math.cos(originLatRad),
    y: EARTH_RADIUS_M * latRad,
  };
}

function pointToSegmentMeters(point: Coordinate, start: Coordinate, end: Coordinate): number {
  const avgLat = (point.lat + start.lat + end.lat) / 3;
  const p = project(point.lat, point.lng, avgLat);
  const a = project(start.lat, start.lng, avgLat);
  const b = project(end.lat, end.lng, avgLat);
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const apX = p.x - a.x;
  const apY = p.y - a.y;
  const denom = abX * abX + abY * abY;
  const t = denom <= 0 ? 0 : Math.max(0, Math.min(1, (apX * abX + apY * abY) / denom));
  const closestX = a.x + abX * t;
  const closestY = a.y + abY * t;
  return Math.hypot(p.x - closestX, p.y - closestY);
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return (2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) / 1000;
}

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  return haversineDistanceKm(lat1, lon1, lat2, lon2) * 1000;
}

export function distanceToPolylineMeters(point: Coordinate, geometry: [number, number][]): number {
  if (!geometry || geometry.length === 0) return Infinity;
  if (geometry.length === 1) {
    const first = geometry[0];
    if (!first) return Infinity;
    const [lng, lat] = first;
    return haversineDistanceMeters(point.lat, point.lng, lat, lng);
  }

  let minDistance = Infinity;
  for (let i = 0; i < geometry.length - 1; i += 1) {
    const start = geometry[i];
    const end = geometry[i + 1];
    if (!start || !end) continue;
    const distance = pointToSegmentMeters(
      point,
      { lat: start[1], lng: start[0] },
      { lat: end[1], lng: end[0] },
    );
    if (distance < minDistance) minDistance = distance;
  }
  return minDistance;
}

export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
