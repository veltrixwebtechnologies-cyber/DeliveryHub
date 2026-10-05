import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Navigation, MapPin, Loader2 } from "lucide-react";
import { googleMapsDirections } from "@/lib/delivery";
import { isValidCoordinate } from "@/lib/geo";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

type Props = {
  lat: number | null;
  lng: number | null;
  label: string;
  from?: [number, number] | null;
  height?: number;
  markerType?: "destination" | "rider";
  coordinateStatus?: "exact" | "approximate" | "missing";
};

export function MapPanel({
  lat,
  lng,
  label,
  from = null,
  height = 220,
  markerType = "destination",
  coordinateStatus = "exact",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const hasTarget = isValidCoordinate(lat, lng);
  const hasFrom = !!from && isValidCoordinate(from[0], from[1]);

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    setLoading(true);
    setMapError(null);

    (async () => {
      try {
        const googleApi = await loadGoogleMaps();

        if (!isMounted || !containerRef.current) return;

        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];
        polylineRef.current?.setMap(null);
        polylineRef.current = null;

        const center: google.maps.LatLngLiteral = hasTarget
          ? { lat: lat as number, lng: lng as number }
          : hasFrom
            ? { lat: from![0], lng: from![1] }
            : { lat: 11.02, lng: 76.99 };
        const map = new googleApi.maps.Map(containerRef.current, {
          center,
          zoom: markerType === "rider" ? 16 : 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
        });
        const bounds = new googleApi.maps.LatLngBounds();
        const destination = { lat: lat as number, lng: lng as number };
        if (hasTarget) {
          const marker = new googleApi.maps.Marker({
            map,
            position: destination,
            title: label,
            zIndex: 2,
            ...(markerType !== "rider" && {
              icon: {
                path: googleApi.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                fillColor: "#8b5cf6",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
                scale: 6,
              },
            }),
          });
          markersRef.current.push(marker);
          bounds.extend(destination);
          const info = new googleApi.maps.InfoWindow({ content: label });
          marker.addListener("click", () => info.open({ map, anchor: marker }));
        }

        // If rider origin is available, plot rider position and polyline
        if (hasTarget && hasFrom) {
          const origin = { lat: from[0], lng: from[1] };
          const riderMarker = new googleApi.maps.Marker({
            map,
            position: origin,
            title: "Delivery partner",
            icon: {
              path: googleApi.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: "#10b981",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
            },
          });
          markersRef.current.push(riderMarker);
          bounds.extend(origin);
          polylineRef.current = new googleApi.maps.Polyline({
            path: [origin, destination],
            geodesic: true,
            strokeColor: "#8b5cf6",
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map,
          });
          map.fitBounds(bounds, 30);
        }

        mapRef.current = map;
        setLoading(false);
      } catch (err) {
        console.error("[MapPanel] Google Maps init failed", err);
        if (isMounted) {
          setMapError(err instanceof Error ? err.message : "Google Maps is unavailable right now.");
        }
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
      if (mapRef.current) {
        try {
          google.maps.event.clearInstanceListeners(mapRef.current);
        } catch {
          // Ignore error during unmount cleanup
        }
        mapRef.current = null;
      }
    };
  }, [lat, lng, from?.[0], from?.[1], hasTarget, hasFrom, markerType, label]);

  if (!hasTarget) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Destination location unavailable.
      </div>
    );
  }

  const directionsUrl = hasTarget
    ? googleMapsDirections(from, [lat as number, lng as number])
    : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="relative w-full bg-muted" style={{ height }}>
        {/* Google Maps owns and mutates this element's children; keep React overlays outside it. */}
        <div ref={containerRef} className="absolute inset-0" />
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/80 text-muted-foreground text-xs gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading Map...
          </div>
        )}
        {mapError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted p-4 text-center text-xs text-muted-foreground">
            {mapError}
          </div>
        )}
        {coordinateStatus === "approximate" && (
          <div className="absolute left-3 top-3 z-10 rounded-full bg-amber-500/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
            Approximate location
          </div>
        )}
        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-emerald-600/90 hover:bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm transition-transform active:scale-95"
            title="Open directions in Google Maps"
          >
            <Navigation className="h-3.5 w-3.5" />
            <span>Google Maps</span>
          </a>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-3.5 py-2.5">
        <span className="truncate text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
          {label}
        </span>
        {directionsUrl ? (
          <Button
            asChild
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shrink-0"
          >
            <a href={directionsUrl} target="_blank" rel="noreferrer">
              <Navigation className="mr-1.5 h-3.5 w-3.5" /> Navigate on Google Maps
            </a>
          </Button>
        ) : (
          <span className="text-[11px] font-medium text-muted-foreground">
            Navigation unavailable
          </span>
        )}
      </div>
    </div>
  );
}

type AddressNavigationProps = {
  address: string;
  label: string;
  from?: [number, number] | null;
};

export function AddressNavigation({ address, label, from = null }: AddressNavigationProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [coordinateStatus, setCoordinateStatus] = useState<"exact" | "approximate" | "missing">(
    "missing",
  );

  useEffect(() => {
    let isCurrent = true;
    let resolved = false;
    if (!address) {
      setCoords(null);
      setCoordinateStatus("missing");
      return;
    }

    const cleanAddress = address.trim();
    setCoords(null);
    setCoordinateStatus("missing");

    // 1. Try primary address search
    const geocode = async () => {
      try {
        const googleApi = await loadGoogleMaps();
        const data = await new googleApi.maps.Geocoder().geocode({ address: cleanAddress });
        if (!isCurrent) return;

        const firstResult = data.results?.[0];
        if (firstResult) {
          const point = firstResult.geometry.location;
          const lat = point.lat();
          const lng = point.lng();
          if (isValidCoordinate(lat, lng)) {
            setCoords({ lat, lng });
            setCoordinateStatus("exact");
            resolved = true;
            return;
          }
        }
      } catch (err) {
        console.warn("[AddressNavigation] Geocoding error", err);
      } finally {
        if (isCurrent && !resolved) setCoords(null);
      }
    };

    void geocode();

    return () => {
      isCurrent = false;
    };
  }, [address]);

  return (
    <MapPanel
      lat={coords?.lat ?? null}
      lng={coords?.lng ?? null}
      label={label ? `${label} (${address})` : address}
      from={from}
      height={220}
      coordinateStatus={coordinateStatus}
    />
  );
}
