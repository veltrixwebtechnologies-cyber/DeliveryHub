export const INR = (n: number | string | null | undefined) =>
  `₹${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 100) / 100;
}

export const VEHICLES = [
  { value: "bike", label: "Bike" },
  { value: "scooter", label: "Scooter" },
  { value: "ev", label: "EV" },
  { value: "bicycle", label: "Bicycle" },
] as const;

export const SHIFTS = [
  { value: "morning", label: "Morning", time: "6 AM – 12 PM" },
  { value: "afternoon", label: "Afternoon", time: "12 PM – 5 PM" },
  { value: "evening", label: "Evening", time: "5 PM – 10 PM" },
  { value: "night", label: "Night", time: "10 PM – 6 AM" },
] as const;

export const DOC_LABELS: Record<string, string> = {
  profile_photo: "Profile photo",
  rc: "Registration certificate (RC)",
  insurance: "Insurance",
  vehicle_photo: "Vehicle photo",
  licence: "Driving licence",
  aadhaar_front: "Aadhaar (front)",
  aadhaar_back: "Aadhaar (back)",
  pan: "PAN card",
};

export const PARTNER_STATUS_LABEL: Record<string, string> = {
  draft: "Registration incomplete",
  pending_verification: "Pending verification",
  info_requested: "More information requested",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  placed: "Placed",
  vendor_accepted: "Vendor accepted",
  picking: "Picking",
  packed: "Packed",
  ready_for_pickup: "Ready for pickup",
  assigned: "Rider assigned",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Request sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  navigating_to_vendor: "Navigating to vendor",
  reached_vendor: "Reached vendor",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Rider-side forward flow. Each step maps to the order status it drives. */
export const DELIVERY_FLOW: {
  status: string;
  label: string;
  action: string;
  orderStatus: string | null;
}[] = [
  {
    status: "accepted",
    label: "Accepted",
    action: "Start navigating to vendor",
    orderStatus: "assigned",
  },
  {
    status: "navigating_to_vendor",
    label: "Navigating to vendor",
    action: "I have reached the shop",
    orderStatus: "assigned",
  },
  {
    status: "reached_vendor",
    label: "Reached vendor",
    action: "Confirm pickup",
    orderStatus: "assigned",
  },
  {
    status: "picked_up",
    label: "Picked up",
    action: "Start delivery",
    orderStatus: "picked_up",
  },
  {
    status: "out_for_delivery",
    label: "Out for delivery",
    action: "Complete delivery",
    orderStatus: "out_for_delivery",
  },
  { status: "delivered", label: "Delivered", action: "", orderStatus: "delivered" },
];

export const ACTIVE_ASSIGNMENT_STATUSES = [
  "accepted",
  "navigating_to_vendor",
  "reached_vendor",
  "picked_up",
  "out_for_delivery",
];

export function nextFlowStep(current: string) {
  const i = DELIVERY_FLOW.findIndex((s) => s.status === current);
  return i >= 0 && i < DELIVERY_FLOW.length - 1 ? DELIVERY_FLOW[i + 1] : null;
}

export function osmEmbed(lat: number, lng: number, zoomPad = 0.012) {
  // Google’s no-key embed endpoint is more reliable inside partner portals
  // than the OSM export iframe (which is intermittently blocked by browsers).
  // Keep the function name for compatibility with existing callers.
  const zoom = zoomPad <= 0.008 ? 16 : 15;
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=${zoom}&output=embed`;
}

export function osmDirections(from: [number, number] | null, to: [number, number]) {
  const f = from ? `${from[0]},${from[1]}` : "";
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_bike&route=${f};${to[0]},${to[1]}`;
}

export function etaMinutes(distanceKm: number) {
  return Math.max(4, Math.round((distanceKm / 22) * 60) + 5);
}

export function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
