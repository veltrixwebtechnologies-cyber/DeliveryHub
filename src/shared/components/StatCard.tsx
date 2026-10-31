import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCard({
  label,
  value,
  hint,
  icon,
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  loading?: boolean;
}) {
  return (
    <Card className="animate-fade-up hover-lift border-border/80 shadow-soft">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-24" />
          ) : (
            <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
          )}
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {icon ? (
          <span className="rounded-xl bg-secondary p-2 text-secondary-foreground shadow-soft transition-smooth">
            {icon}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
