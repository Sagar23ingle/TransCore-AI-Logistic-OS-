import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Truck, Users, Map as MapIcon, IndianRupee, TrendingDown, Fuel, Percent, Activity } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats, getRevenueByMonth, getExpenseBreakdown } from "@/lib/dashboard.functions";
import { recomputeAlerts } from "@/lib/alerts.functions";
import { formatINR, formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import {
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
  const recompute = useServerFn(recomputeAlerts);
  const qc = useQueryClient();

  const stats = useQuery(queryOptions({ queryKey: ["dashboard-stats"], queryFn: () => statsFn() }));
  const revenue = useQuery(queryOptions({ queryKey: ["dashboard-revenue"], queryFn: () => revenueFn() }));
  const breakdown = useQuery(queryOptions({ queryKey: ["dashboard-expense-breakdown"], queryFn: () => expenseFn() }));

  useEffect(() => {
    // Refresh alerts silently on dashboard load.
    recompute().then(() => qc.invalidateQueries({ queryKey: ["alerts"] })).catch(() => {});
  }, [recompute, qc]);

  if (stats.isLoading || revenue.isLoading || breakdown.isLoading) {
    return <AppShell title="Dashboard"><LoadingState /></AppShell>;
  }

  const s = stats.data;
  const isEmpty = !s || (s.totalVehicles === 0 && s.totalTrips === 0);

  return (
    <AppShell title="Dashboard" description="Live view of your fleet, trips and money — computed from your real data.">
      {isEmpty ? (
        <EmptyState
          icon={<Truck className="h-6 w-6" />}
          title="Nothing to show yet"
          description="Add your first vehicle and trip to see revenue, expenses and utilization compute in real time."
        />
      ) : (
        <div className="space-y-6">
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
