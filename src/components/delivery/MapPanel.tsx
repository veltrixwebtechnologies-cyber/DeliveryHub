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
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <iframe
        title={`Map – ${label}`}
        src={osmEmbed(lat, lng)}
        className="w-full bg-muted"
        style={{ height }}
        loading="lazy"
      />
      <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-3 py-2">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <Button asChild size="sm" variant="secondary">
          <a href={osmDirections(from, [lat, lng])} target="_blank" rel="noreferrer">
            <Navigation className="mr-1 h-3.5 w-3.5" /> Navigate
          </a>
        </Button>
      </div>
    </div>
  );
}
