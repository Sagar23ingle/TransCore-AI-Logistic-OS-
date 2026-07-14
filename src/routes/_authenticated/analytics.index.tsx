import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { getProfitPerVehicle, getForecast } from "@/lib/analytics.functions";
import { formatINR, formatNumber } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/analytics/")({
  head: () => ({ meta: [{ title: "Analytics — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const profitFn = useServerFn(getProfitPerVehicle);
  const fcastFn = useServerFn(getForecast);
  const profit = useQuery(queryOptions({ queryKey: ["profit-per-vehicle"], queryFn: () => profitFn() }));
  const fcast = useQuery(queryOptions({ queryKey: ["forecast"], queryFn: () => fcastFn() }));

  if (profit.isLoading || fcast.isLoading) return <AppShell title="Analytics"><LoadingState /></AppShell>;

  const rows = profit.data ?? [];
  const isEmpty = rows.every((r) => r.trips === 0);
  const combined = [
    ...(fcast.data?.history ?? []).map((m) => ({ ...m, kind: "history" as const })),
    ...(fcast.data?.forecast ?? []).map((m) => ({ ...m, kind: "forecast" as const })),
  ];

  return (
    <AppShell title="Profit Analytics" description="Per-vehicle profit, cost per KM, and a 3-month linear forecast — all from your real trip and expense data.">
      {isEmpty ? (
        <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="No analytics yet"
          description="Log completed trips and expenses to compute per-vehicle profit and forecast." />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Profit per vehicle (6 mo)</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="registration_number" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)" }} />
                  <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                    {rows.map((r, i) => (<Cell key={i} fill={r.profit >= 0 ? "var(--color-accent)" : "var(--color-destructive)"} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Per-vehicle breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {rows.map((r) => (
                  <div key={r.vehicle_id} className="grid grid-cols-6 gap-2 rounded-md border border-border p-3 text-sm">
                    <div className="col-span-2 font-mono">{r.registration_number}</div>
                    <div><div className="text-[10px] uppercase text-muted-foreground">Trips</div>{r.trips}</div>
                    <div><div className="text-[10px] uppercase text-muted-foreground">Revenue</div><span className="num">{formatINR(r.revenue)}</span></div>
                    <div><div className="text-[10px] uppercase text-muted-foreground">Profit</div><span className={`num ${r.profit >= 0 ? "text-accent" : "text-destructive"}`}>{formatINR(r.profit)}</span></div>
                    <div><div className="text-[10px] uppercase text-muted-foreground">₹/km</div>{r.cost_per_km ?? "—"}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Revenue forecast (next 3 months)</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combined}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)" }} />
                  <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="expenses" stroke="var(--color-destructive)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}