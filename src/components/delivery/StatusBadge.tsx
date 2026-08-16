import { Badge } from "@/components/ui/badge";
import { ASSIGNMENT_STATUS_LABEL, ORDER_STATUS_LABEL, PARTNER_STATUS_LABEL } from "@/lib/delivery";

const TONE: Record<string, string> = {
  approved: "bg-primary text-primary-foreground",
  delivered: "bg-primary text-primary-foreground",
  online: "bg-primary text-primary-foreground",
  pending_verification: "bg-secondary text-secondary-foreground",
  info_requested: "bg-secondary text-secondary-foreground",
  ready_for_pickup: "bg-secondary text-secondary-foreground",
  break: "bg-secondary text-secondary-foreground",
  rejected: "bg-destructive text-destructive-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
  suspended: "bg-destructive text-destructive-foreground",
  expired: "bg-muted text-muted-foreground",
  offline: "bg-muted text-muted-foreground",
  draft: "bg-muted text-muted-foreground",
};

export function StatusBadge({
  status,
  kind = "assignment",
}: {
  status: string;
  kind?: "assignment" | "order" | "partner" | "plain";
}) {
  const label =
    kind === "order"
      ? (ORDER_STATUS_LABEL[status] ?? status)
      : kind === "partner"
        ? (PARTNER_STATUS_LABEL[status] ?? status)
        : kind === "assignment"
          ? (ASSIGNMENT_STATUS_LABEL[status] ?? status)
          : status;

  return (
    <Badge className={TONE[status] ?? "bg-accent text-accent-foreground"} variant="secondary">
      {label}
    </Badge>
  );
}
