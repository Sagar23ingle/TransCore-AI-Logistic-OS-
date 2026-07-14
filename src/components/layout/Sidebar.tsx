import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  LayoutDashboard,
  Truck,
  Users,
  Map,
  Receipt,
  FileText,
  Bell,
  MapPin,
  Sparkles,
  CreditCard,
  Settings,
  ShieldCheck,
  Fuel,
  Wrench,
  Store,
  BarChart3,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { isAdmin } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tracking", label: "Live Tracking", icon: MapPin },
  { to: "/vehicles", label: "Vehicles", icon: Truck },
  { to: "/drivers", label: "Drivers", icon: Users },
  { to: "/trips", label: "Trips", icon: Map },
  { to: "/marketplace", label: "Load Marketplace", icon: Store },
  { to: "/fuel", label: "Fuel", icon: Fuel },
  { to: "/maintenance", label: "Maintenance", icon: Wrench },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/drivers-scoreboard", label: "Driver Scores", icon: Trophy },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/ai", label: "AI Assistant", icon: Sparkles },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <SidebarInner />
    </aside>
  );
}

export function SidebarInner({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { roles } = useAuth();
  const showAdmin = isAdmin(roles);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Truck className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight text-sidebar-foreground">TransCore AI</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Fleet OS</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        {showAdmin && (
          <>
            <div className="mt-4 px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Admin
            </div>
            <Link
              to="/admin"
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Admin Panel</span>
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}

// Silence unused-symbol warnings for shared ReactNode type import.
export type _SidebarNode = ReactNode;
