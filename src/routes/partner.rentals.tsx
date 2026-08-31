import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Bike,
  Zap,
  BatteryCharging,
  ShieldCheck,
  MapPin,
  Clock,
  CheckCircle2,
  Calendar,
  Filter,
  Sparkles,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePartner } from "@/hooks/usePartner";
import { INR } from "@/lib/delivery";

export const Route = createFileRoute("/partner/rentals")({
  component: PartnerRentals,
  head: () => ({
    meta: [
      { title: "Rent Vehicle | Local Shore Delivery Partner" },
      {
        name: "description",
        content:
          "Rent EV scooters, bikes and commercial electric vehicles with zero downpayment and free battery swapping.",
      },
    ],
  }),
});

interface Vehicle {
  id: string;
  name: string;
  category: "ev" | "petrol" | "cargo";
  tag: string;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  rangeKm: string;
  speed: string;
  batterySwap: boolean;
  noLicenseNeeded: boolean;
  cargoCapacity: string;
  imageUrl: string;
  features: string[];
}

const VEHICLES: Vehicle[] = [
  {
    id: "v-yulu-wynn",
    name: "Yulu Wynn EV Express",
    category: "ev",
    tag: "Most Popular for City",
    dailyRate: 149,
    weeklyRate: 899,
    monthlyRate: 3299,
    rangeKm: "75 km / charge",
    speed: "25 km/h max",
    batterySwap: true,
    noLicenseNeeded: true,
    cargoCapacity: "35 kg front & rear rack",
    imageUrl: "⚡ EV Scooter",
    features: ["Unlimited Free Battery Swaps", "No Driving License Required", "Zero Maintenance Fee", "GPS Keyless Lock"],
  },
  {
    id: "v-ather-450s",
    name: "Ather 450S Commercial",
    category: "ev",
    tag: "High Performance EV",
    dailyRate: 249,
    weeklyRate: 1499,
    monthlyRate: 5499,
    rangeKm: "115 km / charge",
    speed: "90 km/h max",
    batterySwap: false,
    noLicenseNeeded: false,
    cargoCapacity: "50 kg Heavy Duty Carrier",
    imageUrl: "🏍️ Fast EV",
    features: ["Fast Charging (80% in 45 min)", "Turn-by-turn Navigation", "Regenerative Braking", "Insurance Included"],
  },
  {
    id: "v-hero-nyx",
    name: "Hero Electric NYX Dual-Battery",
    category: "ev",
    tag: "Extended Range",
    dailyRate: 199,
    weeklyRate: 1199,
    monthlyRate: 4399,
    rangeKm: "138 km / charge",
    speed: "42 km/h max",
    batterySwap: true,
    noLicenseNeeded: false,
    cargoCapacity: "60 kg Rear Box Carrier",
    imageUrl: "🔋 Dual Battery",
    features: ["Dual Removable Batteries", "Extra Wide Footboard", "Heavy Duty Suspension", "24/7 Roadside Assistance"],
  },
  {
    id: "v-tvs-xl100",
    name: "TVS XL100 Heavy Duty",
    category: "petrol",
    tag: "Heavy Goods Specialist",
    dailyRate: 179,
    weeklyRate: 1049,
    monthlyRate: 3899,
    rangeKm: "70 km/l Mileage",
    speed: "60 km/h max",
    batterySwap: false,
    noLicenseNeeded: false,
    cargoCapacity: "130 kg Payload capacity",
    imageUrl: "🛵 Cargo Moped",
    features: ["High Payload Capacity", "Detachable Back Seat", "Low Fuel Consumption", "Full Insurance Cover"],
  },
  {
    id: "v-eulor-hiload",
    name: "Euler HiLoad EV 3-Wheeler",
    category: "cargo",
    tag: "Bulk Grocery & Parcel EV",
    dailyRate: 399,
    weeklyRate: 2399,
    monthlyRate: 8499,
    rangeKm: "170 km / charge",
    speed: "45 km/h max",
    batterySwap: true,
    noLicenseNeeded: false,
    cargoCapacity: "680 kg Closed Cargo Container",
    imageUrl: "🛺 Cargo EV 3-Wheeler",
    features: ["680 kg Heavy Container", "Fast Charge in 15 mins", "Waterproof Container", "High Earnings Bonus"],
  },
];

