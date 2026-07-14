import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, IndianRupee, ShieldAlert, Truck, Users, Wrench } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { getExecutiveOverview } from "@/lib/executive.functions";
import { useCompanies } from "@/hooks/use-company";
import { formatINR, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/executive/")({
  head: () => ({ meta: [{ title: "Executive dashboard — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: ExecPage,
});

function Stat({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string; hint?: string; tone?: "good" | "bad" | "warn" }) {
  const toneClass = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-orange-500" : tone === "good" ? "text-emerald-500" : "";
  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
        <div className={`text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function ExecPage() {
  const { active, activeCompanyId } = useCompanies();
  const fn = useServerFn(getExecutiveOverview);
  const q = useQuery({
    queryKey: ["executive", activeCompanyId],
    queryFn: () => fn({ data: { company_id: activeCompanyId! } }),
    enabled: !!activeCompanyId,
  });

  if (!activeCompanyId) {
    return <AppShell title="Executive dashboard"><EmptyState title="Select a company" description="Use the switcher in the top bar." /></AppShell>;
  }
  if (q.isLoading || !q.data) return <AppShell title="Executive dashboard"><LoadingState /></AppShell>;
  const s = q.data;

  return (
    <AppShell title="Executive dashboard" description={`Real-time view of ${active?.name ?? "your company"} — every number is computed from live records.`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<IndianRupee className="h-3.5 w-3.5" />} label="Revenue MTD" value={formatINR(s.revenueMTD)} hint={`YTD ${formatINR(s.revenueYTD)}`} tone="good" />
        <Stat icon={<IndianRupee className="h-3.5 w-3.5" />} label="Expenses MTD" value={formatINR(s.expensesMTD)} hint={`YTD ${formatINR(s.expensesYTD)}`} tone="warn" />
        <Stat icon={<Activity className="h-3.5 w-3.5" />} label="Net profit MTD" value={formatINR(s.profitMTD)} hint={`YTD ${formatINR(s.profitYTD)}`} tone={s.profitMTD >= 0 ? "good" : "bad"} />
        <Stat icon={<Truck className="h-3.5 w-3.5" />} label="Active vehicles" value={formatNumber(s.activeVehicles)} hint={`${s.totalVehicles} total`} />
        <Stat icon={<Users className="h-3.5 w-3.5" />} label="Active drivers" value={formatNumber(s.activeDrivers)} hint={`${s.totalDrivers} total`} />
        <Stat icon={<Activity className="h-3.5 w-3.5" />} label="Trips today" value={formatNumber(s.tripsToday)} />
        <Stat icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Docs expiring ≤30d" value={formatNumber(s.expiringDocs)} hint={`${s.expiredDocs} expired`} tone={s.expiredDocs > 0 ? "bad" : "warn"} />
        <Stat icon={<Wrench className="h-3.5 w-3.5" />} label="Maintenance due ≤30d" value={formatNumber(s.maintenanceDue)} hint={`${s.maintenanceOverdue} overdue`} tone={s.maintenanceOverdue > 0 ? "bad" : "warn"} />
        <Stat icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Critical alerts" value={formatNumber(s.criticalAlerts)} tone={s.criticalAlerts > 0 ? "bad" : "good"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Top vehicles by profit (MTD)</CardTitle></CardHeader>
          <CardContent>
            {s.topVehicles.length === 0 ? <div className="text-sm text-muted-foreground">No completed trips this month.</div> : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="pb-2 text-left">Vehicle</th><th className="pb-2 text-right">Revenue</th><th className="pb-2 text-right">Expenses</th><th className="pb-2 text-right">Profit</th></tr>
                </thead>
                <tbody>
                  {s.topVehicles.map((v) => (
                    <tr key={v.id} className="border-t border-border/50">
                      <td className="py-2">{v.registration_number}</td>
                      <td className="py-2 text-right">{formatINR(v.revenue)}</td>
                      <td className="py-2 text-right">{formatINR(v.expenses)}</td>
                      <td className={`py-2 text-right ${v.profit >= 0 ? "text-emerald-500" : "text-destructive"}`}>{formatINR(v.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top drivers by score</CardTitle></CardHeader>
          <CardContent>
            {s.topDrivers.length === 0 ? <div className="text-sm text-muted-foreground">No driver scores yet.</div> : (
              <div className="space-y-2">
                {s.topDrivers.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm">
                    <span>{d.name}</span>
                    <span className="font-semibold">{d.score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}