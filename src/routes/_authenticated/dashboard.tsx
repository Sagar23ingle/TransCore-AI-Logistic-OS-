import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { motion } from "motion/react";
import {
  Truck, Users, Map as MapIcon, IndianRupee, Fuel, AlertTriangle, Bell,
  Plus, FileText, Receipt, Sparkles, ChevronRight, CheckCircle2, Circle,
  TrendingUp, TrendingDown, Gauge, MessageSquare, Calendar, Clock,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardStats } from "@/lib/dashboard.functions";
import { getDailyOps, type DailyOps } from "@/lib/daily-ops.functions";
import { getHomeExtras, type HomeExtras } from "@/lib/home.functions";
import { recomputeAlerts } from "@/lib/alerts.functions";
import { getFleetLive } from "@/lib/gps.functions";
import { GoogleMapView } from "@/components/tracking/GoogleMap";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatINR, formatNumber } from "@/lib/format";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const FleetInsightsCards = lazy(() =>
  import("@/components/dashboard/FleetInsightsCards").then((m) => ({ default: m.FleetInsightsCards })),
);
const FuelLevelGauges = lazy(() =>
  import("@/components/dashboard/FuelLevelGauges").then((m) => ({ default: m.FuelLevelGauges })),
);

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

// Fixed premium palette — consistent across light/dark, evokes each fuel type.
const FUEL_COLORS: Record<string, { from: string; to: string; solid: string; label: string }> = {
  diesel:   { from: "#22c55e", to: "#15803d", solid: "#16a34a", label: "Diesel" },
  petrol:   { from: "#fbbf24", to: "#ea580c", solid: "#f59e0b", label: "Petrol" },
  cng:      { from: "#38bdf8", to: "#1d4ed8", solid: "#3b82f6", label: "CNG" },
  electric: { from: "#a78bfa", to: "#7c3aed", solid: "#8b5cf6", label: "Electric" },
  other:    { from: "#94a3b8", to: "#475569", solid: "#64748b", label: "Other" },
};

function greetingFor(hour: number) {
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good Night";
}

function Dashboard() {
  const statsFn = useServerFn(getDashboardStats);
  const dailyFn = useServerFn(getDailyOps);
  const homeFn = useServerFn(getHomeExtras);
  const recompute = useServerFn(recomputeAlerts);
  const qc = useQueryClient();
  const { user } = useAuth();

  const stats = useQuery(queryOptions({ queryKey: ["dashboard-stats"], queryFn: () => statsFn(), staleTime: 60_000 }));
  const daily = useQuery(queryOptions({ queryKey: ["dashboard-daily-ops"], queryFn: () => dailyFn(), staleTime: 60_000 }));
  const extras = useQuery(queryOptions({ queryKey: ["dashboard-home-extras"], queryFn: () => homeFn(), staleTime: 60_000 }));

  useEffect(() => {
    // Throttle server-side alert recomputation: at most once per 5 minutes
    // per user. Prior behaviour fired on every dashboard mount, which was the
    // #1 slow-query hotspot (168 calls · ~900ms total, ~168 alert upserts).
    if (typeof window === "undefined") return;
    const uid = (user?.id ?? "anon") as string;
    const key = `tc.alerts.recompute.at:${uid}`;
    const last = Number(window.localStorage.getItem(key) ?? "0");
    if (Date.now() - last < 5 * 60_000) return;
    window.localStorage.setItem(key, String(Date.now()));
    recompute()
      .then(() => qc.invalidateQueries({ queryKey: ["alerts"] }))
      .catch(() => { window.localStorage.removeItem(key); });
  }, [recompute, qc, user?.id]);

  return (
    <AppShell>
      <div className="space-y-2 sm:space-y-6">
        <WelcomeHeader daily={daily.data} loading={daily.isLoading} />

        <KpiRow stats={stats.data} daily={daily.data} extras={extras.data} loading={stats.isLoading} />

        {/* Mobile: Quick Actions first for one-tap access */}
        <div className="lg:hidden">
          <QuickActions />
        </div>

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FleetOverview daily={daily.data} loading={daily.isLoading} />
          </div>
          <FuelSummary extras={extras.data} loading={extras.isLoading} />
        </div>

        <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
          <FuelLevelGauges />
        </Suspense>

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3 sm:space-y-4">
            <AlertsPanel daily={daily.data} loading={daily.isLoading} />
            <AIInsightsSection daily={daily.data} loading={daily.isLoading} />
            <RecentTrips extras={extras.data} loading={extras.isLoading} />
          </div>
          <div className="hidden lg:block space-y-4">
            <QuickActions />
          </div>
        </div>

        {daily.data && !daily.data.onboarding.hasVehicles && <OnboardingCard daily={daily.data} />}
      </div>
    </AppShell>
  );
}

