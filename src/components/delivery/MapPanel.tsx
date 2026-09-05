import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Navigation, MapPin, Loader2 } from "lucide-react";
import { osmDirections } from "@/lib/delivery";
import { isValidCoordinate } from "@/lib/geo";

import { getMapTileConfig } from "@/lib/map-provider";

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
  const mapRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const hasTarget = isValidCoordinate(lat, lng);
  const hasFrom = !!from && isValidCoordinate(from[0], from[1]);

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");

        if (!isMounted || !containerRef.current) return;

        // Clean up previous map if exists
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        const center: [number, number] = hasTarget
          ? [lat as number, lng as number]
          : hasFrom
            ? [from![0], from![1]]
            : [11.02, 76.99];
        const map = L.map(containerRef.current, {
          center,
          zoom: 15,
          maxZoom: 18,
          zoomControl: false,
          attributionControl: false,
        });
        map.setView(center, markerType === "rider" ? 16 : 15);

        const tileConfig = getMapTileConfig();
        L.tileLayer(tileConfig.url, {
          maxZoom: tileConfig.maxZoom,
          subdomains: tileConfig.subdomains,
          attribution: tileConfig.attribution,
        }).addTo(map);

        setTimeout(() => {
          map.invalidateSize();
        }, 100);

        // Destination Marker Pin
        const destIcon = L.divIcon({
          className: "custom-dest-pin",
          html: `<div style="background-color: ${markerType === "rider" ? "#10b981" : "#8b5cf6"}; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">
            ${markerType === "rider" ? '<span style="font-size: 13px">🛵</span>' : '<div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div>'}
          </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        if (hasTarget && markerType === "rider") {
          L.circleMarker([lat as number, lng as number], {
            radius: 12,
            color: "#ffffff",
            weight: 4,
            fillColor: "#10b981",
            fillOpacity: 1,
          })
            .addTo(map)
            .bindPopup(label);
          L.marker([lat as number, lng as number], { icon: destIcon, zIndexOffset: 1000 }).addTo(
            map,
          );
        } else if (hasTarget) {
          L.marker([lat as number, lng as number], { icon: destIcon, zIndexOffset: 1000 })
            .addTo(map)
            .bindPopup(label);
        }

        // If rider origin is available, plot rider position and polyline
        if (hasTarget && hasFrom) {
          const riderIcon = L.divIcon({
            className: "custom-rider-pin",
            html: `<div style="background-color: #10b981; width: 26px; height: 26px; border-radius: 50%; border: 2.5px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">
              <span style="color: white; font-size: 12px; font-weight: bold;">🛵</span>
            </div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          L.marker([from[0], from[1]], { icon: riderIcon }).addTo(map);

          const polyline = L.polyline(
            [
              [from![0], from![1]],
              [lat as number, lng as number],
            ],
            { color: "#8b5cf6", weight: 4, opacity: 0.8, dashArray: "6, 8" },
          ).addTo(map);

          map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
        }

        mapRef.current = map;
        setLoading(false);
      } catch (err) {
        console.error("[MapPanel] Leaflet map init failed", err);
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
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

  const osmUrl = hasTarget ? osmDirections(from, [lat as number, lng as number]) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div ref={containerRef} className="relative w-full bg-muted" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/80 text-muted-foreground text-xs gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading Map...
          </div>
        )}
        {coordinateStatus === "approximate" && (
          <div className="absolute left-3 top-3 z-10 rounded-full bg-amber-500/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
            Approximate location
          </div>
        )}
        {osmUrl && (
          <a
            href={osmUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-emerald-600/90 hover:bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm transition-transform active:scale-95"
            title="Open Turn-by-Turn GPS Navigation in OpenStreetMap"
          >
            <Navigation className="h-3.5 w-3.5" />
            <span>OpenStreetMap 🗺️</span>
          </a>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-3.5 py-2.5">
        <span className="truncate text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
          {label}
        </span>
        {osmUrl ? (
          <Button
            asChild
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shrink-0"
          >
            <a href={osmUrl} target="_blank" rel="noreferrer">
              <Navigation className="mr-1.5 h-3.5 w-3.5" /> Navigate on OpenStreetMap
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
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress)}&limit=1`,
        );
        const data = await res.json();
        if (!isCurrent) return;

        if (Array.isArray(data) && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
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
