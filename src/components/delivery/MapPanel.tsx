import { useEffect, useState } from "react";
import { LiveNavigationMap } from "./LiveNavigationMap";
import { fetchDeliveryRoute, type RouteResult } from "@/lib/delivery-routing";
import { parseCoordinates } from "@/lib/coordinates";
import { osmDirections } from "@/lib/delivery";

type Props = {
  lat: number;
  lng: number;
  label: string;
  from?: [number, number] | null;
  height?: number;
  markerType?: "destination" | "rider";
};
export function MapPanel({
  lat,
  lng,
  label,
  from = null,
  height = 220,
  markerType = "destination",
}: Props) {
  const target = parseCoordinates(lat, lng);
  const origin = from ? parseCoordinates(from[0], from[1]) : null;
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setRoute(null);
    setError(null);
    setLoading(false);
    if (target && origin && markerType !== "rider") {
      setLoading(true);
      void fetchDeliveryRoute(origin, target, "to_vendor", 1, controller.signal).then(
        (value) => {
          if (current) {
            setRoute(value);
            setLoading(false);
          }
        },
        (reason) => {
          if (current) {
            setError(reason.message || "Road routing unavailable.");
            setLoading(false);
          }
        },
      );
    }
    return () => {
      current = false;
      controller.abort();
    };
  }, [lat, lng, from?.[0], from?.[1], markerType]);
  if (!target) return <AddressNavigation address="" label={label} />;
  const driver = markerType === "rider" ? target : origin;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative" style={{ height }}>
        <LiveNavigationMap
          driverPos={driver ? { ...driver, heading: 0 } : null}
          vendorLocation={markerType === "rider" ? null : target}
          customerLocation={null}
          destination={target}
          route={route}
          phase="to_vendor"
          followMode={false}
          isOffRoute={false}
          isRerouting={loading}
          isStale={false}
          arrivalZone="none"
          className="absolute inset-0"
        />
      </div>
      <div className="p-3 text-xs space-y-2">
        <p>{label}</p>
        {error && (
          <p role="status" className="text-amber-700">
            {error} No road route is displayed.
          </p>
        )}
        {!origin && markerType !== "rider" && (
          <p>Destination pin only. A fresh rider location is needed for a route.</p>
        )}
        {route && (
          <p>
            {route.formattedDistance} · {route.formattedDuration} · Road route (car)
          </p>
        )}
        {origin && markerType !== "rider" && (
          <a
            className="underline"
            href={osmDirections([origin.lat, origin.lng], [target.lat, target.lng])}
            target="_blank"
            rel="noreferrer"
          >
            Open Navigation
          </a>
        )}
      </div>
    </div>
  );
}

type AddressNavigationProps = { address: string; label: string; from?: [number, number] | null };
export function AddressNavigation({ address, label }: AddressNavigationProps) {
  // Search results are not confirmed delivery pins. Never substitute a city,
  // postcode or the rider's position for a missing destination.
  return (
    <div
      role="status"
      className="rounded-xl border border-dashed border-border p-4 text-sm space-y-2"
    >
      <p>{label}</p>
      <p>{address}</p>
      <p>
        The exact location pin is missing. Contact the shop or customer to confirm the destination.
      </p>
      {address && (
        <a
          className="underline"
          target="_blank"
          rel="noreferrer"
          href={"https://www.openstreetmap.org/search?query=" + encodeURIComponent(address)}
        >
          Search this address in OpenStreetMap
        </a>
      )}
    </div>
  );
}