/* ---------- Welcome Header ---------- */
function WelcomeHeader({ daily: _daily, loading: _loading }: { daily?: DailyOps; loading: boolean }) {
  const { profile } = useProfile();
  const { user } = useAuth();
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    // Align to the next full second, then tick every second.
    const align = 1000 - (Date.now() % 1000);
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 1000);
    }, align);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  const locale = typeof navigator !== "undefined" ? navigator.language : undefined;
  const dateLabel = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeLabel = now.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });

  const rawName =
    (profile?.full_name && profile.full_name.trim()) ||
    ((user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name) ||
    ((user?.user_metadata as { full_name?: string; name?: string } | undefined)?.name) ||
    "";
  const firstName = rawName ? rawName.trim().split(/\s+/)[0] : "";
  const heading = firstName ? `${greetingFor(now.getHours())}, ${firstName}! 👋` : "Welcome! 👋";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-2.5 sm:p-6"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl sm:-right-16 sm:-top-16 sm:h-48 sm:w-48" />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="uppercase tracking-wider">TransCore AI</span>
          </div>
          <h1 className="mt-0.5 text-[16px] font-semibold leading-tight tracking-tight break-words sm:text-3xl">
            {heading}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground sm:text-sm">
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {dateLabel}</span>
            <span className="inline-flex items-center gap-1 sm:hidden"><Clock className="h-3 w-3" /> <span className="num" suppressHydrationWarning>{timeLabel}</span></span>
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1">
            <Clock className="h-3 w-3" />
            <span className="num tabular-nums" suppressHydrationWarning>{timeLabel}</span>
          </Badge>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------- KPI Cards ---------- */
type Stats = Awaited<ReturnType<typeof getDashboardStats>>;

function KpiRow({ stats, daily, extras, loading }: {
  stats?: Stats; daily?: DailyOps; extras?: HomeExtras; loading: boolean;
}) {
  const items = [
    { label: "Total Fleet", value: stats ? formatNumber(stats.totalVehicles) : "0", sub: stats ? `${stats.activeVehicles} active` : "—", icon: Truck, tone: "primary" as const },
    { label: "Active Trips", value: stats ? formatNumber(stats.activeTrips) : "0", sub: stats ? `${stats.completedTrips} completed` : "—", icon: MapIcon, tone: "info" as const },
    { label: "Revenue (MTD)", value: stats ? formatINR(stats.revenueMTD) : "₹0", sub: daily ? deltaLabel(daily.periods.revenueMTD, daily.periods.revenuePrevMTD) : "—", icon: IndianRupee, tone: "positive" as const },
    { label: "Fuel Efficiency", value: extras && extras.fuel.kmpl > 0 ? `${extras.fuel.kmpl} km/L` : "0 km/L", sub: "Fleet average", icon: Gauge, tone: "warn" as const },
    { label: "Alerts", value: daily ? formatNumber(daily.today.newAlerts) : "0", sub: daily && daily.today.overdueDocs > 0 ? `${daily.today.overdueDocs} overdue` : "All clear", icon: Bell, tone: (daily && daily.today.overdueDocs > 0 ? "negative" : "neutral") as "negative" | "neutral" },
  ];

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0); // 0..(items.length - 1)

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      const children = Array.from(el.children) as HTMLElement[];
      if (children.length < 2) { setProgress(0); return; }
      // Distance between consecutive card starts = card width + gap.
      const step = children[1].offsetLeft - children[0].offsetLeft;
      if (step <= 0) { setProgress(0); return; }
      const raw = el.scrollLeft / step;
      setProgress(Math.min(items.length - 1, Math.max(0, raw)));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items.length]);

  if (loading) {
    return (
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-6 px-6 py-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 sm:py-0 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-36 shrink-0 snap-start rounded-2xl sm:h-28 sm:w-auto" />
        ))}
      </div>
    );
  }

  const activeDot = Math.round(progress);

  return (
    <div>
      <div
        ref={scrollerRef}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-6 px-6 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 sm:py-0 lg:grid-cols-5"
      >
        {items.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04, ease: "easeOut" }}
            className="w-36 shrink-0 snap-start sm:w-auto sm:shrink"
          >
            <KpiCard {...k} />
          </motion.div>
        ))}
      </div>
      {/* Mobile-only swipe indicator */}
      <div
        className="mt-1.5 flex h-2 items-center justify-center gap-1.5 sm:hidden"
        role="tablist"
        aria-label="KPI cards pagination"
      >
        {items.map((k, i) => {
          const distance = Math.min(1, Math.abs(progress - i));
          const isActive = i === activeDot;
          return (
            <span
              key={k.label}
              role="tab"
              aria-selected={isActive}
              aria-label={k.label}
              className="block h-1 rounded-full bg-primary transition-all duration-200 ease-out"
              style={{
                width: isActive ? 16 : 4,
                opacity: 0.25 + (1 - distance) * 0.75,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function deltaLabel(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? "No prior data" : "First month";
  const pct = Math.round(((cur - prev) / prev) * 100);
  return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs last month`;
}

function KpiCard({ label, value, sub, icon: Icon, tone }: {
  label: string; value: string; sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "positive" | "negative" | "warn" | "info" | "neutral";
}) {
  const toneRing = {
    primary: "bg-primary/10 text-primary",
    positive: "bg-emerald-500/10 text-emerald-500",
    negative: "bg-destructive/10 text-destructive",
    warn: "bg-amber-500/10 text-amber-500",
    info: "bg-sky-500/10 text-sky-500",
    neutral: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <Card className="group relative h-full overflow-hidden rounded-2xl border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <span className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[11px]">{label}</span>
          <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg sm:h-8 sm:w-8 ${toneRing}`}>
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <div className="num mt-2 text-xl font-semibold leading-tight tracking-tight sm:mt-3 sm:text-2xl">{value}</div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">{sub}</div>
      </CardContent>
    </Card>
  );
}

/* ---------- Fleet Overview (30-day trend) ---------- */
function FleetOverview({ daily, loading }: { daily?: DailyOps; loading: boolean }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const axis = isDark ? "hsl(215 20% 65%)" : "hsl(220 9% 46%)";
  const grid = isDark ? "hsl(215 27% 32% / 0.35)" : "hsl(220 13% 91%)";
  const revColor = isDark ? "#60a5fa" : "#2563eb";
  const fuelColor = isDark ? "#f59e0b" : "#d97706";
  const data = useMemo(() =>
    (daily?.trend ?? []).map((r) => ({ ...r, label: r.date.slice(5) })),
  [daily]);
  const hasData = data.some((d) => d.revenue > 0 || d.fuel > 0 || d.trips > 0);
  const fleetLiveFn = useServerFn(getFleetLive);
  const live = useQuery(queryOptions({
    queryKey: ["fleet-live-dashboard"],
    queryFn: () => fleetLiveFn(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  }));
  const markers = useMemo(
    () => (live.data ?? [])
      .filter((v) => v.last)
      .map((v) => ({
        id: v.id,
        lat: v.last!.lat,
        lng: v.last!.lng,
        label: v.registration_number as string,
        status: v.liveStatus,
      })),
    [live.data],
  );
  const reporting = markers.length;
  const totalV = live.data?.length ?? 0;

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 sm:p-6 sm:pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> Fleet Overview
          </CardTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Revenue &amp; fuel trend · live vehicle map</p>
        </div>
        <Badge variant="outline" className="text-[10px]">30D</Badge>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
        <Tabs defaultValue="trend" className="w-full">
          <TabsList className="h-8 w-full grid-cols-2 sm:w-auto sm:inline-grid">
            <TabsTrigger value="trend" className="text-xs">Trend</TabsTrigger>
            <TabsTrigger value="map" className="text-xs">
              Live Map
              {totalV > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                  {reporting}/{totalV}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trend" className="mt-2 h-36 sm:h-72">
            {loading ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : !hasData ? (
              <EmptyChart message="No Data Available" hint="Log trips and fuel to see trends here." />
            ) : (
              <div className="h-full w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 via-background to-background p-1 shadow-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 14, right: 14, left: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id="ov-rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={revColor} stopOpacity={0.55} />
                        <stop offset="100%" stopColor={revColor} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="ov-fuel" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={fuelColor} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={fuelColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke={grid} vertical={false} />
                    <XAxis
                      dataKey="label" stroke={axis} fontSize={11}
                      interval={Math.max(0, Math.floor(data.length / 6) - 1)}
                      tickLine={false} axisLine={false} tickMargin={8}
                    />
                    <YAxis
                      stroke={axis} fontSize={11} tickLine={false} axisLine={false} width={40}
                      tickFormatter={(v: number) => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v/1000)}k` : String(v)}
                    />
                    <Tooltip
                      cursor={{ stroke: revColor, strokeOpacity: 0.35, strokeWidth: 1, strokeDasharray: "3 3" }}
                      contentStyle={{
                        background: isDark ? "rgba(15,15,20,0.92)" : "rgba(255,255,255,0.98)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 12,
                        padding: "8px 10px",
                        boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.08)",
                      }}
                      labelStyle={{ color: axis, fontSize: 11, marginBottom: 4, fontWeight: 500 }}
                      formatter={(v: number, name: string) => [name === "trips" ? v : formatINR(v), name === "revenue" ? "Revenue" : name === "fuel" ? "Fuel" : name]}
                    />
                    <Area
                      type="monotone" dataKey="revenue" stroke={revColor} strokeWidth={2.5}
                      fill="url(#ov-rev)" fillOpacity={1}
                      dot={{ r: 2.5, fill: revColor, stroke: isDark ? "#0b0b0f" : "#fff", strokeWidth: 1.5 }}
                      activeDot={{ r: 5, fill: revColor, stroke: isDark ? "#0b0b0f" : "#fff", strokeWidth: 2 }}
                      animationDuration={800}
                    />
                    <Area
                      type="monotone" dataKey="fuel" stroke={fuelColor} strokeWidth={2.5}
                      fill="url(#ov-fuel)" fillOpacity={1}
                      dot={{ r: 2.5, fill: fuelColor, stroke: isDark ? "#0b0b0f" : "#fff", strokeWidth: 1.5 }}
                      activeDot={{ r: 5, fill: fuelColor, stroke: isDark ? "#0b0b0f" : "#fff", strokeWidth: 2 }}
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-2 flex items-center justify-center gap-5 text-[11px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full ring-2 ring-background" style={{ background: revColor }} /> Revenue</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full ring-2 ring-background" style={{ background: fuelColor }} /> Fuel</span>
            </div>
          </TabsContent>

          <TabsContent value="map" className="mt-2">
            {live.isLoading ? (
              <Skeleton className="h-36 w-full rounded-lg sm:h-72" />
            ) : markers.length === 0 ? (
              <div className="h-36 sm:h-72">
                <EmptyChart
                  message="No live vehicle positions"
                  hint="Start the driver GPS broadcast from Live Tracking to see vehicles here."
                />
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border/60">
                <GoogleMapView markers={markers} className="h-36 w-full sm:h-72" zoom={5} />
              </div>
            )}
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{reporting} of {totalV} vehicle{totalV === 1 ? "" : "s"} reporting</span>
              <Link to="/tracking" className="font-medium text-primary hover:underline">
                Open live tracking <ChevronRight className="ml-0.5 inline h-3 w-3" />
              </Link>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/10 text-center">
      <div className="text-sm font-medium text-foreground">{message}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/* ---------- AI Insights ---------- */
function AIInsightsSection({ daily, loading }: { daily?: DailyOps; loading: boolean }) {
  if (loading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  const hasAny = (daily?.insights.length ?? 0) > 0;

  return (
    <div className="space-y-3">
      {hasAny ? (
        <Card className="border-border/60">
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-3">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Sparkles className="h-4 w-4 text-primary" /> AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 p-3 pt-0 sm:grid-cols-2 sm:p-6 sm:pt-0">
            {daily!.insights.slice(0, 2).map((ins, i) => (
              <motion.div
                key={ins.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="group rounded-xl border border-border/60 bg-muted/20 p-2.5 transition hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <InsightIcon tone={ins.tone} />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{ins.tone}</span>
                </div>
                <div className="line-clamp-2 break-words text-[13px] font-medium leading-snug">{ins.issue}</div>
                <div className="mt-0.5 line-clamp-2 break-words text-[11px] text-muted-foreground">{ins.impact}</div>
                {ins.href && (
                  <Link to={ins.href} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                    {ins.action} <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </motion.div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center gap-1.5 py-5 text-center sm:py-8">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-[13px] font-medium">No insights yet</div>
            <div className="max-w-sm text-[11px] text-muted-foreground">Start using TransCore to unlock AI recommendations.</div>
          </CardContent>
        </Card>
      )}

      <Suspense fallback={<Skeleton className="h-28 w-full rounded-2xl" />}>
        <FleetInsightsCards />
      </Suspense>
    </div>
  );
}

function InsightIcon({ tone }: { tone: DailyOps["insights"][number]["tone"] }) {
  const cls = tone === "positive" ? "text-emerald-500"
    : tone === "warning" ? "text-amber-500"
    : tone === "critical" ? "text-destructive"
    : "text-primary";
  const Icon = tone === "positive" ? TrendingUp
    : tone === "critical" ? AlertTriangle
    : tone === "warning" ? TrendingDown
    : Sparkles;
  return <Icon className={`h-3.5 w-3.5 ${cls}`} />;
}

/* ---------- Recent Trips ---------- */
function RecentTrips({ extras, loading }: { extras?: HomeExtras; loading: boolean }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 sm:p-6 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <MapIcon className="h-4 w-4 text-primary" /> Recent Trips
        </CardTitle>
        <Link to="/trips" className="text-[11px] text-muted-foreground hover:text-foreground sm:text-xs">
          All <ChevronRight className="ml-0.5 inline h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
          </div>
        ) : !extras || extras.recentTrips.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/60 py-5 text-center sm:py-8">
            <MapIcon className="h-7 w-7 text-muted-foreground/50" />
            <div className="text-[13px] text-muted-foreground">No trips yet</div>
            <Button asChild size="sm" className="h-8"><Link to="/trips"><Plus className="mr-1 h-3.5 w-3.5" /> Add Trip</Link></Button>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {extras.recentTrips.slice(0, 3).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium">{t.origin} → {t.destination}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {t.vehicle ?? "—"} · {t.driver ?? "Unassigned"}
                    {t.when && ` · ${new Date(t.when).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                  </div>
                </div>
                <div className="num shrink-0 text-[13px] font-semibold">{formatINR(t.freight_amount)}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "completed" ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/5"
    : status === "in_progress" ? "border-sky-500/40 text-sky-500 bg-sky-500/5"
    : status === "cancelled" ? "border-destructive/40 text-destructive bg-destructive/5"
    : "border-border/60 text-muted-foreground";
  return <Badge variant="outline" className={`text-[9px] uppercase ${cls}`}>{status.replace("_", " ")}</Badge>;
}

/* ---------- Fuel Summary ---------- */
function FuelSummary({ extras, loading }: { extras?: HomeExtras; loading: boolean }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const total = extras?.fuel.totalCost ?? 0;
  const budget = extras?.fuel.prevMonthTotal ?? 0;
  const rows = (["diesel", "petrol", "cng", "electric"] as const).map((k) => ({
    type: k,
    amount: extras?.fuel.byType.find((b) => b.type === k)?.amount ?? 0,
  }));
  const trackColor = isDark ? "rgba(148,163,184,0.10)" : "rgba(148,163,184,0.18)";

  // Segmented donut: each fuel type is its own gradient slice.
  // If only one type has spend, that slice fills the entire ring.
  const segments = rows.filter((r) => r.amount > 0);
  const chartData = segments.length > 0
    ? segments.map((r) => ({ name: r.type, value: r.amount }))
    : [{ name: "empty", value: 1 }];
  const hasBudget = budget > 0;
  const deltaPct = hasBudget ? Math.round(((total - budget) / budget) * 100) : 0;
  const overBudget = hasBudget && total > budget;
  const trendLabel = !hasBudget
    ? "No prior month"
    : deltaPct === 0
    ? "Same as last month"
    : `${deltaPct > 0 ? "▲" : "▼"} ${Math.abs(deltaPct)}% vs last month`;
  const trendTone = !hasBudget
    ? "text-muted-foreground"
    : overBudget
    ? "text-red-600 dark:text-red-400"
    : "text-emerald-600 dark:text-emerald-400";

  return (
    <Card className="border-border/60">
      <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Fuel className="h-4 w-4 text-primary" /> Fuel Summary
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">MTD</Badge>
        </div>
        <p className={`text-[11px] sm:text-xs ${trendTone}`}>{trendLabel}</p>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
        {loading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : (
          <div className="flex items-center gap-3 sm:block">
            <div className="relative h-28 w-28 shrink-0 sm:mx-auto sm:h-44 sm:w-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {(["diesel", "petrol", "cng", "electric", "other"] as const).map((k) => (
                      <linearGradient key={k} id={`fs-${k}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={FUEL_COLORS[k].from} stopOpacity={0.98} />
                        <stop offset="100%" stopColor={FUEL_COLORS[k].to} stopOpacity={0.98} />
                      </linearGradient>
                    ))}
                  </defs>
                  {/* Ring track behind segments so donut never looks empty. */}
                  <Pie
                    data={[{ name: "track", value: 1 }]} dataKey="value"
                    innerRadius="65%" outerRadius="95%"
                    stroke="none" isAnimationActive={false}
                    fill={trackColor}
                    startAngle={90} endAngle={-270}
                  />
                  <Pie
                    data={chartData} dataKey="value" nameKey="name"
                    innerRadius="65%" outerRadius="95%"
                    startAngle={90} endAngle={-270}
                    stroke="none"
                    cornerRadius={segments.length > 1 ? 4 : 8}
                    paddingAngle={segments.length > 1 ? 2 : 0}
                    animationDuration={900} animationBegin={100}
                    isAnimationActive
                  >
                    {chartData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.name === "empty" ? trackColor : `url(#fs-${d.name})`}
                      />
                    ))}
                  </Pie>
                  {segments.length > 0 && (
                    <Tooltip
                      contentStyle={{
                        background: isDark ? "rgba(15,15,20,0.92)" : "rgba(255,255,255,0.98)",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 12,
                        padding: "6px 10px",
                      }}
                      formatter={(v: number, n: string) => [
                        formatINR(v),
                        FUEL_COLORS[n]?.label ?? n,
                      ]}
                    />
                  )}
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-1 text-center">
                <div className="text-[8px] uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px]">Total spend</div>
                <div className="num text-[14px] font-bold leading-tight tracking-tight sm:text-2xl">
                  {formatINR(total)}
                </div>
                <div className="mt-0.5 text-[8px] text-muted-foreground sm:text-[10px]">
                  {segments.length > 0
                    ? `${segments.length} fuel type${segments.length === 1 ? "" : "s"}`
                    : "No spend yet"}
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 sm:mt-5">
              {rows.map((r) => {
                const pct = total > 0 ? Math.round((r.amount / total) * 100) : 0;
                const c = FUEL_COLORS[r.type];
                return (
                  <div key={r.type} className="group flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px] transition hover:bg-muted/40 sm:text-xs">
                    <span className="flex items-center gap-2 text-foreground/80">
                      <span
                        className="h-2.5 w-2.5 rounded-full ring-2 ring-background"
                        style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
                      />
                      <span className="font-medium">{c.label}</span>
                      {r.amount > 0 && <span className="text-[10px] text-muted-foreground">{pct}%</span>}
                    </span>
                    <span className="num font-semibold tabular-nums">{formatINR(r.amount)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Alerts & Reminders ---------- */
function AlertsPanel({ daily, loading }: { daily?: DailyOps; loading: boolean }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 sm:p-6 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <Bell className="h-4 w-4 text-primary" /> Alerts & Reminders
        </CardTitle>
        <Link to="/alerts" className="text-[11px] text-muted-foreground hover:text-foreground sm:text-xs">
          All <ChevronRight className="ml-0.5 inline h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
          </div>
        ) : !daily || daily.priorities.length === 0 ? (
          <div className="flex items-center gap-2 py-3 text-center sm:flex-col sm:py-6">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 sm:h-8 sm:w-8" />
            <div className="text-[13px] text-muted-foreground">All clear — no pending alerts.</div>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {daily.priorities.slice(0, 2).map((p) => (
              <li key={p.id} className="min-w-0">
                <Link
                  to={p.href}
                  className={`group flex w-full min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-sm transition hover:border-primary/40 hover:shadow-sm ${
                    p.severity === "critical" ? "border-destructive/40 bg-destructive/5"
                    : p.severity === "warning" ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border/60 bg-muted/20"
                  }`}
                >
                  <AlertTriangle className={`h-4 w-4 shrink-0 ${
                    p.severity === "critical" ? "text-destructive"
                    : p.severity === "warning" ? "text-amber-500"
                    : "text-muted-foreground"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium leading-tight">{p.title}</div>
                    <div className="line-clamp-2 break-words text-[11px] text-muted-foreground">{p.message}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Quick Actions ---------- */
function QuickActions() {
  const actions = [
    { label: "Add Vehicle", href: "/vehicles", icon: Truck },
    { label: "Add Driver", href: "/drivers", icon: Users },
    { label: "Log Trip", href: "/trips", icon: MapIcon },
    { label: "Fuel Entry", href: "/fuel", icon: Fuel },
    { label: "Expenses", href: "/expenses", icon: Receipt },
    { label: "Documents", href: "/documents", icon: FileText },
    { label: "AI Chat", href: "/ai", icon: MessageSquare },
  ] as const;
  return (
    <Card className="border-border/60">
      <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-3">
        <CardTitle className="text-sm sm:text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-4 gap-1.5 p-3 pt-0 sm:grid-cols-2 sm:gap-2 sm:p-6 sm:pt-0">
        {actions.map((a) => (
          <Link
            key={a.label}
            to={a.href}
            className="group flex flex-col items-center gap-1 rounded-2xl border border-border/60 bg-card p-2 text-center transition-all active:scale-95 hover:border-primary/40 hover:bg-primary/5 sm:flex-row sm:items-start sm:gap-2 sm:p-2.5 sm:text-left"
          >
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground sm:h-8 sm:w-8 sm:rounded-lg">
              <a.icon className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-medium leading-tight sm:text-xs">{a.label}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------- Onboarding (new users) ---------- */
function OnboardingCard({ daily }: { daily: DailyOps }) {
  const steps = [
    { key: "vehicles", label: "Add Vehicle", href: "/vehicles", done: daily.onboarding.hasVehicles },
    { key: "drivers", label: "Add Driver", href: "/drivers", done: daily.onboarding.hasDrivers },
    { key: "trips", label: "Log First Trip", href: "/trips", done: daily.onboarding.hasTrips },
    { key: "fuel", label: "Record Fuel", href: "/fuel", done: daily.onboarding.hasFuel },
  ];
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-card to-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Complete your setup
        </CardTitle>
        <div className="mt-2 flex items-center gap-3">
          <Progress value={pct} className="h-2 flex-1" />
          <span className="num text-xs font-medium text-muted-foreground">{pct}%</span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <Link
            key={s.key}
            to={s.href}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 px-3 py-2.5 text-sm transition hover:border-primary/50"
          >
            <span className="flex items-center gap-2">
              {s.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.label}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}