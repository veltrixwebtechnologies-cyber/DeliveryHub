import { parseCoordinates, MAX_LOCATION_AGE_MS, MAX_NAVIGATION_ACCURACY_M } from "./coordinates";

export function vendorLivePin(row: any, now = Date.now()) {
  const pin = parseCoordinates(row?.latitude, row?.longitude);
  const updated = Date.parse(row?.updated_at ?? "");
  return row?.is_active &&
    pin &&
    Number.isFinite(row.accuracy) &&
    row.accuracy >= 0 &&
    row.accuracy <= MAX_NAVIGATION_ACCURACY_M &&
    Number.isFinite(updated) &&
    updated <= now + 1000 &&
    now - updated <= MAX_LOCATION_AGE_MS
    ? pin
    : null;
}
