import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Banknote, CalendarDays, CircleDollarSign, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/delivery/StatCard";
import { StatusBadge } from "@/components/delivery/StatusBadge";
import { db } from "@/lib/db";
import { usePartner } from "@/hooks/usePartner";
import { INR } from "@/lib/delivery";

export const Route = createFileRoute("/partner/earnings")({
  component: Earnings,
  head: () => ({
    meta: [
      { title: "Earnings & Payouts | Delivery Partner" },
      {
        name: "description",
        content:
          "See your lifetime earnings, pending balance and weekly payout history as a delivery partner.",
      },
      { property: "og:title", content: "Earnings & Payouts | Delivery Partner" },
      {
        property: "og:description",
        content: "Delivery earnings ledger and weekly payout settlements for riders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Earnings() {
  const { partner } = usePartner();
  const [earnings, setEarnings] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partner) return;
    (async () => {
      const [{ data: e }, { data: p }] = await Promise.all([
        db
          .from("delivery_earnings")
          .select("*")
          .eq("partner_id", partner.id)
          .order("created_at", { ascending: false })
          .limit(50),
        db
          .from("delivery_payouts")
          .select("*")
          .eq("partner_id", partner.id)
          .order("created_at", { ascending: false }),
      ]);
      setEarnings(e ?? []);
      setPayouts(p ?? []);
      setLoading(false);
    })();
  }, [partner?.id]);

  const total = earnings.reduce((t, r) => t + Number(r.amount ?? 0), 0);
  const paid = payouts
    .filter((p) => p.status === "paid")
    .reduce((t, r) => t + Number(r.amount ?? 0), 0);
  const pending = Math.max(0, total - paid);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] bg-secondary/60 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Money movement</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-3xl font-semibold tracking-tight text-foreground">Earnings & payouts</h1><p className="mt-2 text-sm text-muted-foreground">A clear view of every completed delivery and settlement.</p></div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" /> Weekly settlement cycle</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Lifetime earnings"
          value={INR(total)}
          icon={<Wallet className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard label="Paid out" value={INR(paid)} icon={<Banknote className="h-4 w-4" />} loading={loading} />
        <StatCard label="Pending balance" value={INR(pending)} hint="Settled weekly" icon={<CircleDollarSign className="h-4 w-4" />} loading={loading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Earnings ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {earnings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No earnings yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{new Date(e.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="capitalize">{String(e.type).replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-muted-foreground">{e.description}</TableCell>
                    <TableCell className="text-right font-medium">{INR(e.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Payouts are generated weekly once you have completed deliveries.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.period_start} → {p.period_end}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.reference ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} kind="plain" />
                    </TableCell>
                    <TableCell className="text-right font-medium">{INR(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
