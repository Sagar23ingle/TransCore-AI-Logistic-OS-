import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellRing, BellOff, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SeverityBadge } from "@/components/common/SeverityBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { dismissAlert, listAlerts, recomputeAlerts } from "@/lib/alerts.functions";
import { formatDate } from "@/lib/format";
import { usePushNotifications } from "@/hooks/use-push";

export const Route = createFileRoute("/_authenticated/alerts/")({
  head: () => ({ meta: [{ title: "Alerts — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: AlertsPage,
});

function AlertsPage() {
  const listFn = useServerFn(listAlerts);
  const recFn = useServerFn(recomputeAlerts);
  const disFn = useServerFn(dismissAlert);
  const qc = useQueryClient();
  const push = usePushNotifications();

  const q = useQuery(queryOptions({ queryKey: ["alerts"], queryFn: () => listFn() }));
  const rec = useMutation({
    mutationFn: () => recFn(),
    onSuccess: (r) => { toast.success(`Recomputed — ${r.generated} alert(s)`); qc.invalidateQueries({ queryKey: ["alerts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Recompute failed"),
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => disFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  return (
    <AppShell title="Smart Alerts" description="Automatic reminders computed from your real expiry dates."
      action={
        <div className="flex gap-2">
          {push.supported && (
            <Button variant="outline" onClick={() => push.subscribed ? push.disable() : push.enable()} disabled={push.busy}>
              {push.subscribed ? <><BellOff className="mr-2 h-4 w-4" /> Disable push</> : <><BellRing className="mr-2 h-4 w-4" /> Enable push</>}
            </Button>
          )}
          <Button variant="outline" onClick={() => rec.mutate()} disabled={rec.isPending}><RefreshCw className={`mr-2 h-4 w-4 ${rec.isPending ? "animate-spin" : ""}`} /> Recompute</Button>
        </div>
      }>
      {q.isLoading ? <LoadingState /> : !q.data || q.data.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="Nothing to worry about"
          description="We'll alert you 30, 15, 7, 3 and 0 days before any expiry, EMI or maintenance date."
        />
      ) : (
        <div className="grid gap-2">
          {q.data.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-start justify-between gap-3 py-4">
                <div className="flex items-start gap-3">
                  <SeverityBadge severity={a.severity} />
                  <div>
                    <div className="text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.message}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Due {formatDate(a.due_date)}
                      {a.vehicle && <> · {a.vehicle.registration_number}</>}
                      {a.driver && <> · {a.driver.full_name}</>}
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => dismiss.mutate(a.id)}><X className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
