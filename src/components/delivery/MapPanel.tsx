import { osmEmbed, osmDirections } from "@/lib/delivery";
import { Button } from "@/components/ui/button";
import { Navigation } from "lucide-react";

type Props = {
  lat: number;
  lng: number;
  label: string;
  from?: [number, number] | null;
  height?: number;
};

export function MapPanel({ lat, lng, label, from = null, height = 220 }: Props) {
  const valid =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  if (!valid) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Location coordinates are not available yet. Use the address navigation link when available.
      </div>
    );
  }
  const direct = osmDirections(from, [lat, lng]);
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <iframe
        title={`Map – ${label}`}
        src={osmEmbed(lat, lng)}
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        className="w-full bg-muted"
        style={{ height }}
        loading="lazy"
      />
      <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-3 py-2">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <Button asChild size="sm" variant="secondary">
          <a href={direct} target="_blank" rel="noreferrer">
            <Navigation className="mr-1 h-3.5 w-3.5" /> Navigate
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

/**
 * Sellers in the shared marketplace schema may have an address without a map
 * pin. Keep pickup navigation available while their exact coordinates are
 * being collected or backfilled.
 */
export function AddressNavigation({ address, label, from = null }: AddressNavigationProps) {
  const destination = encodeURIComponent(address);
  const directions = `https://www.openstreetmap.org/search?query=${destination}`;
  const preview = `https://www.openstreetmap.org/export/embed.html?layer=mapnik&query=${destination}`;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <iframe
        title={`Map – ${label}`}
        src={preview}
        className="w-full bg-muted"
        style={{ height: 220 }}
        loading="lazy"
      />
      <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-3 py-2">
        <span className="truncate text-xs text-muted-foreground">{address}</span>
        <Button asChild size="sm" variant="secondary">
          <a href={directions} target="_blank" rel="noreferrer">
            <Navigation className="mr-1 h-3.5 w-3.5" /> Navigate
          </a>
        </Button>
      </div>
    </div>
  );
}
