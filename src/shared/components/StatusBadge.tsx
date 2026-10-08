import { Badge } from "@/components/ui/badge";
import { ASSIGNMENT_STATUS_LABEL, ORDER_STATUS_LABEL, PARTNER_STATUS_LABEL } from "@/lib/delivery";

const TONE: Record<string, string> = {
  approved: "bg-emerald-600 text-white font-medium",
  verified: "bg-emerald-600 text-white font-medium",
  delivered: "bg-emerald-600 text-white font-medium",
  online: "bg-emerald-600 text-white font-medium",
  pending:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-medium",
  pending_verification:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-medium",
  under_review:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-medium",
  info_requested:
    "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-medium",
  ready_for_pickup: "bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium",
  break: "bg-secondary text-secondary-foreground",
  rejected: "bg-destructive text-destructive-foreground font-medium",
  cancelled: "bg-destructive text-destructive-foreground font-medium",
  suspended: "bg-destructive text-destructive-foreground font-medium",
  expired: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-medium",
  offline: "bg-muted text-muted-foreground",
  draft: "bg-muted text-muted-foreground",
};

const PLAIN_LABELS: Record<string, string> = {
  pending: "Pending Review",
  pending_verification: "Pending Review",
  under_review: "Under Review",
  approved: "Approved",
  verified: "Verified",
  rejected: "Rejected",
  missing: "Missing",
  expired: "Expired",
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
          : (PLAIN_LABELS[status] ?? status);

  return (
    <Badge className={TONE[status] ?? "bg-accent text-accent-foreground"} variant="secondary">
      {label}
    </Badge>
  );
}
