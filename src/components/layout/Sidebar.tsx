import { Link, useRouterState } from "@tanstack/react-router";
import { type ComponentType, type ReactNode, useMemo } from "react";
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
  ScrollText,
  TrendingUp,
  FileBarChart,
  Boxes,
  Route as RouteIcon,
  Wallet,
  LineChart,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { isAdmin, canManageFleet } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }> };
type NavGroup = { id: string; label: string; icon: ComponentType<{ className?: string }>; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "fleet",
    label: "Fleet",
    icon: Boxes,
    items: [
      { to: "/vehicles", label: "Vehicles", icon: Truck },
      { to: "/drivers", label: "Drivers", icon: Users },
      { to: "/fuel", label: "Fuel", icon: Fuel },
      { to: "/maintenance", label: "Maintenance", icon: Wrench },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: RouteIcon,
    items: [
      { to: "/trips", label: "Trips", icon: Map },
      { to: "/tracking", label: "Live Tracking", icon: MapPin },
      { to: "/marketplace", label: "Load Marketplace", icon: Store },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    items: [
      { to: "/expenses", label: "Expenses", icon: Receipt },
      { to: "/executive", label: "Revenue", icon: TrendingUp },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    icon: LineChart,
    items: [
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/drivers-scoreboard", label: "Driver Performance", icon: Trophy },
      { to: "/executive", label: "Reports", icon: FileBarChart },
      { to: "/ai", label: "AI Assistant", icon: Sparkles },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: Shield,
    items: [
      { to: "/documents", label: "Documents", icon: FileText },
      { to: "/alerts", label: "Alerts", icon: Bell },
      { to: "/audit", label: "Audit Log", icon: ScrollText },
      { to: "/billing", label: "Billing", icon: CreditCard },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isItemActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(to + "/");
}

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
  const showExecutive = canManageFleet(roles);

  const groups = useMemo(() => {
    return NAV_GROUPS.map((g) => {
      let items = g.items;
      if (!showExecutive) items = items.filter((i) => i.to !== "/executive");
      if (g.id === "admin" && !showAdmin) items = items.filter((i) => i.to === "/settings");
      return { ...g, items };
    }).filter((g) => g.items.length > 0);
  }, [showAdmin, showExecutive]);

  const dashboardActive = isItemActive(pathname, "/dashboard");
  const openGroups = groups.filter((g) => g.items.some((i) => isItemActive(pathname, i.to))).map((g) => g.id);
  const defaultOpen = openGroups.length ? openGroups : ["fleet"];

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
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className={cn(
            "mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            dashboardActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>

        <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-1">
          {groups.map((group) => {
            const GroupIcon = group.icon;
            const groupActive = group.items.some((i) => isItemActive(pathname, i.to));
            return (
              <AccordionItem key={group.id} value={group.id} className="border-b-0">
                <AccordionTrigger
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:no-underline",
                    groupActive && "text-sidebar-foreground",
                  )}
                >
                  <span className="flex flex-1 items-center gap-2">
                    <GroupIcon className="h-3.5 w-3.5" />
                    {group.label}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-1 pt-1">
                  <div className="ml-2 space-y-0.5 border-l border-sidebar-border/50 pl-2">
                    {group.items.map((item) => {
                      const active = isItemActive(pathname, item.to);
                      const ItemIcon = item.icon;
                      return (
                        <Link
                          key={`${group.id}-${item.to}-${item.label}`}
                          to={item.to}
                          onClick={onNavigate}
                          className={cn(
                            "relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:-left-2.5 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary"
                              : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                          )}
                        >
                          <ItemIcon className="h-3.5 w-3.5" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {showAdmin && (
          <Link
            to="/admin"
            onClick={onNavigate}
            className={cn(
              "mt-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              pathname.startsWith("/admin")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Admin Panel</span>
          </Link>
        )}
      </nav>
    </div>
  );
}

// Silence unused-symbol warnings for shared ReactNode type import.
export type _SidebarNode = ReactNode;
