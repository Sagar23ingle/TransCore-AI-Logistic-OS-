import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Truck, Map, Bell, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarInner } from "./Sidebar";

const ITEMS = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/vehicles", label: "Fleet", icon: Truck },
  { to: "/trips", label: "Trips", icon: Map },
  { to: "/alerts", label: "Alerts", icon: Bell },
] as const;

export function MobileBottomBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="grid h-14 grid-cols-5 px-1">
        {ITEMS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <li key={to}>
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
                    "grid h-7 w-11 place-items-center rounded-full transition-colors",
                    active && "bg-primary/12 text-primary",
                  )}
                >
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.25 : 1.75} />
                </span>
                <span className="leading-none tracking-tight">{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="relative mx-auto flex h-full w-full max-w-20 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground/70 transition-colors hover:text-foreground"
                aria-label="More navigation"
              >
                <span className="grid h-7 w-11 place-items-center rounded-full">
                  <MoreHorizontal className="h-[22px] w-[22px]" strokeWidth={1.75} />
                </span>
                <span className="leading-none tracking-tight">More</span>
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