import { PhoneCall, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SafetyActions({ emergencyNumber }: { emergencyNumber?: string | null }) {
  const emergency = emergencyNumber?.replace(/[^+\d]/g, "");
  const triggerSos = () => {
    if (!window.confirm("Call emergency services (112)? Only use SOS for a real emergency."))
      return;
    window.location.href = "tel:112";
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-3">
      <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
      <span className="mr-auto text-xs text-muted-foreground">Need urgent help?</span>
      <Button type="button" size="sm" variant="destructive" onClick={triggerSos}>
        SOS 112
      </Button>
      {emergency ? (
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={`tel:${emergency}`}>
            <PhoneCall className="mr-1 h-3.5 w-3.5" /> Emergency contact
          </a>
        </Button>
      ) : null}
    </div>
  );
}
