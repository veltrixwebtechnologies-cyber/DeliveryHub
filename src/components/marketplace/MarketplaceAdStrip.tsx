import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

type Campaign = {
  title: string;
  description: string;
  image: string;
  alt: string;
  className: string;
};

const CAMPAIGNS: Campaign[] = [
  {
    title: "Pharmacy at your doorstep!",
    description: "Everyday wellness essentials delivered nearby",
    image: "/marketplace-ads/pharmacy.png",
    alt: "Wellness and pharmacy products",
    className: "bg-[#16b9bd] text-white",
  },
  {
    title: "Pet care supplies at your door",
    description: "Food, treats, toys & more",
    image: "/marketplace-ads/pet-care.png",
    alt: "Dog, cat and pet care supplies",
    className: "bg-[#ffc52e] text-[#2d2b23]",
  },
  {
    title: "No time for a diaper run?",
    description: "Get baby care essentials delivered",
    image: "/marketplace-ads/baby-care.png",
    alt: "Parent caring for a baby with baby care products",
    className: "bg-[#dbe8f2] text-[#263442]",
  },
];

const FEATURED_CAMPAIGNS: Campaign[] = [
  {
    title: "Daily essentials, picked nearby",
    description: "Produce, staples and dairy from approved neighborhood sellers.",
    image: "/marketplace-ads/groceries-hero.png",
    alt: "Fresh vegetables, fruit, eggs and milk",
    className: "bg-[#fff2c9] text-[#3f0d35]",
  },
  {
    ...CAMPAIGNS[0]!,
    title: "Wellness delivered to your door",
    description: "Cough syrups, personal care and everyday pharmacy essentials.",
  },
  {
    ...CAMPAIGNS[1]!,
    title: "Everything your pet needs",
    description: "Food, treats, toys and care essentials from local sellers.",
  },
  {
    ...CAMPAIGNS[2]!,
    title: "Baby care, right when you need it",
    description: "Diapers, bath care and gentle essentials delivered nearby.",
  },
];

function CampaignLink({ label = "Order Now", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg bg-white px-3.5 py-2 text-sm font-bold text-slate-900 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function MarketplaceAdStrip() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % FEATURED_CAMPAIGNS.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, []);

  const featured = FEATURED_CAMPAIGNS[activeSlide]!;

  return (
    <section
      aria-labelledby="marketplace-promotions-title"
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12"
    >
      <h2 id="marketplace-promotions-title" className="sr-only">
        Marketplace promotions
      </h2>

      <div
        className={cn(
          "group relative grid overflow-hidden rounded-3xl shadow-soft transition-colors lg:grid-cols-[0.85fr_1.15fr]",
          featured.className,
        )}
      >
        <div className="flex min-h-[19rem] flex-col items-start justify-center px-7 py-9 sm:px-10 lg:min-h-[21rem]">
          <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
            Featured offer · delivered locally
          </span>
          <p className="mt-5 max-w-md text-3xl font-bold leading-[1.06] tracking-tight sm:text-4xl">
            {featured.title}
          </p>
          <p className="mt-3 max-w-md text-base leading-relaxed opacity-75">
            {featured.description}
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex rounded-lg bg-[#a96b00] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Explore offer
          </Link>
        </div>
        <div className="relative min-h-[15rem] overflow-hidden lg:min-h-[21rem]">
          <img
            src={featured.image}
            alt={featured.alt}
            className="absolute inset-0 h-full w-full object-cover object-right transition-transform duration-700 group-hover:scale-[1.03]"
            loading="eager"
          />
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-black/10 to-transparent" />
          <div
            className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-white/85 px-2.5 py-2 shadow-sm"
            aria-label="Featured campaigns"
          >
            {FEATURED_CAMPAIGNS.map((campaign, index) => (
              <button
                key={campaign.title}
                type="button"
                aria-label={`Show campaign ${index + 1}`}
                aria-current={activeSlide === index ? "true" : undefined}
                onClick={() => setActiveSlide(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  activeSlide === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Previous campaign"
            onClick={() =>
              setActiveSlide(
                (activeSlide - 1 + FEATURED_CAMPAIGNS.length) % FEATURED_CAMPAIGNS.length,
              )
            }
            className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-foreground shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next campaign"
            onClick={() => setActiveSlide((activeSlide + 1) % FEATURED_CAMPAIGNS.length)}
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-foreground shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {CAMPAIGNS.map((campaign) => (
          <Link
            key={campaign.title}
            to="/auth"
            aria-label={`Explore ${campaign.title}`}
            className={cn(
              "group overflow-hidden rounded-2xl border border-black/5 bg-card shadow-soft transition-shadow hover:shadow-elegant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              campaign.className,
            )}
          >
            <div className="relative h-36 overflow-hidden sm:h-40">
              <img
                src={campaign.image}
                alt={campaign.alt}
                className="h-full w-full object-cover object-right transition-transform duration-700 group-hover:scale-[1.05]"
                loading="lazy"
              />
            </div>
            <div className="flex items-end justify-between gap-3 p-4 text-foreground sm:p-5">
              <div>
                <h3 className="text-lg font-bold leading-tight tracking-tight">{campaign.title}</h3>
                <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
                  {campaign.description}
                </p>
              </div>
              <CampaignLink className="shrink-0 bg-foreground px-3 py-2 text-xs text-background hover:bg-foreground/90" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
