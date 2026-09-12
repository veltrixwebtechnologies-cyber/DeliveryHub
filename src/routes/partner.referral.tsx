import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Gift,
  Copy,
  Share2,
  CheckCircle2,
  Users,
  Award,
  ArrowRight,
  TrendingUp,
  Sparkles,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/delivery/StatCard";
import { usePartner } from "@/hooks/usePartner";
import { INR } from "@/lib/delivery";

export const Route = createFileRoute("/partner/referral")({
  component: PartnerReferral,
  head: () => ({
    meta: [
      { title: "Refer & Earn | Local Shore Delivery Partner" },
      {
        name: "description",
        content:
          "Invite friends to become Local Shore delivery partners and earn up to ₹1,000 bonus per partner.",
      },
    ],
  }),
});

function PartnerReferral() {
  const { partner } = usePartner();
  const [copied, setCopied] = useState(false);

  const partnerCode = partner?.id
    ? `LS-PARTNER-${partner.id.slice(0, 6).toUpperCase()}`
    : "LS-PARTNER-7890";
  const referralLink = `https://localshore.app/register?ref=${partnerCode}`;

  const mockReferrals = [
    {
      id: "ref-1",
      name: "Rahul Sharma",
      mobile: "+91 98****1234",
      date: "2026-08-20",
      status: "Bonus Claimed",
      deliveries: "24/20 completed",
      earned: 500,
    },
    {
      id: "ref-2",
      name: "Priya Patel",
      mobile: "+91 97****5678",
      date: "2026-08-25",
      status: "In Progress",
      deliveries: "14/20 completed",
      earned: 0,
    },
    {
      id: "ref-3",
      name: "Ankit Kumar",
      mobile: "+91 99****8901",
      date: "2026-08-28",
      status: "Registered",
      deliveries: "2/20 completed",
      earned: 0,
    },
  ];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(partnerCode);
    setCopied(true);
    toast.success("Referral code copied to clipboard!");
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied!");
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Join Local Shore as a Delivery Partner and earn flexible income with daily/weekly payouts! Use my referral code *${partnerCode}* or click to sign up: ${referralLink}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-60 w-60 rounded-full border-[30px] border-white/10" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
              <Gift className="h-3.5 w-3.5 text-amber-300" /> Refer & Earn Program
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Earn ₹500 Bonus per Friend!
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-white/80">
              Invite delivery partners to join Local Shore. You both get a cash bonus as soon as
              your friend completes 20 successful deliveries!
            </p>
          </div>
          <div className="flex flex-col gap-2 min-w-[200px]">
            <Button
              onClick={handleShareWhatsApp}
              size="lg"
              className="bg-emerald-400 text-emerald-950 font-bold hover:bg-emerald-300 shadow-md"
            >
              <MessageSquare className="mr-2 h-5 w-5 fill-current" /> Share on WhatsApp
            </Button>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Referral Earnings"
          value={INR(1500)}
          hint="Directly credited to wallet"
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
        />
        <StatCard
          label="Total Invited"
          value={3}
          hint="Friends signed up"
          icon={<Users className="h-4 w-4 text-blue-500" />}
        />
        <StatCard
          label="Active Partners"
          value={2}
          hint="Currently delivering"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        />
        <StatCard
          label="Pending Rewards"
          value={INR(500)}
          hint="Completion in progress"
          icon={<Award className="h-4 w-4 text-amber-500" />}
        />
      </div>

      {/* Referral Code & Share Card */}
      <Card className="border-border/80 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Your Exclusive Referral Details
          </CardTitle>
          <CardDescription>
            Share your unique code or link with friends who want to deliver with Local Shore.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Code Box */}
            <div className="rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 p-4 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Your Referral Code
                </p>
                <p className="mt-2 text-2xl font-mono font-bold tracking-widest text-emerald-600 dark:text-emerald-400">
                  {partnerCode}
                </p>
              </div>
              <Button
                onClick={handleCopyCode}
                variant="outline"
                size="sm"
                className="mt-4 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-1.5 h-4 w-4 text-emerald-500" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-4 w-4" /> Copy Referral Code
                  </>
                )}
              </Button>
            </div>

            {/* Link Box */}
            <div className="rounded-2xl border border-border bg-secondary/30 p-4 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Your Direct Link
                </p>
                <p className="mt-2 truncate font-mono text-sm text-foreground bg-background p-2 rounded-lg border">
                  {referralLink}
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={handleCopyLink} variant="secondary" size="sm" className="flex-1">
                  <Copy className="mr-1.5 h-4 w-4" /> Copy Link
                </Button>
                <Button
                  onClick={handleShareWhatsApp}
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Share2 className="mr-1.5 h-4 w-4" /> Share
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="border-border/80 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">How Referral Rewards Work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border p-4 space-y-2 bg-card">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
                1
              </div>
              <h3 className="font-semibold text-foreground">Share Referral Link</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Send your unique code or registration link to potential delivery partners via
                WhatsApp or SMS.
              </p>
            </div>
            <div className="rounded-2xl border border-border p-4 space-y-2 bg-card">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                2
              </div>
              <h3 className="font-semibold text-foreground">Friend Registers</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your friend completes registration with documents, vehicle details, and preferred
                delivery zone.
              </p>
            </div>
            <div className="rounded-2xl border border-border p-4 space-y-2 bg-card">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-sm">
                3
              </div>
              <h3 className="font-semibold text-foreground">Get ₹500 Wallet Credit</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Once they complete 20 deliveries, ₹500 cash bonus is instantly added to your payout
                balance!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral History Table */}
      <Card className="border-border/80 shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Your Referrals</CardTitle>
            <CardDescription>Status of delivery partners who used your link</CardDescription>
          </div>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            3 Invites Active
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {mockReferrals.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 bg-card hover:bg-secondary/20 transition-colors"
              >
                <div className="space-y-1">
                  <p className="font-semibold text-foreground text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.mobile} · Joined {item.date}
                  </p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-left sm:text-right">
                    <p className="text-xs font-medium text-foreground">{item.deliveries}</p>
                    <p className="text-[11px] text-muted-foreground">{item.status}</p>
                  </div>
                  <Badge
                    variant={item.earned > 0 ? "default" : "secondary"}
                    className={item.earned > 0 ? "bg-emerald-600 text-white" : ""}
                  >
                    {item.earned > 0 ? `+${INR(item.earned)}` : "Pending"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
