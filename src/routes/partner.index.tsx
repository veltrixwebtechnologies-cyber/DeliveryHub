import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bike, Clock3, MapPin, Package, Star, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/delivery/StatCard";
import { EmptyState } from "@/components/delivery/AppShell";
import { StatusBadge } from "@/components/delivery/StatusBadge";
import { db } from "@/lib/db";
import { usePartner } from "@/hooks/usePartner";
import { ACTIVE_ASSIGNMENT_STATUSES, INR, pct } from "@/lib/delivery";
import { DELIVERY_ORDER_SELECT, normalizeAssignment } from "@/lib/shared-orders";

export const Route = createFileRoute("/partner/")({
  component: PartnerDashboard,
  head: () => ({ meta: [{ title: "Dashboard | LocalShoree Partners" }] }),
});

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function PartnerDashboard() {
  const { partner } = usePartner();
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState({ earnings: 0, deliveries: 0 });
  const [week, setWeek] = useState(0);
  const [active, setActive] = useState<any[]>([]);

  useEffect(() => {
    if (!partner) return;
    let cancelled = false;

    const load = async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [{ data: todays }, { data: weeks }, { data: act }] = await Promise.all([
        db.from("delivery_earnings").select("amount").eq("partner_id", partner.id).gte("created_at", todayStart()),
        db.from("delivery_earnings").select("amount").eq("partner_id", partner.id).gte("created_at", weekAgo),
        db.from("delivery_assignments").select(`*, orders(${DELIVERY_ORDER_SELECT})`).eq("partner_id", partner.id).in("status", ACTIVE_ASSIGNMENT_STATUSES),
      ]);
      const sum = (rows: any[] | null) => (rows ?? []).reduce((t, r) => t + Number(r.amount ?? 0), 0);
      if (cancelled) return;
      setToday({ earnings: sum(todays), deliveries: (todays ?? []).length });
      setWeek(sum(weeks));
      setActive((act ?? []).map(normalizeAssignment));
      setLoading(false);
    };

    void load();
    const refresh = window.setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, [partner?.id]);

  if (!partner) return null;

  const acceptance = pct(partner.accepted_requests ?? 0, partner.total_requests ?? 0);
  const onTime = pct((partner.total_deliveries ?? 0) - (partner.late_deliveries ?? 0), partner.total_deliveries ?? 0);
  const completion = pct(partner.total_deliveries ?? 0, (partner.total_deliveries ?? 0) + (partner.cancelled_deliveries ?? 0));
  const firstName = partner.full_name.split(" ")[0];
  const isBusy = active.length > 0;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-primary p-6 text-primary-foreground shadow-glow sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full border-[22px] border-white/10" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">Partner dashboard</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Good day, {firstName}.</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-primary-foreground/80">
              {isBusy
                ? "You are handling an active delivery. Finish it before receiving another request."
                : partner.availability === "online"
                  ? "You are visible to nearby shops. New delivery requests will appear instantly."
                  : "You are offline. Go online when you are ready to take the next local delivery."}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
            <span className={`h-2.5 w-2.5 rounded-full ${isBusy ? "bg-amber-300" : partner.availability === "online" ? "bg-emerald-300 shadow-[0_0_0_5px_rgba(110,231,183,0.15)]" : "bg-white/50"}`} />
            <div><p className="text-[11px] uppercase tracking-wider text-primary-foreground/60">Current status</p><p className="text-sm font-semibold">{isBusy ? "Busy on delivery" : partner.availability === "online" ? "Online and ready" : "Offline"}</p></div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's earnings" value={INR(today.earnings)} hint={`${today.deliveries} completed today`} icon={<Wallet className="h-4 w-4" />} loading={loading} />
        <StatCard label="Last 7 days" value={INR(week)} hint="Keep your streak going" icon={<TrendingUp className="h-4 w-4" />} loading={loading} />
        <StatCard label="Total deliveries" value={partner.total_deliveries ?? 0} hint="All-time completed" icon={<Package className="h-4 w-4" />} />
        <StatCard label="Partner rating" value={Number(partner.rating ?? 5).toFixed(2)} hint="Customer experience" icon={<Star className="h-4 w-4" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="overflow-hidden border-border/80 shadow-soft">
          <CardHeader className="flex-row items-start justify-between space-y-0 border-b border-border/70 bg-secondary/30">
            <div><CardTitle className="text-base">Your route today</CardTitle><p className="mt-1 text-sm text-muted-foreground">Stay focused on the next handoff.</p></div>
            <Button asChild variant="secondary" size="sm"><Link to="/partner/deliveries">View all <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
          </CardHeader>
          <CardContent className="p-5">
            {active.length === 0 ? <EmptyState title="No active delivery" description="Accepted requests will show the pickup, route and drop details here." action={<Button asChild size="sm"><Link to="/partner/deliveries">Open deliveries</Link></Button>} /> : (
              <div className="space-y-3">{active.slice(0, 3).map((a) => (
                <div key={a.id} className="group rounded-2xl border border-border p-4 transition-smooth hover-lift">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-foreground">{a.orders?.order_code ?? "Delivery request"}</p><p className="mt-1 text-sm text-muted-foreground">{a.orders?.vendors?.shop_name ?? "Local Shore shop"} to {a.orders?.customer_name ?? "Customer"}</p></div><StatusBadge status={a.status} /></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><Info icon={<MapPin className="h-3.5 w-3.5" />} label="Distance" value={`${Number(a.distance_km ?? 0).toFixed(1)} km`} /><Info icon={<Clock3 className="h-3.5 w-3.5" />} label="ETA" value="~30 min" /><Info icon={<Wallet className="h-3.5 w-3.5" />} label="Order total" value={INR(a.orders?.order_total ?? 0)} /><Info icon={<Wallet className="h-3.5 w-3.5" />} label="Earn" value={INR(a.estimated_earning ?? 0)} /></div>
                </div>
              ))}</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-soft">
          <CardHeader><CardTitle className="text-base">Performance pulse</CardTitle><p className="text-sm text-muted-foreground">Small improvements add up.</p></CardHeader>
          <CardContent className="space-y-5">
            <Metric label="Acceptance rate" value={acceptance} />
            <Metric label="On-time deliveries" value={onTime} />
            <Metric label="Completion rate" value={completion} />
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4"><MiniMetric label="Working hours" value="0h 00m" /><MiniMetric label="Distance covered" value="0.0 km" /></div>
          </CardContent>
        </Card>
      </div>

      <section><div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Quick actions</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Keep moving</h2></div></div><div className="grid gap-3 sm:grid-cols-3"><QuickAction to="/partner/deliveries" icon={<Package className="h-5 w-5" />} title="My deliveries" description="Pickup, navigate and complete" /><QuickAction to="/partner/earnings" icon={<Wallet className="h-5 w-5" />} title="Earnings" description="Ledger and payout history" /><QuickAction to="/partner/documents" icon={<Bike className="h-5 w-5" />} title="My documents" description="Keep verification up to date" /></div></section>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-xl bg-secondary/60 p-2.5"><div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span>{label}</span></div><p className="mt-1 font-semibold text-foreground">{value}</p></div>; }
function MiniMetric({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold text-foreground">{value}</p></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div><div className="flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className="font-semibold text-foreground">{value}%</span></div><Progress className="mt-2" value={value} /></div>; }
function QuickAction({ to, icon, title, description }: { to: string; icon: React.ReactNode; title: string; description: string }) { return <Link to={to} className="group rounded-2xl border border-border bg-card p-4 shadow-soft transition-smooth hover:-translate-y-1 hover:shadow-elegant"><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-secondary-foreground transition-smooth group-hover:bg-primary group-hover:text-primary-foreground">{icon}</span><p className="mt-4 font-semibold text-foreground">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></Link>; }
