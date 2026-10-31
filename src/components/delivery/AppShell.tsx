import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bike, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: string | number;
  badgeClassName?: string;
};

export function AppShell({
  title,
  nav,
  right,
  children,
}: {
  title: string;
  nav: NavItem[];
  right?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const active = (item: NavItem) => {
    if (pathname === item.to) return true;
    if (item.to === "/partner/more") {
      if (
        pathname === "/partner/more" ||
        pathname.startsWith("/partner/documents") ||
        pathname.startsWith("/partner/rentals")
      ) {
        return true;
      }
    }
    const hasMoreSpecific = nav.some(
      (other) => other.to !== item.to && (pathname === other.to || pathname.startsWith(`${other.to}/`)),
    );
    if (hasMoreSpecific) return false;
    return item.to !== "/" && pathname.startsWith(`${item.to}/`);
  };

  const navigation = (compact = false) => (
    <ul className={compact ? "flex justify-between items-center gap-1 w-full" : "space-y-1"}>
      {nav.map((item) => {
        const isActive = active(item);
        return (
          <li key={item.to} className={compact ? "min-w-0 flex-1" : undefined}>
            <Link
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "press relative flex items-center transition-all duration-200 select-none",
                compact
                  ? "flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10.5px] font-semibold text-center"
                  : "gap-3 rounded-2xl px-3 py-3 text-sm font-medium",
                isActive
                  ? "bg-gradient-primary text-primary-foreground shadow-glow ring-1 ring-white/30 font-semibold"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <div className="relative">
                <span
                  className={cn(
                    "grid place-items-center transition-transform",
                    compact ? "h-6 w-6" : "h-8 w-8 rounded-xl bg-muted/60",
                    isActive && compact && "scale-110",
                  )}
                >
                  {item.icon}
                </span>
                {compact && item.badge ? (
                  <span
                    className={cn(
                      "absolute -top-1.5 -right-3.5 px-1 py-0.2 rounded-full text-[8.5px] font-bold leading-tight shadow-sm tracking-tight",
                      item.badgeClassName || "bg-emerald-500 text-white",
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span className="truncate max-w-[64px] tracking-tight">{item.label}</span>
              {!compact && item.badge ? (
                <span
                  className={cn(
                    "ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight shadow-sm",
                    item.badgeClassName || "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden lg:grid lg:grid-cols-[248px_1fr]">
      {/* Floating Animated Liquid Glow Orbs (Fluid chromatic depth behind all glass panels) */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
        <div className="animate-liquid-1 absolute -top-20 -left-20 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-fuchsia-500/35 via-purple-600/25 to-pink-500/20 blur-[85px] dark:from-fuchsia-600/40 dark:via-purple-700/30 dark:to-pink-600/25" />
        <div className="animate-liquid-2 absolute top-1/3 -right-24 h-[560px] w-[560px] rounded-full bg-gradient-to-bl from-cyan-400/35 via-teal-500/25 to-emerald-500/20 blur-[90px] dark:from-cyan-500/40 dark:via-teal-600/30 dark:to-emerald-600/25" />
        <div className="animate-liquid-3 absolute -bottom-24 left-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-indigo-500/30 via-violet-500/25 to-rose-400/20 blur-[100px] dark:from-indigo-600/35 dark:via-violet-700/30 dark:to-rose-600/25" />
      </div>

      <aside className="relative z-10 hidden border-r border-white/40 dark:border-white/10 glass-panel px-4 py-5 lg:block shadow-soft">
        <Link to="/" className="group flex items-center gap-3 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow transition-smooth group-hover:scale-105">
            <Bike className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-tight text-foreground">
              LocalShoree
            </span>
            <span className="block text-xs text-muted-foreground">Delivery Partner Hub</span>
          </span>
        </Link>
        <div className="mt-10 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Workspace
        </div>
        <nav className="mt-3">{navigation()}</nav>
        <div className="mt-10 rounded-2xl glass-card p-4">
          <p className="text-xs font-semibold text-foreground">Need a hand?</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Support is available while you are on a delivery.
          </p>
          <a
            className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline"
            href="mailto:support@localshoree.com"
          >
            Contact support
          </a>
        </div>
      </aside>

      <div className="relative z-10 min-w-0">
        <header className="sticky top-0 z-40 border-b border-white/30 dark:border-white/10 glass-dock shadow-soft">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 lg:max-w-none lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Open navigation"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link to="/" className="group flex items-center gap-2 lg:hidden">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft transition-smooth group-hover:scale-105">
                <Bike className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold tracking-tight text-foreground">{title}</span>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              {right}
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/";
                }}
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only sm:ml-1">Sign out</span>
              </Button>
            </div>
          </div>
        </header>
        {menuOpen ? (
          <div
            className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
        ) : null}
        {menuOpen ? (
          <div className="fixed left-0 top-[61px] z-40 w-[min(86vw,320px)] border-r border-white/20 dark:border-white/10 glass-panel p-4 shadow-elegant lg:hidden">
            <nav>{navigation()}</nav>
          </div>
        ) : null}
        <main className="animate-fade-up mx-auto max-w-6xl px-4 py-6 pb-28 lg:max-w-none lg:px-8">
          {children}
        </main>
        <nav className="fixed inset-x-3 bottom-3 z-40 glass-dock rounded-2xl px-2 py-2 shadow-2xl lg:hidden">
          {navigation(true)}
        </nav>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="animate-fade-up rounded-2xl border border-dashed border-border bg-gradient-surface px-6 py-14 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