const RENTAL_HUBS = [
  { id: "hub-1", name: "Central Hub — Sector 18 Tech Park", address: "Plot 42, Main Arterial Road" },
  { id: "hub-2", name: "Shoreline North — Beach Road Hub", address: "Opp. Metro Station Gate 3" },
  { id: "hub-3", name: "Airport Station Hub", address: "Freight Terminal Road" },
];

function PartnerRentals() {
  const { partner } = usePartner();
  const [filter, setFilter] = useState<string>("all");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [rentalPlan, setRentalPlan] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [selectedHub, setSelectedHub] = useState<string>(RENTAL_HUBS[0]?.id || "hub-1");
  const [bookingBusy, setBookingBusy] = useState(false);
  const [activeRental, setActiveRental] = useState<any | null>(null);

  const filteredVehicles = VEHICLES.filter((v) => {
    if (filter === "all") return true;
    return v.category === filter;
  });

  const getPrice = (v: Vehicle) => {
    if (rentalPlan === "daily") return v.dailyRate;
    if (rentalPlan === "weekly") return Math.round(v.weeklyRate / 7);
    return Math.round(v.monthlyRate / 30);
  };

  const getTotalCost = (v: Vehicle) => {
    if (rentalPlan === "daily") return v.dailyRate;
    if (rentalPlan === "weekly") return v.weeklyRate;
    return v.monthlyRate;
  };

  const handleBookVehicle = () => {
    if (!selectedVehicle) return;
    setBookingBusy(true);
    setTimeout(() => {
      setBookingBusy(false);
      const rental = {
        id: `RENT-${Date.now().toString().slice(-6)}`,
        vehicle: selectedVehicle,
        plan: rentalPlan,
        totalCost: getTotalCost(selectedVehicle),
        hub: RENTAL_HUBS.find((h) => h.id === selectedHub),
        startDate: new Date().toLocaleDateString(),
      };
      setActiveRental(rental);
      setSelectedVehicle(null);
      toast.success(`🎉 Rental confirmed! ${selectedVehicle.name} is reserved for pickup at ${rental.hub?.name}.`);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header Hero Banner */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-12 -bottom-16 h-56 w-56 rounded-full border-[24px] border-white/10" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
              <Zap className="h-3.5 w-3.5 text-yellow-300 fill-current" /> Zero Downpayment Rentals
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              EV & Bike Rentals for Delivery
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-white/80">
              No vehicle? No problem! Rent a high-range EV scooter or bike directly deducted from your weekly earnings with 24/7 battery swapping & free maintenance.
            </p>
          </div>
          <div className="flex flex-col gap-3 min-w-[210px] rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <Sparkles className="h-4 w-4" /> Partner Privileges
            </div>
            <p className="text-xs text-white/90 leading-tight">
              • Free unlimited battery swaps
              <br />
              • Zero security deposit required
              <br />• 24/7 roadside assistance
            </p>
          </div>
        </div>
      </section>

      {/* Active Rental Alert (if booked) */}
      {activeRental ? (
        <Card className="border-2 border-emerald-500 bg-emerald-500/10">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white text-xl font-bold">
                {activeRental.vehicle.imageUrl.split(" ")[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground">{activeRental.vehicle.name}</h3>
                  <Badge className="bg-emerald-600">Active Rental ({activeRental.plan})</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pickup Hub: {activeRental.hub?.name} · Started: {activeRental.startDate}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Rental Fee</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {INR(activeRental.totalCost)} / {activeRental.plan}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-500 text-emerald-700 hover:bg-emerald-500/10"
                onClick={() => toast.info("Show your Booking ID " + activeRental.id + " at the pickup hub.")}
              >
                View Pass
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Vehicle Category Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Tabs defaultValue="all" onValueChange={setFilter} className="w-full sm:w-auto">
          <TabsList className="bg-secondary/60 p-1">
            <TabsTrigger value="all" className="text-xs">All Vehicles</TabsTrigger>
            <TabsTrigger value="ev" className="text-xs">⚡ Electric (EV)</TabsTrigger>
            <TabsTrigger value="petrol" className="text-xs">🛵 Petrol Bikes</TabsTrigger>
            <TabsTrigger value="cargo" className="text-xs">🛺 Cargo 3-Wheelers</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3.5 w-3.5" /> All rentals include full vehicle insurance and maintenance.
        </p>
      </div>

      {/* Vehicle Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredVehicles.map((vehicle) => (
          <Card key={vehicle.id} className="overflow-hidden border-border/80 shadow-soft hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="relative bg-secondary/40 p-6 text-center border-b border-border/60">
                <div className="text-5xl my-2">{vehicle.imageUrl.split(" ")[0]}</div>
                <Badge variant="secondary" className="absolute top-3 right-3 text-[10px] font-semibold">
                  {vehicle.tag}
                </Badge>
                {vehicle.noLicenseNeeded ? (
                  <Badge className="absolute top-3 left-3 bg-indigo-600 text-[10px]">
                    No License Needed
                  </Badge>
                ) : null}
              </div>

              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold">{vehicle.name}</CardTitle>
                <CardDescription className="text-xs flex items-center gap-2">
                  <span>{vehicle.rangeKm}</span> • <span>{vehicle.speed}</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary/50 p-2.5">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Daily Rate</p>
                    <p className="font-bold text-foreground">{INR(vehicle.dailyRate)}/day</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Weekly Plan</p>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">{INR(vehicle.weeklyRate)}/week</p>
                  </div>
                </div>

                <ul className="space-y-1.5 text-muted-foreground">
                  {vehicle.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </div>

            <div className="p-4 pt-0">
              <Button
                onClick={() => setSelectedVehicle(vehicle)}
                className="w-full bg-primary hover:bg-primary/90 font-semibold"
              >
                Rent This Vehicle <Bike className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Booking Dialog */}
      <Dialog open={!!selectedVehicle} onOpenChange={(o) => (!o ? setSelectedVehicle(null) : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bike className="h-5 w-5 text-primary" /> Book Rental — {selectedVehicle?.name}
            </DialogTitle>
            <DialogDescription>
              Select your rental duration plan and nearest pickup hub.
            </DialogDescription>
          </DialogHeader>

          {selectedVehicle ? (
            <div className="space-y-5 py-2">
              {/* Duration Plan Picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Duration Plan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "daily", label: "Daily", rate: selectedVehicle.dailyRate },
                    { id: "weekly", label: "Weekly (15% off)", rate: selectedVehicle.weeklyRate },
                    { id: "monthly", label: "Monthly (30% off)", rate: selectedVehicle.monthlyRate },
                  ].map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setRentalPlan(plan.id as any)}
                      className={`rounded-xl border p-3 text-center transition-all ${
                        rentalPlan === plan.id
                          ? "border-primary bg-primary/10 font-bold text-primary"
                          : "border-border hover:bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      <p className="text-xs">{plan.label}</p>
                      <p className="text-sm mt-1">{INR(plan.rate)}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hub Picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Pickup Hub
                </label>
                <div className="space-y-2">
                  {RENTAL_HUBS.map((hub) => (
                    <div
                      key={hub.id}
                      onClick={() => setSelectedHub(hub.id)}
                      className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-all ${
                        selectedHub === hub.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-secondary/30"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-primary" /> {hub.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{hub.address}</p>
                      </div>
                      {selectedHub === hub.id ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary Box */}
              <div className="rounded-2xl bg-secondary/60 p-4 space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Rental plan rate ({rentalPlan})</span>
                  <span>{INR(getTotalCost(selectedVehicle))}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Security Deposit (Partner Waiver)</span>
                  <span className="text-emerald-600 font-semibold">₹0 (Waived)</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold text-sm text-foreground">
                  <span>Total Payable</span>
                  <span className="text-primary text-base">{INR(getTotalCost(selectedVehicle))}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  *Rental fee will be automatically settled from your weekly delivery payout.
                </p>
              </div>

              <Button
                onClick={handleBookVehicle}
                disabled={bookingBusy}
                className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold"
                size="lg"
              >
                {bookingBusy ? "Confirming Rental..." : `Confirm Rental (${INR(getTotalCost(selectedVehicle))})`}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
