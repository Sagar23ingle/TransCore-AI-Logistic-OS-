import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useEffect, useMemo } from "react";
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
import { formatINR, formatNumber } from "@/lib/format";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const FleetInsightsCards = lazy(() =>
  import("@/components/dashboard/FleetInsightsCards").then((m) => ({ default: m.FleetInsightsCards })),
);

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

const FUEL_COLORS: Record<string, string> = {
  diesel: "hsl(var(--chart-1))",
  petrol: "hsl(var(--chart-2))",
  cng: "hsl(var(--chart-3))",
  electric: "hsl(var(--chart-4))",
  other: "hsl(var(--chart-5))",
};

function greeting(hour: number) {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function Dashboard() {
  const statsFn = useServerFn(getDashboardStats);
  const dailyFn = useServerFn(getDailyOps);
  const homeFn = useServerFn(getHomeExtras);
  const recompute = useServerFn(recomputeAlerts);
  const qc = useQueryClient();

  const stats = useQuery(queryOptions({ queryKey: ["dashboard-stats"], queryFn: () => statsFn(), staleTime: 60_000 }));
  const daily = useQuery(queryOptions({ queryKey: ["dashboard-daily-ops"], queryFn: () => dailyFn(), staleTime: 60_000 }));
  const extras = useQuery(queryOptions({ queryKey: ["dashboard-home-extras"], queryFn: () => homeFn(), staleTime: 60_000 }));

  useEffect(() => {
    recompute().then(() => qc.invalidateQueries({ queryKey: ["alerts"] })).catch(() => {});
  }, [recompute, qc]);

  return (
    <AppShell>
      <div className="space-y-3 sm:space-y-6">
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
function WelcomeHeader({ daily, loading }: { daily?: DailyOps; loading: boolean }) {
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const name = daily?.user.fullName?.split(" ")[0];
  const hour = daily?.user.hour ?? now.getHours();

  if (loading) return <Skeleton className="h-20 w-full rounded-2xl sm:h-24" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:p-6"
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl sm:-right-16 sm:-top-16 sm:h-48 sm:w-48" />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="uppercase tracking-wider">TransCore AI</span>
          </div>
          <h1 className="mt-0.5 text-[22px] font-semibold leading-tight tracking-tight sm:text-3xl">
            {greeting(hour)}{name ? `, ${name}` : ""}.
          </h1>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground sm:text-sm">
            <Calendar className="h-3 w-3" /> {dateLabel}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1">
            <Clock className="h-3 w-3" />
            <span className="num">{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
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

  if (loading) {
    return (
      <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-40 shrink-0 snap-start rounded-2xl sm:h-28 sm:w-auto" />
        ))}
      </div>
    );
  }

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-5">
      {items.map((k, i) => (
        <motion.div
          key={k.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.04, ease: "easeOut" }}
          className="w-40 shrink-0 snap-start sm:w-auto sm:shrink"
        >
          <KpiCard {...k} />
        </motion.div>
      ))}
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
  const data = useMemo(() =>
    (daily?.trend ?? []).map((r) => ({ ...r, label: r.date.slice(5) })),
  [daily]);
  const hasData = data.some((d) => d.revenue > 0 || d.fuel > 0 || d.trips > 0);

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 sm:p-6 sm:pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> Fleet Overview
          </CardTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Revenue & fuel — last 30 days</p>
        </div>
        <Badge variant="outline" className="text-[10px]">30D</Badge>
      </CardHeader>
      <CardContent className="h-44 p-3 pt-0 sm:h-72 sm:p-6 sm:pt-0">
        {loading ? (
          <Skeleton className="h-full w-full rounded-lg" />
        ) : !hasData ? (
          <EmptyChart message="No Data Available" hint="Log trips and fuel to see trends here." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ov-rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ov-fuel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={6} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number, name: string) => [name === "trips" ? v : formatINR(v), name]}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#ov-rev)" strokeWidth={2} />
              <Area type="monotone" dataKey="fuel" stroke="hsl(var(--chart-3))" fill="url(#ov-fuel)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
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
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {daily!.insights.slice(0, 4).map((ins, i) => (
              <motion.div
                key={ins.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="group rounded-xl border border-border/60 bg-muted/20 p-3 transition hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <InsightIcon tone={ins.tone} />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{ins.tone}</span>
                </div>
                <div className="text-sm font-medium leading-snug">{ins.issue}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{ins.impact}</div>
                {ins.href && (
                  <Link to={ins.href} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    {ins.action} <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </motion.div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="text-sm font-medium">No insights available yet.</div>
            <div className="max-w-sm text-xs text-muted-foreground">
              Start using TransCore to unlock AI recommendations.
            </div>
          </CardContent>
        </Card>
      )}

      <Suspense fallback={<Skeleton className="h-32 w-full rounded-2xl" />}>
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapIcon className="h-4 w-4 text-primary" /> Recent Trips
        </CardTitle>
        <Link to="/trips" className="text-xs text-muted-foreground hover:text-foreground">
          View all <ChevronRight className="ml-0.5 inline h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : !extras || extras.recentTrips.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 py-8 text-center">
            <MapIcon className="h-8 w-8 text-muted-foreground/50" />
            <div className="text-sm text-muted-foreground">No trips recorded yet.</div>
            <Button asChild size="sm"><Link to="/trips"><Plus className="mr-1 h-3.5 w-3.5" /> Add Trip</Link></Button>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {extras.recentTrips.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{t.origin} → {t.destination}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {t.vehicle ?? "—"} · {t.driver ?? "Unassigned"}
                    {t.when && ` · ${new Date(t.when).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                  </div>
                </div>
                <div className="num shrink-0 text-sm font-semibold">{formatINR(t.freight_amount)}</div>
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
  const total = extras?.fuel.totalCost ?? 0;
  const rows = ["diesel", "petrol", "cng", "electric"].map((k) => ({
    type: k,
    amount: extras?.fuel.byType.find((b) => b.type === k)?.amount ?? 0,
  }));
  const chartData = (extras?.fuel.byType ?? []).length > 0 ? extras!.fuel.byType : [];

  return (
    <Card className="border-border/60">
      <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <Fuel className="h-4 w-4 text-primary" /> Fuel Summary
        </CardTitle>
        <p className="text-[11px] text-muted-foreground sm:text-xs">Month-to-date fuel</p>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
        {loading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : (
          <div className="flex items-center gap-4 sm:block">
            <div className="relative h-28 w-28 shrink-0 sm:mx-auto sm:h-40 sm:w-40">
              {chartData.length === 0 ? (
                <div className="grid h-full w-full place-items-center rounded-full border-2 border-dashed border-border/60">
                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
                    <div className="num text-sm font-semibold sm:text-lg">₹0</div>
                  </div>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} dataKey="amount" nameKey="type" innerRadius="60%" outerRadius="95%" paddingAngle={2}>
                        {chartData.map((d, i) => (
                          <Cell key={i} fill={FUEL_COLORS[d.type] ?? "hsl(var(--chart-5))"} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                        formatter={(v: number) => formatINR(v)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground sm:text-[10px]">Total</div>
                    <div className="num text-[13px] font-semibold leading-tight sm:text-lg">{formatINR(total)}</div>
                  </div>
                </>
              )}
            </div>
            <div className="flex-1 space-y-1.5 sm:mt-4">
              {rows.map((r) => (
                <div key={r.type} className="flex items-center justify-between text-[11px] sm:text-xs">
                  <span className="flex items-center gap-1.5 capitalize text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ background: FUEL_COLORS[r.type] }} />
                    {r.type}
                  </span>
                  <span className="num font-medium">{formatINR(r.amount)}</span>
                </div>
              ))}
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-primary" /> Alerts & Reminders
        </CardTitle>
        <Link to="/alerts" className="text-xs text-muted-foreground hover:text-foreground">
          All <ChevronRight className="ml-0.5 inline h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : !daily || daily.priorities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <div className="text-sm text-muted-foreground">No pending alerts.</div>
          </div>
        ) : (
          <ul className="space-y-2">
            {daily.priorities.slice(0, 5).map((p) => (
              <li key={p.id}>
                <Link
                  to={p.href}
                  className={`group flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition hover:border-primary/40 hover:shadow-sm ${
                    p.severity === "critical" ? "border-destructive/40 bg-destructive/5"
                    : p.severity === "warning" ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border/60 bg-muted/20"
                  }`}
                >
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${
                    p.severity === "critical" ? "text-destructive"
                    : p.severity === "warning" ? "text-amber-500"
                    : "text-muted-foreground"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.message}</div>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
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
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {actions.map((a, i) => (
          <motion.div
            key={a.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
          >
            <Link
              to={a.href}
              className="group flex flex-col items-start gap-2 rounded-xl border border-border/60 bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md"
            >
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <a.icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">{a.label}</span>
            </Link>
          </motion.div>
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