import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Award,
  Bike,
  ChevronRight,
  FileText,
  Gift,
  Globe,
  Headphones,
  IndianRupee,
  LogOut,
  Mail,
  Phone,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Star,
  User,
  Video,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  AlertCircle,
  QrCode,
  ArrowRight,
  HelpCircle,
  Lock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePartner } from "@/hooks/usePartner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { INR } from "@/lib/delivery";

export const Route = createFileRoute("/partner/more")({
  component: PartnerMorePage,
  head: () => ({
    meta: [
      { title: "More & Account Hub | Local Shore Delivery Partner" },
      {
        name: "description",
        content:
          "Manage partner profile, floating cash, disputes, inbox alerts, insurance, documents, and fleet settings.",
      },
    ],
  }),
});

export function PartnerMorePage() {
  const { partner, refetch } = usePartner();
  const navigate = useNavigate();

  // Active modal dialogs
  const [activeDialog, setActiveDialog] = useState<
    | null
    | "profile"
    | "floating_cash"
    | "wrong_action"
    | "inbox"
    | "partner_club"
    | "insurance"
    | "meetings"
    | "support"
    | "gear"
    | "sessions"
    | "language"
    | "signout"
  >(null);

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({
    fullName: partner?.full_name || "Muhammed Hassan S",
    phone: partner?.phone || "+91 98401 23456",
    emergencyContact: partner?.emergency_contact_number || "112",
    vehicleNumber: partner?.vehicle_number || "TN 09 BK 4521",
    vehicleType: partner?.vehicle_type || "bike",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Wrong Action / Dispute Form
  const [disputeType, setDisputeType] = useState("False Late Penalty");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [disputesList, setDisputesList] = useState([
    {
      id: "DSP-1049",
      date: "Yesterday, 8:40 PM",
      reason: "Customer address wrong - cancellation fee disputed",
      status: "Resolved - ₹50 Refunded",
      statusColor: "text-emerald-500 bg-emerald-500/10",
    },
    {
      id: "DSP-1022",
      date: "3 Oct 2026",
      reason: "Heavy rain delay - late penalty dispute",
      status: "Approved & Waived",
      statusColor: "text-emerald-500 bg-emerald-500/10",
    },
  ]);

  // Inbox Notifications
  const [inboxMessages, setInboxMessages] = useState([
    {
      id: 1,
      title: "🔥 Higher Daily Incentive Offer Active",
      content:
        "Earn up to ₹815 extra today! Complete 15 trips to earn ₹405, 20 trips for ₹560, and 27 trips for ₹815.",
      time: "10m ago",
      read: false,
      tag: "Incentive",
    },
    {
      id: 2,
      title: "🌧️ Monsoon Rain Surge Active (+₹25/order)",
      content:
        "Rain surge is active in Anna Nagar, T. Nagar & Guindy. Extra ₹25 will be credited per delivered order.",
      time: "1h ago",
      read: false,
      tag: "Surge",
    },
    {
      id: 3,
      title: "💰 Weekly Payout Successfully Credited",
      content:
        "Your weekly payout of ₹8,420 for last week has been processed to your bank account ending in **9012.",
      time: "Yesterday",
      read: true,
      tag: "Payout",
    },
    {
      id: 4,
      title: "🌟 Congratulations on reaching Hero Tier!",
      content:
        "You have maintained > 95% on-time delivery rate. Enjoy priority order dispatch and fuel cashback.",
      time: "2 days ago",
      read: true,
      tag: "Reward",
    },
    {
      id: 5,
      title: "🛡️ Free Health & Accident Insurance Renewed",
      content:
        "Your ₹5,00,000 group health and accident coverage is active for the current quarter at no cost to you.",
      time: "3 days ago",
      read: true,
      tag: "Insurance",
    },
    {
      id: 6,
      title: "🛵 Electric Bike Rental Discount Available",
      content:
        "Switch to EV bike starting at just ₹149/day. Zero petrol costs and battery swap hubs across Chennai.",
      time: "4 days ago",
      read: true,
      tag: "Rentals",
    },
    {
      id: 7,
      title: "👥 Refer a Friend & Get ₹500 Bonus",
      content:
        "Invite fellow riders using your referral code. Earn ₹500 as soon as they complete 20 deliveries.",
      time: "5 days ago",
      read: true,
      tag: "Referral",
    },
    {
      id: 8,
      title: "🚦 Safety Reminder: Always Wear Your Helmet",
      content:
        "Your safety is our #1 priority. Keep helmet strapped and follow traffic signals at all times.",
      time: "6 days ago",
      read: true,
      tag: "Safety",
    },
    {
      id: 9,
      title: "📦 New Partner T-Shirts & Delivery Bags Ready",
      content:
        "Collect your new reflective monsoon kit from the nearest Local Shore partner hub.",
      time: "1 week ago",
      read: true,
      tag: "Gear",
    },
    {
      id: 10,
      title: "📞 24/7 Rider Helpline Upgraded",
      content:
        "Direct one-tap connection to partner care support is now available directly from the top bar.",
      time: "1 week ago",
      read: true,
      tag: "System",
    },
  ]);

  const [selectedLanguage, setSelectedLanguage] = useState("English");

  const unreadCount = inboxMessages.filter((m) => !m.read).length;

  const partnerIdStr = partner?.id
    ? `LS-${partner.id.slice(0, 6).toUpperCase()}`
    : "LS-784920";
  const partnerName = partner?.full_name || "Muhammed Hassan S";
  const initial = partnerName.charAt(0).toUpperCase();

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner?.id) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("delivery_partners")
        .update({
          full_name: profileForm.fullName,
          phone: profileForm.phone,
          emergency_contact_number: profileForm.emergencyContact,
          vehicle_number: profileForm.vehicleNumber,
          vehicle_type: profileForm.vehicleType,
          updated_at: new Date().toISOString(),
        })
        .eq("id", partner.id);

      if (error) throw error;
      toast.success("Profile updated successfully!");
      setActiveDialog(null);
      void refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDisputeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeDescription.trim()) {
      toast.error("Please enter a description for your dispute");
      return;
    }
    const newDispute = {
      id: `DSP-${Math.floor(1000 + Math.random() * 9000)}`,
      date: "Just now",
      reason: `${disputeType}: ${disputeDescription.slice(0, 45)}...`,
      status: "Under Review by Fleet Lead",
      statusColor: "text-amber-500 bg-amber-500/10",
    };
    setDisputesList([newDispute, ...disputesList]);
    setDisputeDescription("");
    toast.success("Dispute submitted! Fleet Lead will review within 4 hours.");
  };

  const markAllInboxAsRead = () => {
    setInboxMessages(inboxMessages.map((m) => ({ ...m, read: true })));
    toast.success("All messages marked as read");
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* 2-Column Responsive Layout on Desktop, Single Column on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ==================== LEFT COLUMN (lg:col-span-5 xl:col-span-4) ==================== */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-5">
          {/* Header Profile Card (Matching Reference Image 1) */}
          <div className="relative overflow-hidden rounded-3xl glass-card p-5 transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary via-purple-600 to-indigo-600 text-xl font-bold text-white shadow-glow">
                    {initial}
                  </div>
                  <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-card shadow-sm text-[10px]">
                    ✓
                  </span>
                </div>

                {/* Rider Details */}
                <div className="min-w-0">
                  <h1 className="text-lg font-bold tracking-tight text-foreground truncate">
                    {partnerName}
                  </h1>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-primary/90 font-mono tracking-tight">
                      DE ID: {partnerIdStr}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 font-medium text-amber-500">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {Number(partner?.rating || 4.98).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {partner?.phone || "+91 98401 23456"}
                  </p>
                </div>
              </div>

              {/* Hero Tier Badge (Interactive) */}
              <button
                type="button"
                onClick={() => setActiveDialog("partner_club")}
                className="group flex shrink-0 items-center gap-1 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-orange-500/15 px-3 py-2 text-xs font-bold text-amber-600 dark:text-amber-300 shadow-sm transition-transform active:scale-95 hover:border-amber-500/60"
              >
                <Award className="h-4 w-4 text-amber-500 transition-transform group-hover:scale-110" />
                <span>Hero &gt;</span>
              </button>
            </div>
          </div>

          {/* 4 Quick Action Cards Grid (2x2) - Matching Reference Image 1 */}
          <div className="grid grid-cols-2 gap-3">
            {/* 1. My Profile */}
            <button
              type="button"
              onClick={() => {
                setProfileForm({
                  fullName: partner?.full_name || "Muhammed Hassan S",
                  phone: partner?.phone || "+91 98401 23456",
                  emergencyContact: partner?.emergency_contact_number || "112",
                  vehicleNumber: partner?.vehicle_number || "TN 09 BK 4521",
                  vehicleType: partner?.vehicle_type || "bike",
                });
                setActiveDialog("profile");
              }}
              className="glass-card group relative flex flex-col items-start rounded-2xl p-4 text-left transition-all hover:border-primary/50 hover:shadow-glow active:scale-[0.98]"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground shadow-sm">
                <User className="h-5 w-5" />
              </div>
              <span className="mt-3 text-sm font-bold text-foreground">My Profile</span>
              <span className="text-[11px] text-muted-foreground">Details & Vehicle</span>
            </button>

            {/* 2. Floating Cash */}
            <button
              type="button"
              onClick={() => setActiveDialog("floating_cash")}
              className="glass-card group relative flex flex-col items-start rounded-2xl p-4 text-left transition-all hover:border-emerald-500/50 hover:shadow-glow active:scale-[0.98]"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-transform group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white shadow-sm">
                <IndianRupee className="h-5 w-5" />
              </div>
              <span className="mt-3 text-sm font-bold text-foreground">Floating Cash</span>
              <span className="text-[11px] text-muted-foreground">₹0 Collected · Limit ₹5k</span>
            </button>

            {/* 3. Wrong Action */}
            <button
              type="button"
              onClick={() => setActiveDialog("wrong_action")}
              className="glass-card group relative flex flex-col items-start rounded-2xl p-4 text-left transition-all hover:border-amber-500/50 hover:shadow-glow active:scale-[0.98]"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-transform group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white shadow-sm">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <span className="mt-3 text-sm font-bold text-foreground">Wrong Action</span>
              <span className="text-[11px] text-muted-foreground">Disputes & Penalty audit</span>
            </button>

            {/* 4. Inbox */}
            <button
              type="button"
              onClick={() => setActiveDialog("inbox")}
              className="glass-card group relative flex flex-col items-start rounded-2xl p-4 text-left transition-all hover:border-blue-500/50 hover:shadow-glow active:scale-[0.98]"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 transition-transform group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white shadow-sm">
                <Mail className="h-5 w-5" />
              </div>
              <div className="mt-3 flex items-center justify-between w-full">
                <span className="text-sm font-bold text-foreground">Inbox</span>
                {unreadCount > 0 ? (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white shadow-sm">
                    10+
                  </span>
                ) : null}
              </div>
              <span className="text-[11px] text-muted-foreground">Alerts & Incentives</span>
            </button>
          </div>

          {/* Desktop Footer Card */}
          <Card className="hidden lg:block rounded-3xl p-5 text-xs text-muted-foreground space-y-2">
            <p className="font-bold text-foreground text-sm">LocalShoree Partner Hub</p>
            <p>App Version 2.4.0 (Build 2026)</p>
            <p className="text-primary font-semibold">24x7 Partner Care: 1800-LOCAL-SHORE</p>
          </Card>
        </div>

        {/* ==================== RIGHT COLUMN (lg:col-span-7 xl:col-span-8) ==================== */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-5">
          {/* Menu List Rows (Matching Reference Image 1) */}
          <Card className="overflow-hidden rounded-3xl border-border/80 shadow-soft">
            <div className="divide-y divide-border/60">
              {/* Refer & Earn */}
              <button
                type="button"
                onClick={() => navigate({ to: "/partner/referral" })}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/60 active:bg-secondary"
              >
                <div className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Gift className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Refer & Earn</p>
                    <p className="text-xs text-muted-foreground">
                      Earn ₹500 for every friend referred
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    ₹17,250
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>

              {/* Partner Club */}
              <button
                type="button"
                onClick={() => setActiveDialog("partner_club")}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/60 active:bg-secondary"
              >
                <div className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Award className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Partner Club</p>
                    <p className="text-xs text-muted-foreground">
                      Hero Tier · Priority orders & perks
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 text-amber-600 dark:text-amber-300 bg-amber-500/10 text-[11px]"
                  >
                    Hero
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>

              {/* Insurance */}
              <button
                type="button"
                onClick={() => setActiveDialog("insurance")}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/60 active:bg-secondary"
              >
                <div className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Insurance</p>
                    <p className="text-xs text-muted-foreground">
                      ₹5,00,000 Group Medical & Accident Cover
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    Active
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>

              {/* Fleet Meetings */}
              <button
                type="button"
                onClick={() => setActiveDialog("meetings")}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/60 active:bg-secondary"
              >
                <div className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-purple-500/10 text-primary">
                    <Video className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Fleet Meetings</p>
                    <p className="text-xs text-muted-foreground">
                      Weekly rider briefings & safety sessions
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>

              {/* Help & Support */}
              <button
                type="button"
                onClick={() => setActiveDialog("support")}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/60 active:bg-secondary"
              >
                <div className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Headphones className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Help & Support</p>
                    <p className="text-xs text-muted-foreground">
                      24x7 Partner Care, Chat & Call support
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>

              {/* Vehicle Rentals */}
              <button
                type="button"
                onClick={() => navigate({ to: "/partner/rentals" })}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/60 active:bg-secondary"
              >
                <div className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <Bike className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Vehicle Rentals</p>
                    <p className="text-xs text-muted-foreground">
                      EV bikes & petrol scooters from ₹149/day
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                    Rentals
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>

              {/* Documents */}
              <button
                type="button"
                onClick={() => navigate({ to: "/partner/documents" })}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/60 active:bg-secondary"
              >
                <div className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Documents</p>
                    <p className="text-xs text-muted-foreground">
                      Aadhaar, Driving License, PAN, RC Book
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Verified ✓
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>

              {/* Delivery Gear & T-Shirts */}
              <button
                type="button"
                onClick={() => setActiveDialog("gear")}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/60 active:bg-secondary"
              >
                <div className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                    <ShoppingBag className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Delivery Gear</p>
                    <p className="text-xs text-muted-foreground">
                      Order official bags, t-shirts & raincoats
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>

              {/* Login History & Devices */}
              <button
                type="button"
                onClick={() => setActiveDialog("sessions")}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/60 active:bg-secondary"
              >
                <div className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-500/10 text-slate-600 dark:text-slate-400">
                    <Smartphone className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Login History & Devices</p>
                    <p className="text-xs text-muted-foreground">
                      Active sessions & security settings
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>

              {/* App Language */}
              <button
                type="button"
                onClick={() => setActiveDialog("language")}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/60 active:bg-secondary"
              >
                <div className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <Globe className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">App Language</p>
                    <p className="text-xs text-muted-foreground">{selectedLanguage}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>

              {/* Sign Out */}
              <button
                type="button"
                onClick={() => setActiveDialog("signout")}
                className="flex w-full items-center justify-between p-4 text-left text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-500/10 active:bg-rose-500/20"
              >
                <div className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <LogOut className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Sign Out</p>
                    <p className="text-xs text-rose-500/80">Log out from this device</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* App Version & Footer (Mobile) */}
      <div className="lg:hidden py-2 text-center text-xs text-muted-foreground">
        <p className="font-semibold text-foreground/80">LocalShoree Partner v2.4.0 (Build 2026)</p>
        <p className="mt-0.5">24x7 Emergency Partner Helpline: 1800-LOCAL-SHORE</p>
      </div>

      {/* ==================== DIALOGS & MODALS ==================== */}

      {/* 1. Profile Modal */}
      <Dialog open={activeDialog === "profile"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Partner Profile
            </DialogTitle>
            <DialogDescription>
              View and update your personal and vehicle registration details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="prof-name">Full Name</Label>
              <Input
                id="prof-name"
                value={profileForm.fullName}
                onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-phone">Mobile Phone</Label>
              <Input
                id="prof-phone"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prof-sos">Emergency Contact (SOS)</Label>
              <Input
                id="prof-sos"
                value={profileForm.emergencyContact}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, emergencyContact: e.target.value })
                }
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="prof-vnum">Vehicle Number</Label>
                <Input
                  id="prof-vnum"
                  value={profileForm.vehicleNumber}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, vehicleNumber: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prof-vtype">Vehicle Type</Label>
                <Input
                  id="prof-vtype"
                  value={profileForm.vehicleType}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, vehicleType: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-primary">DE ID: {partnerIdStr}</span> · Assigned
              Operating Zone: <strong>Chennai Central (Zone 4)</strong>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setActiveDialog(null)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save Profile"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Floating Cash Modal */}
      <Dialog
        open={activeDialog === "floating_cash"}
        onOpenChange={(o) => !o && setActiveDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-emerald-500" />
              Floating Cash Ledger
            </DialogTitle>
            <DialogDescription>
              Manage cash collected from customers during cash-on-delivery orders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
              <p className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300 font-semibold">
                Cash in Hand (To Deposit)
              </p>
              <p className="mt-1 text-3xl font-extrabold text-foreground">₹0.00</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your floating cash limit is <strong>₹5,000.00</strong>
              </p>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">How to deposit floating cash:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Deposit via UPI (GPay / PhonePe / Paytm) before reaching ₹5,000.</li>
                <li>Or visit any partner hub or cash drop kiosk by end of the day.</li>
                <li>Zero commission or deduction on floating cash deposits.</li>
              </ul>
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              onClick={() => {
                toast.success("No outstanding cash to deposit! You are clear to take orders.");
                setActiveDialog(null);
              }}
            >
              Deposit Cash via UPI
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. Wrong Action / Dispute Modal */}
      <Dialog
        open={activeDialog === "wrong_action"}
        onOpenChange={(o) => !o && setActiveDialog(null)}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Dispute & Wrong Action Audit
            </DialogTitle>
            <DialogDescription>
              Report wrongful penalties, inaccurate customer cancellations, or order disputes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <form onSubmit={handleDisputeSubmit} className="space-y-3 rounded-2xl border border-border bg-secondary/30 p-4">
              <p className="text-xs font-semibold text-foreground">Submit a New Dispute</p>
              <div className="space-y-1">
                <Label htmlFor="disp-type" className="text-xs">
                  Dispute Category
                </Label>
                <select
                  id="disp-type"
                  value={disputeType}
                  onChange={(e) => setDisputeType(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium"
                >
                  <option value="False Late Penalty">False Late Penalty (Traffic/Rain)</option>
                  <option value="Customer Address Unreachable">
                    Customer Unreachable / Cancelled
                  </option>
                  <option value="Merchant Delay">Merchant Prep Delay (&gt; 15 mins)</option>
                  <option value="GPS Distance Discrepancy">GPS Distance / Payout Mismatch</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="disp-desc" className="text-xs">
                  Explanation / Order ID
                </Label>
                <textarea
                  id="disp-desc"
                  rows={2}
                  placeholder="Explain what happened (e.g. order #ORD-123 had heavy waterlogging)..."
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <Button type="submit" size="sm" className="w-full font-semibold">
                Submit for Lead Review
              </Button>
            </form>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">Recent Dispute History</p>
              {disputesList.map((d) => (
                <div key={d.id} className="rounded-xl border border-border p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{d.id}</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${d.statusColor}`}>
                      {d.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{d.reason}</p>
                  <p className="text-[10px] text-muted-foreground/70">{d.date}</p>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. Inbox Modal */}
      <Dialog open={activeDialog === "inbox"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-500" />
                Partner Inbox ({inboxMessages.length})
              </DialogTitle>
              <DialogDescription>Important fleet updates and milestone alerts.</DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={markAllInboxAsRead}
              className="text-xs text-primary hover:text-primary"
            >
              Mark all read
            </Button>
          </DialogHeader>
          <div className="space-y-2.5 pt-2">
            {inboxMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-2xl border p-3.5 transition-colors text-xs ${
                  msg.read
                    ? "border-border/60 bg-card/60 opacity-80"
                    : "border-primary/40 bg-primary/5 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {!msg.read && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                    <span className="font-bold text-foreground">{msg.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                    {msg.time}
                  </span>
                </div>
                <p className="mt-1.5 text-muted-foreground leading-relaxed">{msg.content}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* 5. Partner Club Modal */}
      <Dialog
        open={activeDialog === "partner_club"}
        onOpenChange={(o) => !o && setActiveDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              Partner Club · Hero Tier
            </DialogTitle>
            <DialogDescription>
              Exclusive privileges earned by top-performing delivery partners.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent p-5 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-500 text-white shadow-glow">
                <Award className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-lg font-bold text-foreground">Hero Partner Tier</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Top 5% rider rating in Chennai
              </p>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2.5 rounded-xl border border-border p-2.5">
                <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">High-Value Order Priority</p>
                  <p className="text-muted-foreground">Get allocated orders &gt; ₹500 first</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-border p-2.5">
                <Bike className="h-4 w-4 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">₹2.00/Litre Petrol Cashback</p>
                  <p className="text-muted-foreground">Applicable across partner petrol pumps</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-border p-2.5">
                <Headphones className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Direct Priority Helpline</p>
                  <p className="text-muted-foreground">Zero waiting time to connect with support</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 6. Insurance Modal */}
      <Dialog open={activeDialog === "insurance"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-500" />
              Partner Health & Accident Cover
            </DialogTitle>
            <DialogDescription>
              Complimentary group medical coverage provided by Local Shore.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-foreground">Group Mediclaim</span>
                <span className="rounded-full bg-blue-500 text-white font-bold px-2 py-0.5 text-[10px]">
                  ACTIVE
                </span>
              </div>
              <p className="mt-2 text-xl font-black text-foreground">₹5,00,000 Sum Insured</p>
              <p className="mt-1 text-[11px] text-muted-foreground font-mono">
                Policy No: LS-GMC-2026-883492
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Insured Partner:</span>
                <span className="font-semibold text-foreground">{partnerName}</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Accidental Hospitalization:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  100% Cashless
                </span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">OPD Emergency Cover:</span>
                <span className="font-semibold text-foreground">Up to ₹25,000/yr</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-muted-foreground">Claims Helpline (24x7):</span>
                <span className="font-bold text-primary">1800-266-7788</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 7. Fleet Meetings Modal */}
      <Dialog open={activeDialog === "meetings"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Fleet Sync & Rider Training
            </DialogTitle>
            <DialogDescription>
              Join weekly digital meetings with the Chennai Fleet Captain.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Monsoon Safety & Peak Surge Sync</span>
                <Badge className="bg-primary text-white text-[10px]">Upcoming</Badge>
              </div>
              <p className="text-muted-foreground">
                Live Google Meet session covering surge incentives and rain gear distribution.
              </p>
              <div className="flex items-center gap-2 text-muted-foreground font-medium pt-1">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>Every Tuesday · 4:00 PM - 4:30 PM</span>
              </div>
            </div>
            <Button
              className="w-full font-semibold"
              onClick={() => {
                toast.success("Opening Google Meet link...");
                window.open("https://meet.google.com", "_blank");
              }}
            >
              <ExternalLink className="mr-1.5 h-4 w-4" /> Join Online Fleet Meeting
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 8. Help & Support Modal */}
      <Dialog open={activeDialog === "support"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-indigo-500" />
              Partner Care & Support
            </DialogTitle>
            <DialogDescription>
              We are here 24 hours a day to assist you with active deliveries and payments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  window.location.href = "tel:18002667788";
                }}
                className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-4 text-center hover:bg-secondary transition-colors"
              >
                <Phone className="h-6 w-6 text-emerald-500" />
                <span className="mt-2 font-bold text-foreground">Call Partner Care</span>
                <span className="text-[10px] text-muted-foreground">Toll-Free 24x7</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success("Opening in-app live chat...");
                }}
                className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-4 text-center hover:bg-secondary transition-colors"
              >
                <Mail className="h-6 w-6 text-blue-500" />
                <span className="mt-2 font-bold text-foreground">Live Chat</span>
                <span className="text-[10px] text-muted-foreground">Instant response</span>
              </button>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
              <p className="font-semibold">🚨 In Case of On-Road Emergency:</p>
              <p className="mt-0.5">
                Press the <strong>SOS</strong> button in the Home header or dial <strong>112</strong> immediately.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 9. Delivery Gear Modal */}
      <Dialog open={activeDialog === "gear"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-orange-500" />
              Delivery Gear & Merchandise
            </DialogTitle>
            <DialogDescription>
              Order original branded gear, thermal bags, and rain suits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 pt-2 text-xs">
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="font-bold text-foreground">Waterproof Insulated Delivery Bag (40L)</p>
                <p className="text-muted-foreground">Subsidized price: ₹499 (Original ₹1,200)</p>
              </div>
              <Button size="sm" onClick={() => toast.success("Order placed! Collect at Anna Nagar Hub.")}>
                Order
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="font-bold text-foreground">Partner Dry-Fit T-Shirts (Pack of 2)</p>
                <p className="text-muted-foreground">Subsidized price: ₹299 (Size L / XL)</p>
              </div>
              <Button size="sm" onClick={() => toast.success("Order placed! Collect at Anna Nagar Hub.")}>
                Order
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="font-bold text-foreground">Reflective Heavy Monsoon Raincoat</p>
                <p className="text-muted-foreground">Subsidized price: ₹349</p>
              </div>
              <Button size="sm" onClick={() => toast.success("Order placed! Collect at Anna Nagar Hub.")}>
                Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 10. Sessions Modal */}
      <Dialog open={activeDialog === "sessions"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-slate-500" />
              Active Login Sessions
            </DialogTitle>
            <DialogDescription>
              Manage devices authorized to access your rider account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">This Device (Current Session)</span>
                <span className="rounded-full bg-emerald-500 text-white px-2 py-0.5 text-[10px] font-bold">
                  ACTIVE
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">
                Chrome / Mobile Browser · Chennai, India · IP 157.48.xx.xx
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              onClick={() => {
                toast.success("Other device sessions terminated.");
                setActiveDialog(null);
              }}
            >
              Terminate All Other Device Sessions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 11. Language Modal */}
      <Dialog open={activeDialog === "language"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-violet-500" />
              Select App Language
            </DialogTitle>
            <DialogDescription>
              Choose your preferred interface language for deliveries and notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2 text-xs">
            {[
              { code: "en", name: "English (Default)" },
              { code: "ta", name: "தமிழ் (Tamil)" },
              { code: "hi", name: "हिन्दी (Hindi)" },
              { code: "te", name: "తెలుగు (Telugu)" },
              { code: "ml", name: "മലയാളം (Malayalam)" },
            ].map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setSelectedLanguage(lang.name);
                  toast.success(`Language updated to ${lang.name}`);
                  setActiveDialog(null);
                }}
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                  selectedLanguage.startsWith(lang.name.split(" ")[0])
                    ? "border-primary bg-primary/10 font-bold text-primary"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <span>{lang.name}</span>
                {selectedLanguage.startsWith(lang.name.split(" ")[0]) && (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* 12. Sign Out Confirmation Dialog */}
      <Dialog open={activeDialog === "signout"} onOpenChange={(o) => !o && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <LogOut className="h-5 w-5" />
              Confirm Sign Out
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out? You will not receive delivery requests while signed out.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setActiveDialog(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              onClick={handleSignOut}
            >
              Sign Out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
