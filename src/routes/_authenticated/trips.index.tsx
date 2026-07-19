import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, Map as MapIcon, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { TripFormDialog } from "@/components/trips/TripFormDialog";
import { deleteTrip, listTrips } from "@/lib/trips.functions";
import { formatDateTime, formatINR, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/trips/")({
  head: () => ({ meta: [{ title: "Trips — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: TripsPage,
});

function TripsPage() {
  const listFn = useServerFn(listTrips);
  const delFn = useServerFn(deleteTrip);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Awaited<ReturnType<typeof listFn>>[number] | null>(null);

  const q = useQuery(queryOptions({ queryKey: ["trips"], queryFn: () => listFn() }));
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Trip removed"); qc.invalidateQueries({ queryKey: ["trips"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  return (
    <AppShell title="Trips" description="Every load, from planned to completed."
      action={<Button size="sm" className="h-10 rounded-full px-4" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-1.5 h-4 w-4" /> New</Button>}>
      {q.isLoading ? <LoadingState /> : !q.data || q.data.length === 0 ? (
        <EmptyState icon={<MapIcon className="h-6 w-6" />} title="No trips yet"
          description="Create your first trip to start tracking revenue, expenses and distance."
          action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> New trip</Button>} />
      ) : (
        <div className="grid gap-2.5">
          {q.data.map((t) => (
            <Card key={t.id} className="list-perf rounded-2xl">
              <CardContent className="p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                      <span className="truncate">{t.origin}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{t.destination}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Badge variant={t.status === "completed" ? "default" : t.status === "in_progress" ? "secondary" : t.status === "cancelled" ? "destructive" : "outline"} className="h-5 px-1.5 text-[10px]">
                        {t.status}
                      </Badge>
                      {t.vehicle && <span className="truncate">{t.vehicle.registration_number}</span>}
                      {t.driver && <span className="truncate">· {t.driver.full_name}</span>}
                    </div>
                    {t.scheduled_start && <div className="mt-0.5 text-[11px] text-muted-foreground">Scheduled {formatDateTime(t.scheduled_start)}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="num text-sm font-semibold">{formatINR(Number(t.freight_amount))}</div>
                    <div className="text-[11px] text-muted-foreground">{t.distance_km ? `${formatNumber(Number(t.distance_km))} km` : "—"}</div>
                    <div className="mt-1 flex justify-end -mr-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { if (confirm("Remove trip?")) del.mutate(t.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <TripFormDialog open={open} onOpenChange={setOpen} initial={editing ?? undefined}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["trips"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); }} />
    </AppShell>
  );
}
