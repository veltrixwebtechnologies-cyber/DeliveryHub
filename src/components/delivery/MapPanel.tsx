import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Navigation, MapPin, Loader2 } from "lucide-react";
import { osmDirections } from "@/lib/delivery";

import { getMapTileConfig } from "@/lib/map-provider";

type Props = {
  lat: number;
  lng: number;
  label: string;
  from?: [number, number] | null;
  height?: number;
  markerType?: "destination" | "rider";
};

export function MapPanel({ lat, lng, label, from = null, height = 220, markerType = "destination" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);

  const isValidCoord = (a: number, b: number) =>
    Number.isFinite(a) && Number.isFinite(b) && !(a === 0 && b === 0) && Math.abs(a) <= 90 && Math.abs(b) <= 180;

  const hasTarget = isValidCoord(lat, lng);
  const hasFrom = from && isValidCoord(from[0], from[1]);

  // Target location or fallback location (from or Coimbatore default)
  const targetLat = hasTarget ? lat : hasFrom ? from![0] : 11.0168;
  const targetLng = hasTarget ? lng : hasFrom ? from![1] : 76.9558;

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

        const center: [number, number] = [targetLat, targetLng];
        const map = L.map(containerRef.current, {
          center,
          zoom: 15,
          maxZoom: 18,
          zoomControl: false,
          attributionControl: false,
        });

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

        L.marker([lat, lng], { icon: destIcon }).addTo(map).bindPopup(label);

        // If rider origin is available, plot rider position and polyline
        if (from && Number.isFinite(from[0]) && Number.isFinite(from[1])) {
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
              [from[0], from[1]],
              [lat, lng],
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
  }, [lat, lng, from?.[0], from?.[1], hasTarget, hasFrom, markerType]);

  const isValidLocation = hasTarget || hasFrom;

  if (!isValidLocation) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Location coordinates are not available yet. Use the address navigation link when available.
      </div>
    );
  }

  const directUrl = osmDirections(hasFrom ? from : null, [targetLat, targetLng]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div ref={containerRef} className="relative w-full bg-muted" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/80 text-muted-foreground text-xs gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading OpenStreetMap...
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-3 py-2">
        <span className="truncate text-xs text-muted-foreground flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
          {label}
        </span>
        <Button asChild size="sm" variant="secondary">
          <a href={directUrl} target="_blank" rel="noreferrer">
            <Navigation className="mr-1 h-3.5 w-3.5" /> Open Navigation
          </a>
        </Button>
      </div>
    </div>
  );
}

type AddressNavigationProps = {
  address: string;
  label: string;
  from?: [number, number] | null;
};

// Default center fallback (Coimbatore, Tamil Nadu center)
const DEFAULT_CENTER: [number, number] = [11.0168, 76.9558];

export function AddressNavigation({ address, label, from = null }: AddressNavigationProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searching, setSearching] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    if (!address) {
      setSearching(false);
      return;
    }

    const cleanAddress = address.trim();

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
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setCoords({ lat, lng });
            setSearching(false);
            return;
          }
        }

        // 2. Fallback: extract postal code or clean location terms (e.g. 641025, Tamil Nadu)
        const matchPin = cleanAddress.match(/\b\d{6}\b/);
        const pinQuery = matchPin ? `${matchPin[0]}, Tamil Nadu, India` : "Coimbatore, Tamil Nadu, India";
        
        const fallbackRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pinQuery)}&limit=1`,
        );
        const fallbackData = await fallbackRes.json();
        if (!isCurrent) return;

        if (Array.isArray(fallbackData) && fallbackData.length > 0) {
          const lat = parseFloat(fallbackData[0].lat);
          const lng = parseFloat(fallbackData[0].lon);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setCoords({ lat, lng });
            setSearching(false);
            return;
          }
        }
      } catch (err) {
        console.warn("[AddressNavigation] Geocoding error", err);
      } finally {
        if (isCurrent) setSearching(false);
      }
    };

    void geocode();

    return () => {
      isCurrent = false;
    };
  }, [address]);

  // Coordinates found (or fallback postal code resolved)
  const mapLat = coords?.lat ?? (from ? from[0] : DEFAULT_CENTER[0]);
  const mapLng = coords?.lng ?? (from ? from[1] : DEFAULT_CENTER[1]);

  return (
    <MapPanel
      lat={mapLat}
      lng={mapLng}
      label={label ? `${label} (${address})` : address}
      from={from}
      height={220}
    />
  );
}
