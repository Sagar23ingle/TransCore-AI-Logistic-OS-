import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Truck, Users, Map as MapIcon, IndianRupee, TrendingDown, Fuel, Percent, Activity,
  AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronRight, Circle,
  Heart, Lightbulb, Sparkles, Target, TrendingUp, Zap,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getDashboardStats, getRevenueByMonth, getExpenseBreakdown } from "@/lib/dashboard.functions";
import { getDailyOps } from "@/lib/daily-ops.functions";
import { recomputeAlerts } from "@/lib/alerts.functions";
import { formatINR, formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

function Dashboard() {
  const statsFn = useServerFn(getDashboardStats);
  const revenueFn = useServerFn(getRevenueByMonth);
  const expenseFn = useServerFn(getExpenseBreakdown);
  const dailyFn = useServerFn(getDailyOps);
  const recompute = useServerFn(recomputeAlerts);
  const qc = useQueryClient();

  const stats = useQuery(queryOptions({ queryKey: ["dashboard-stats"], queryFn: () => statsFn() }));
  const revenue = useQuery(queryOptions({ queryKey: ["dashboard-revenue"], queryFn: () => revenueFn() }));
  const breakdown = useQuery(queryOptions({ queryKey: ["dashboard-expense-breakdown"], queryFn: () => expenseFn() }));
  const daily = useQuery(queryOptions({ queryKey: ["dashboard-daily-ops"], queryFn: () => dailyFn(), staleTime: 60_000 }));

  useEffect(() => {
    // Refresh alerts silently on dashboard load.
    recompute().then(() => qc.invalidateQueries({ queryKey: ["alerts"] })).catch(() => {});
  }, [recompute, qc]);

  if (stats.isLoading || revenue.isLoading || breakdown.isLoading || daily.isLoading) {
    return <AppShell title="Dashboard"><LoadingState /></AppShell>;
  }

  const s = stats.data;
  const d = daily.data;
  const isEmpty = !s || (s.totalVehicles === 0 && s.totalTrips === 0);

  return (
    <AppShell>
      {isEmpty ? (
        <OnboardingHero daily={d} />
      ) : (
        <div className="space-y-6">
          {d && <WelcomeHeader daily={d} />}
          {d && <TodaySnapshot daily={d} />}
          {d && (
            <div className="grid gap-4 lg:grid-cols-3">
              <FleetHealthCard daily={d} />
              <div className="space-y-4 lg:col-span-2">
                <PrioritiesCard daily={d} />
              </div>
            </div>
          )}
          {d && d.insights.length > 0 && <InsightsGrid daily={d} />}
          {d && <GoalsCard daily={d} />}
          {d && <TrendCard daily={d} />}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={<IndianRupee className="h-4 w-4" />} label="Revenue (MTD)" value={formatINR(s!.revenueMTD)} />
            <Kpi icon={<TrendingDown className="h-4 w-4" />} label="Expenses (MTD)" value={formatINR(s!.expensesMTD)} />
            <Kpi icon={<Fuel className="h-4 w-4" />} label="Fuel cost (MTD)" value={formatINR(s!.fuelMTD)} />
            <Kpi
              icon={<Activity className="h-4 w-4" />}
              label="Profit (MTD)"
              value={formatINR(s!.profitMTD)}
              tone={s!.profitMTD >= 0 ? "positive" : "negative"}
            />
            <Kpi icon={<Truck className="h-4 w-4" />} label="Vehicles" value={`${s!.activeVehicles} / ${s!.totalVehicles}`} sub="active / total" />
            <Kpi icon={<Users className="h-4 w-4" />} label="Drivers" value={formatNumber(s!.totalDrivers)} />
            <Kpi icon={<MapIcon className="h-4 w-4" />} label="Active trips" value={formatNumber(s!.activeTrips)} sub={`${s!.completedTrips} completed`} />
            <Kpi icon={<Percent className="h-4 w-4" />} label="Fleet utilization" value={`${s!.fleetUtilization}%`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Revenue vs Expenses (6 mo)</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenue.data ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                    <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Expense breakdown (MTD)</CardTitle></CardHeader>
              <CardContent className="h-72">
                {(!breakdown.data || breakdown.data.length === 0) ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No expenses recorded this month.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={breakdown.data} dataKey="amount" nameKey="category" innerRadius={50} outerRadius={90}>
                        {breakdown.data.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "positive" | "negative" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs uppercase tracking-wider">{label}</span>
          <span className="opacity-70">{icon}</span>
        </div>
        <div className={`num mt-2 text-2xl font-semibold ${tone === "negative" ? "text-destructive" : tone === "positive" ? "text-accent" : ""}`}>
          {value}
        </div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

/* -------------------- Daily Ops UI sub-components -------------------- */

type Daily = NonNullable<ReturnType<typeof useDailyPlaceholder>>;
// Trick: derive the type from the server-fn return via a placeholder hook signature.
function useDailyPlaceholder() { return null as unknown as Awaited<ReturnType<typeof getDailyOps>>; }

function greeting(hour: number) {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function WelcomeHeader({ daily }: { daily: Daily }) {
  const name = daily.user.fullName?.split(" ")[0];
  const line = useMemo(() => {
    const parts: string[] = [];
    if (daily.today.trucksOnRoute > 0) parts.push(`${daily.today.trucksOnRoute} truck${daily.today.trucksOnRoute === 1 ? "" : "s"} on the road`);
    if (daily.today.tripsCompleted > 0) parts.push(`${daily.today.tripsCompleted} trip${daily.today.tripsCompleted === 1 ? "" : "s"} completed today`);
    if (daily.today.pendingDocs > 0) parts.push(`${daily.today.pendingDocs} document${daily.today.pendingDocs === 1 ? "" : "s"} need attention`);
    if (parts.length === 0) return "Fleet is quiet — a good time to plan the week.";
    return parts.join(" • ");
  }, [daily]);
  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-accent/5 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> Daily briefing
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
        {greeting(daily.user.hour)}{name ? `, ${name}` : ""}.
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{line}</p>
    </div>
  );
}

function delta(cur: number, prev: number) {
  if (prev === 0) return { pct: null as number | null, up: cur > 0 };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { pct, up: pct >= 0 };
}

function SnapshotChip({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: React.ReactNode; tone?: "good" | "warn" | "bad" }) {
  const toneCls = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-500" : tone === "good" ? "text-emerald-500" : "";
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className={toneCls}>{icon}</span>{label}
      </div>
      <div className="num mt-2 text-xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function TodaySnapshot({ daily }: { daily: Daily }) {
  const revD = delta(daily.today.revenue, daily.today.revenueYesterday);
  const fuelD = delta(daily.today.fuelCost, daily.today.fuelYesterday);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <SnapshotChip icon={<Truck className="h-3.5 w-3.5" />} label="Trucks active" value={`${daily.today.trucksActive}`} sub={`${daily.today.trucksOnRoute} on route`} />
      <SnapshotChip icon={<Users className="h-3.5 w-3.5" />} label="Drivers on duty" value={`${daily.today.driversActive}`} />
      <SnapshotChip
        icon={<IndianRupee className="h-3.5 w-3.5" />} label="Revenue today"
        value={formatINR(daily.today.revenue)}
        sub={revD.pct == null ? "no comparison yet" : (<span className={revD.up ? "text-emerald-500" : "text-destructive"}>{revD.up ? "▲" : "▼"} {Math.abs(revD.pct)}% vs yesterday</span>)}
        tone="good"
      />
      <SnapshotChip
        icon={<Fuel className="h-3.5 w-3.5" />} label="Fuel today"
        value={formatINR(daily.today.fuelCost)}
        sub={fuelD.pct == null ? "no comparison yet" : (<span className={fuelD.up ? "text-amber-500" : "text-emerald-500"}>{fuelD.up ? "▲" : "▼"} {Math.abs(fuelD.pct)}% vs yesterday</span>)}
      />
      <SnapshotChip
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        label="Needs attention"
        value={`${daily.today.pendingDocs}`}
        sub={daily.today.overdueDocs > 0 ? `${daily.today.overdueDocs} overdue` : `${daily.today.upcomingRenewals} due in 30d`}
        tone={daily.today.overdueDocs > 0 ? "bad" : daily.today.upcomingRenewals > 0 ? "warn" : "good"}
      />
    </div>
  );
}

function healthTone(band: Daily["health"]["band"]) {
  return band === "excellent" ? "text-emerald-500"
    : band === "good" ? "text-primary"
    : band === "attention" ? "text-amber-500"
    : "text-destructive";
}

function AnimatedNumber({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 800;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n}</>;
}

function FleetHealthCard({ daily }: { daily: Daily }) {
  const { score, band, reasons } = daily.health;
  const size = 160, stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const dash = c * (score / 100);
  const color = band === "excellent" ? "hsl(var(--chart-2))" : band === "good" ? "hsl(var(--primary))" : band === "attention" ? "hsl(38 92% 55%)" : "hsl(var(--destructive))";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Heart className="h-4 w-4 text-primary" /> Fleet health</CardTitle>
        <Badge variant="outline" className={`capitalize ${healthTone(band)}`}>{band}</Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center">
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-border/60" />
            <circle
              cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeLinecap="round"
              stroke={color} fill="none"
              strokeDasharray={`${dash} ${c}`}
              style={{ transition: "stroke-dasharray 800ms ease-out" }}
            />
          </svg>
          <div className="pointer-events-none absolute text-center">
            <div className={`text-4xl font-semibold ${healthTone(band)}`}><AnimatedNumber value={score} /></div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">out of 100</div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {reasons.map((r) => (
            <div key={r.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{r.label}</span>
                <span className="num">{r.score}</span>
              </div>
              <Progress value={r.score} className="h-1.5" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function severityStyles(s: "critical" | "warning" | "info") {
  return s === "critical" ? "border-destructive/40 bg-destructive/5 text-destructive"
    : s === "warning" ? "border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400"
    : "border-border/60 bg-muted/30";
}

function PrioritiesCard({ daily }: { daily: Daily }) {
  const items = daily.priorities;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> Today’s priorities</CardTitle>
        <Link to="/alerts" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            You’re all caught up. No urgent actions today.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((p) => (
              <li key={p.id}>
                <Link to={p.href} className={`group flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 transition hover:border-primary/50 hover:shadow-sm ${severityStyles(p.severity)}`}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.title}</div>
                    <div className="truncate text-xs opacity-80">{p.message}</div>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 opacity-60 transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function InsightIcon({ tone }: { tone: Daily["insights"][number]["tone"] }) {
  const cls = tone === "positive" ? "text-emerald-500" : tone === "warning" ? "text-amber-500" : tone === "critical" ? "text-destructive" : "text-primary";
  const Icon = tone === "positive" ? TrendingUp : tone === "critical" ? AlertTriangle : tone === "warning" ? ArrowDownRight : Lightbulb;
  return <Icon className={`h-4 w-4 ${cls}`} />;
}

function InsightsGrid({ daily }: { daily: Daily }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium tracking-tight">Insights from your data</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {daily.insights.slice(0, 6).map((ins) => (
          <Card key={ins.id} className="transition hover:shadow-md">
            <CardContent className="pt-5">
              <div className="mb-2 flex items-center gap-2"><InsightIcon tone={ins.tone} /><span className="text-xs uppercase tracking-wider text-muted-foreground">{ins.tone}</span></div>
              <div className="text-sm font-semibold">{ins.issue}</div>
              <div className="mt-1 text-xs text-muted-foreground">{ins.impact}</div>
              {ins.href ? (
                <Link to={ins.href} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  {ins.action} <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <div className="mt-3 text-xs text-muted-foreground">{ins.action}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function formatGoal(g: Daily["goals"][number]) {
  if (g.unit === "inr") return formatINR(g.current);
  if (g.unit === "pct") return `${g.current}%`;
  if (g.unit === "kmpl") return `${g.current} km/L`;
  return formatNumber(g.current);
}
function formatTarget(g: Daily["goals"][number]) {
  if (g.unit === "inr") return formatINR(g.target);
  if (g.unit === "pct") return `${g.target}%`;
  if (g.unit === "kmpl") return `${g.target} km/L`;
  return formatNumber(g.target);
}

function GoalsCard({ daily }: { daily: Daily }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4 text-primary" /> Monthly goals</CardTitle></CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {daily.goals.map((g) => {
            const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
            const met = pct >= 100;
            return (
              <div key={g.key} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{g.label}</span>
                  <span className={met ? "text-emerald-500" : "text-muted-foreground"}>{pct}%</span>
                </div>
                <Progress value={pct} className="h-2" />
                <div className="flex items-baseline justify-between text-xs">
                  <span className="num font-medium">{formatGoal(g)}</span>
                  <span className="text-muted-foreground">of {formatTarget(g)}</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Targets are based on last month’s performance to keep goals honest.</p>
      </CardContent>
    </Card>
  );
}

function TrendCard({ daily }: { daily: Daily }) {
  const data = daily.trend.map((r) => ({ ...r, label: r.date.slice(5) }));
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-primary" /> 30-day revenue & fuel trend</CardTitle></CardHeader>
      <CardContent className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fuel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} interval={4} />
            <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
            <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
            <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" fill="url(#rev)" strokeWidth={2} />
            <Area type="monotone" dataKey="fuel" stroke="var(--color-accent)" fill="url(#fuel)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function OnboardingHero({ daily }: { daily: Daily | undefined }) {
  const steps = [
    { key: "vehicles", label: "Add your first vehicle", href: "/vehicles", done: !!daily?.onboarding.hasVehicles },
    { key: "drivers", label: "Add a driver", href: "/drivers", done: !!daily?.onboarding.hasDrivers },
    { key: "trips", label: "Log a trip", href: "/trips", done: !!daily?.onboarding.hasTrips },
    { key: "fuel", label: "Record a fuel entry", href: "/fuel", done: !!daily?.onboarding.hasFuel },
  ];
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Welcome to TransCore</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">A few quick steps and your dashboard turns on — every metric here is computed from your real data.</p>
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Setup progress</span><span>{pct}%</span></div>
            <Progress value={pct} className="h-2" />
          </div>
          <ul className="mt-4 space-y-2">
            {steps.map((s) => (
              <li key={s.key}>
                <Link to={s.href} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 text-sm transition hover:border-primary/50">
                  <span className="flex items-center gap-2">
                    {s.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.label}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
