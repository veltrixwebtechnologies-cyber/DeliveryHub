import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bike,
  ShieldCheck,
  Wallet,
  MapPin,
  Clock,
  PackageCheck,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Local Shore Delivery Partners — Ride, Deliver, Earn" },
      {
        name: "description",
        content:
          "Join Local Shore as a delivery partner. Pick up packed orders from neighbourhood shops, deliver nearby and get paid per delivery with weekly payouts.",
      },
      { property: "og:title", content: "Local Shore Delivery Partners — Ride, Deliver, Earn" },
      {
        property: "og:description",
        content:
          "Join Local Shore as a delivery partner. Pick up packed orders from neighbourhood shops, deliver nearby and get paid per delivery with weekly payouts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FLOW = [
  {
    icon: PackageCheck,
    title: "Vendor packs the order",
    body: "Shop owner picks, packs and marks the order ready for pickup.",
  },
  {
    icon: MapPin,
    title: "Nearest riders get pinged",
    body: "Only online, approved riders nearby receive the request.",
  },
  {
    icon: Clock,
    title: "First to accept wins",
    body: "Accept within the timeout and the pickup is locked to you.",
  },
  {
    icon: Wallet,
    title: "Deliver and earn",
    body: "Verify with the customer OTP, photo or signature and get credited.",
  },
];

const PERKS = [
  { icon: ShieldCheck, label: "Verified riders only" },
  { icon: Wallet, label: "Weekly payouts" },
  { icon: Clock, label: "Choose your shift" },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[72rem] -translate-x-1/2 bg-gradient-glow blur-2xl"
      />

      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow transition-smooth hover:scale-105">
            <Bike className="h-5 w-5" />
          </span>
          <span className="font-semibold tracking-tight text-foreground">Local Shore Partners</span>
          <div className="ml-auto flex gap-2">
            <Button asChild variant="ghost" size="sm" className="press">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="press shadow-soft hover:shadow-glow">
              <Link to="/register">Become a partner</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative">
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:pt-24">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary-foreground backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Delivery partner module
              </span>
              <h1
                className="animate-fade-up mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-6xl"
                style={{ animationDelay: "60ms" }}
              >
                Deliver for the shops in your own{" "}
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  neighbourhood.
                </span>
              </h1>
              <p
                className="animate-fade-up mt-5 max-w-lg text-base leading-relaxed text-muted-foreground"
                style={{ animationDelay: "120ms" }}
              >
                No dark stores. Orders come straight from local shop owners — you pick up once the
                shop marks it packed and ready, then drop it to the customer nearby.
              </p>
              <div
                className="animate-fade-up mt-8 flex flex-wrap gap-3"
                style={{ animationDelay: "180ms" }}
              >
                <Button asChild size="lg" className="group press shadow-elegant hover:shadow-glow">
                  <Link to="/register">
                    Start registration
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary" className="press hover:shadow-soft">
                  <Link to="/auth">I already have an account</Link>
                </Button>
              </div>
              <ul
                className="animate-fade-up mt-10 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3"
                style={{ animationDelay: "240ms" }}
              >
                {PERKS.map((perk) => (
                  <li
                    key={perk.label}
                    className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2 transition-smooth hover:border-primary/40 hover:text-foreground"
                  >
                    <perk.icon className="h-4 w-4 shrink-0 text-primary" />
                    {perk.label}
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="animate-fade-up animate-float-soft relative rounded-3xl border border-border bg-gradient-surface p-1 shadow-elegant"
              style={{ animationDelay: "200ms" }}
            >
              <div className="rounded-[1.4rem] bg-card/80 p-6 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  How a delivery runs
                </p>
                <ol className="mt-5 space-y-1">
                  {FLOW.map((step, i) => (
                    <li
                      key={step.title}
                      className="group flex gap-4 rounded-2xl p-3 transition-smooth hover:bg-secondary/70"
                    >
                      <div className="flex flex-col items-center">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft transition-smooth group-hover:scale-105 group-hover:shadow-glow">
                          <step.icon className="h-4 w-4" />
                        </span>
                        {i < FLOW.length - 1 ? (
                          <span className="mt-1 w-px flex-1 bg-border" />
                        ) : null}
                      </div>
                      <div className="pb-1">
                        <p className="text-sm font-semibold text-foreground">{step.title}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-gradient-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-8 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Local Shore</span>
          <Link to="/admin" className="ml-auto transition-smooth hover:text-foreground">
            Admin
          </Link>
          <Link to="/vendor" className="transition-smooth hover:text-foreground">
            Vendor console
          </Link>
        </div>
      </footer>
    </div>
  );
}
