import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Truck, Map, Bell, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarInner } from "./Sidebar";

const ITEMS = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/vehicles", label: "Fleet", icon: Truck },
  null,
  { to: "/trips", label: "Trips", icon: Map },
  { to: "/alerts", label: "Alerts", icon: Bell },
] as const;

export function MobileBottomBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 lg:hidden"
    >
      <ul className="relative mx-auto grid h-16 max-w-md grid-cols-5 items-center rounded-[26px] border border-border/60 bg-card px-2 shadow-[var(--shadow-neo)]">
        {ITEMS.map((item, idx) => {
          if (!item) {
            return (
              <li key="fab" className="relative">
                <Link
                  to="/trips"
                  aria-label="New trip"
                  className="absolute left-1/2 -top-7 -translate-x-1/2 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-neo)] transition-transform active:scale-95"
                >
                  <Plus className="h-6 w-6" strokeWidth={2.5} />
                </Link>
              </li>
            );
          }
          const { to, label, icon: Icon } = item;
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <li key={to ?? idx}>
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative mx-auto flex h-full w-full max-w-20 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground/70 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full transition-all",
                    active
                      ? "bg-primary/15 text-primary shadow-[0_0_16px_-2px_var(--color-primary)]"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.25 : 1.75} />
                </span>
                <span className="sr-only">{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="relative mx-auto flex h-full w-full max-w-20 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="More navigation"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full">
                  <MoreHorizontal className="h-[22px] w-[22px]" strokeWidth={1.75} />
                </span>
                <span className="sr-only">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 border-sidebar-border bg-sidebar p-0">
              <SheetTitle className="sr-only">More navigation</SheetTitle>
              <SidebarInner onNavigate={() => setMoreOpen(false)} />
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}