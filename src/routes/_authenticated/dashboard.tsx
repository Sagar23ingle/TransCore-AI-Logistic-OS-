import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useEffect, useState } from "react";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";
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
import { CountUp } from "@/components/ui/count-up";

const FleetOverview = lazy(() => import("@/components/dashboard/FleetOverview"));

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
            <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
              <FleetOverview daily={daily.data} loading={daily.isLoading} />
            </Suspense>
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
    { label: "Alerts", value: daily ? formatNumber(daily.today.newAlerts) : "0", sub: daily && daily.today.overdueDocs > 0 ? `${daily.today.overdueDocs} overdue` : "All clear", icon: Bell, tone: (daily && daily.today.overdueDocs > 0 ? "negative" : "neutral") as "negative" | "neutral" },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl sm:h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((k, i) => (
        <motion.div
          key={k.label}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, delay: i * 0.04, ease: "easeOut" }}
          className="min-w-0"
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
    primary: "bg-gradient-primary text-primary-foreground shadow-[var(--glow-primary)]",
    positive: "bg-emerald-500/10 text-emerald-500",
    negative: "bg-destructive/10 text-destructive",
    warn: "bg-amber-500/10 text-amber-500",
    info: "bg-sky-500/10 text-sky-500",
    neutral: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <Card className="group tc-specular tc-lift tc-glow-hover relative h-full overflow-hidden rounded-[22px] border-border/40 bg-card shadow-[var(--shadow-neo)]">
      <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[var(--gradient-primary-soft)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <CardContent className="relative p-3.5 sm:p-4">
        <div className="flex items-center justify-between">
          <span className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px]">{label}</span>
          <div className={`tc-icon-hover grid h-8 w-8 shrink-0 place-items-center rounded-xl sm:h-9 sm:w-9 ${toneRing}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="num mt-3 text-[22px] font-semibold leading-none tracking-tight sm:mt-4 sm:text-2xl">
          <CountUp value={value} duration={1200} />
        </div>
        <div className="mt-1 truncate text-[11px] text-muted-foreground sm:text-xs">{sub}</div>
      </CardContent>
    </Card>
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
  const total = extras?.fuel.totalCost ?? 0;
  const budget = extras?.fuel.prevMonthTotal ?? 0;
  const rows = (["diesel", "petrol", "cng", "electric"] as const).map((k) => ({
    type: k,
    amount: extras?.fuel.byType.find((b) => b.type === k)?.amount ?? 0,
  }));
  const segments = rows.filter((r) => r.amount > 0);
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

  // Budget-aware "fuel used" percentage — clamps to 100 for the pill visual,
  // but the label shows the true number so overspend is obvious.
  const budgetPct = hasBudget ? Math.round((total / budget) * 100) : 0;
  const pillPct = Math.min(100, budgetPct);
  const primaryFuel = segments.slice().sort((a, b) => b.amount - a.amount)[0];
  const primaryLabel = primaryFuel ? FUEL_COLORS[primaryFuel.type].label : "—";
  const primaryGrad = primaryFuel
    ? `linear-gradient(90deg, ${FUEL_COLORS[primaryFuel.type].from}, ${FUEL_COLORS[primaryFuel.type].to})`
    : "var(--gradient-primary)";

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
          <div className="space-y-3">
            {/* iPhone-battery-style horizontal pill */}
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Fuel used</span>
                <span className="num text-lg font-bold tabular-nums">
                  {hasBudget ? `${budgetPct}%` : segments.length > 0 ? "—" : "0%"}
                </span>
              </div>
              <div
                className="relative h-8 w-full overflow-hidden rounded-full"
                style={{ boxShadow: "var(--shadow-neo-inset)" }}
                role="progressbar"
                aria-valuenow={pillPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Fuel budget used"
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pillPct}%` }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  className="absolute inset-y-0 left-0 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-2px_4px_rgba(0,0,0,0.25)]"
                  style={{
                    background: overBudget
                      ? "linear-gradient(90deg, #ef4444, #f97316)"
                      : primaryGrad,
                  }}
                />
                {/* iOS-battery cap */}
                <span className="pointer-events-none absolute right-1 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-foreground/20" />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{hasBudget ? `of ${formatINR(budget)} budget` : "Set a baseline by logging last month's fuel"}</span>
                {overBudget && <span className="font-semibold text-red-500">Over budget</span>}
              </div>
            </div>

            {/* Total + primary fuel */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Total fuel cost</div>
                <div className="num mt-0.5 text-[18px] font-bold leading-tight sm:text-xl">{formatINR(total)}</div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Fuel type</div>
                <div className="mt-0.5 flex items-center gap-2 text-[15px] font-semibold leading-tight">
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-2 ring-background"
                    style={{ background: primaryGrad }}
                  />
                  {primaryLabel}
                </div>
              </div>
            </div>

            {/* Stacked per-type bars — only when >1 fuel type has spend */}
            {segments.length > 1 && (
              <div className="space-y-1.5">
                {segments.map((r) => {
                  const pct = total > 0 ? Math.round((r.amount / total) * 100) : 0;
                  const c = FUEL_COLORS[r.type];
                  return (
                    <div key={r.type} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 font-medium">
                          <span className="h-2 w-2 rounded-full" style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }} />
                          {c.label}
                          <span className="text-muted-foreground">· {pct}%</span>
                        </span>
                        <span className="num tabular-nums font-semibold">{formatINR(r.amount)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, ${c.from}, ${c.to})` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {segments.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/60 py-4 text-center text-[11px] text-muted-foreground">
                No fuel spend logged yet.
              </div>
            )}
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