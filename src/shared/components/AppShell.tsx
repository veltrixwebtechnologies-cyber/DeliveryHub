import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bike, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type NavItem = { to: string; label: string; icon: ReactNode };

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
  const active = (item: NavItem) =>
    pathname === item.to || (item.to !== "/" && pathname.startsWith(`${item.to}/`));

  const navigation = (compact = false) => (
    <ul className={compact ? "flex justify-between gap-1" : "space-y-1"}>
      {nav.map((item) => (
        <li key={item.to} className={compact ? "min-w-0 flex-1" : undefined}>
          <Link
            to={item.to}
            onClick={() => setMenuOpen(false)}
            className={cn(
              "press flex items-center gap-3 text-sm font-medium transition-smooth",
              compact ? "flex-col gap-1 rounded-xl px-2 py-2 text-[11px]" : "rounded-2xl px-3 py-3",
              active(item)
                ? "bg-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "grid place-items-center",
                compact ? "h-5 w-5" : "h-8 w-8 rounded-xl bg-muted",
              )}
            >
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-border/70 bg-card/70 px-4 py-5 lg:block">
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
        <div className="mt-10 rounded-2xl border border-border bg-secondary/60 p-4">
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

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-border/70 bg-card/85 shadow-soft backdrop-blur-xl">
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
          <div className="fixed left-0 top-[61px] z-40 w-[min(86vw,320px)] border-r border-border bg-card p-4 shadow-elegant lg:hidden">
            <nav>{navigation()}</nav>
          </div>
        ) : null}
        <main className="animate-fade-up mx-auto max-w-6xl px-4 py-6 pb-24 lg:max-w-none lg:px-8">
          {children}
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/90 px-2 py-2 shadow-elegant backdrop-blur-xl lg:hidden">
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
