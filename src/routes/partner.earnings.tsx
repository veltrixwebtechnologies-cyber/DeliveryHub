/* eslint-disable @typescript-eslint/no-explicit-any -- payout response typing is deferred with the payment workflow. */
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Banknote, CalendarDays, CircleDollarSign, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [wallet, setWallet] = useState<any | null>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partner) return;
    (async () => {
      const [{ data: e }, { data: p }, { data: w }, { data: wr }] = await Promise.all([
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
        db
          .from("delivery_wallets")
          .select("available_balance,pending_balance,settled_balance")
          .eq("partner_id", partner.id)
          .maybeSingle(),
        db
          .from("delivery_withdrawal_requests")
          .select("id,amount,status,requested_at")
          .eq("partner_id", partner.id)
          .order("requested_at", { ascending: false })
          .limit(20),
      ]);
      setEarnings(e ?? []);
      setPayouts(p ?? []);
      setWallet(w ?? null);
      setWithdrawals(wr ?? []);
      setLoading(false);
    })();
  }, [partner?.id]);

  async function requestWithdrawal() {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const available = Number(wallet?.available_balance ?? 0);
    if (amount > available) {
      toast.info(
        available > 0
          ? `You can request up to ${INR(available)} right now.`
          : "Your earnings are still pending settlement. Withdrawals will be enabled after settlement.",
      );
      return;
    }
    setWithdrawBusy(true);
    const { data, error } = await db.rpc("request_delivery_withdrawal", { _amount: amount });
    setWithdrawBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setWithdrawAmount("");
    setWithdrawals((current) => [
      { id: data, amount, status: "requested", requested_at: new Date().toISOString() },
      ...current,
    ]);
    toast.success("Withdrawal request submitted.");
  }

  const total = earnings.reduce((t, r) => t + Number(r.amount ?? 0), 0);
  const now = Date.now();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const periodTotal = (from: number) =>
    earnings
      .filter((row) => new Date(row.created_at).getTime() >= from)
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const daily = periodTotal(dayStart.getTime());
  const weekly = periodTotal(now - 7 * 86400000);
  const monthly = periodTotal(monthStart.getTime());
  const paid = payouts
    .filter((p) => p.status === "paid")
    .reduce((t, r) => t + Number(r.amount ?? 0), 0);
  const pending = Math.max(0, total - paid);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] bg-secondary/60 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Money movement
        </p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Earnings & payouts
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A clear view of every completed delivery and settlement.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" /> Weekly settlement cycle
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Lifetime earnings"
          value={INR(total)}
          icon={<Wallet className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Paid out"
          value={INR(paid)}
          icon={<Banknote className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Pending balance"
          value={INR(pending)}
          hint="Settled weekly"
          icon={<CircleDollarSign className="h-4 w-4" />}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wallet & withdrawals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="mt-1 font-semibold">{INR(wallet?.available_balance ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending settlement</p>
              <p className="mt-1 font-semibold">{INR(wallet?.pending_balance ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Settled</p>
              <p className="mt-1 font-semibold">{INR(wallet?.settled_balance ?? 0)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-48"
              type="number"
              min="1"
              step="0.01"
              max={wallet?.available_balance ?? 0}
              placeholder="Amount"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
            <Button
              type="button"
              onClick={() => void requestWithdrawal()}
              disabled={
                withdrawBusy ||
                !withdrawAmount ||
                Number(withdrawAmount) <= 0 ||
                Number(withdrawAmount) > Number(wallet?.available_balance ?? 0)
              }
            >
              {withdrawBusy ? "Requesting…" : "Request payout"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Only your available balance can be withdrawn. Pending earnings are settled weekly.
          </p>
          {withdrawals.length ? (
            <div className="divide-y divide-border rounded-lg border border-border text-sm">
              {withdrawals.slice(0, 5).map((w) => (
                <div key={w.id} className="flex items-center justify-between px-3 py-2">
                  <span>{new Date(w.requested_at ?? w.created_at).toLocaleDateString()}</span>
                  <span>
                    {INR(w.amount)} · <span className="capitalize">{w.status}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Today"
          value={INR(daily)}
          icon={<CircleDollarSign className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Last 7 days"
          value={INR(weekly)}
          icon={<CalendarDays className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="This month"
          value={INR(monthly)}
          icon={<Wallet className="h-4 w-4" />}
          loading={loading}
        />
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
                    <TableCell className="capitalize">
                      {String(e.type).replace(/_/g, " ")}
                    </TableCell>
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
