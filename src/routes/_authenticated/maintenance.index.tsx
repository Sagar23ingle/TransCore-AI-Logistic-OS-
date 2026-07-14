import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wrench, Plus, Trash2, Heart } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { deleteMaintenance, listMaintenance, upsertMaintenance, getVehicleHealth } from "@/lib/maintenance.functions";
import { listVehicles } from "@/lib/vehicles.functions";
import { formatDate, formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/maintenance/")({
  head: () => ({ meta: [{ title: "Maintenance — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: MaintenancePage,
});

type Values = {
  vehicle_id: string; serviced_on: string; service_type: string; odometer_km: string;
  cost: string; vendor: string; next_service_due_on: string; next_service_due_km: string; notes: string;
};

function MaintenancePage() {
  const listFn = useServerFn(listMaintenance);
  const upsertFn = useServerFn(upsertMaintenance);
  const delFn = useServerFn(deleteMaintenance);
  const healthFn = useServerFn(getVehicleHealth);
  const vFn = useServerFn(listVehicles);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const logs = useQuery(queryOptions({ queryKey: ["maintenance"], queryFn: () => listFn() }));
  const health = useQuery(queryOptions({ queryKey: ["vehicle-health"], queryFn: () => healthFn() }));
  const vehiclesQ = useQuery(queryOptions({ queryKey: ["vehicles"], queryFn: () => vFn(), enabled: open }));

  const { register, handleSubmit, reset, setValue, watch } = useForm<Values>({
    defaultValues: {
      vehicle_id: "", serviced_on: new Date().toISOString().slice(0, 10), service_type: "",
      odometer_km: "", cost: "0", vendor: "", next_service_due_on: "", next_service_due_km: "", notes: "",
    },
  });
  useEffect(() => { if (open) reset({
    vehicle_id: "", serviced_on: new Date().toISOString().slice(0, 10), service_type: "",
    odometer_km: "", cost: "0", vendor: "", next_service_due_on: "", next_service_due_km: "", notes: "",
  }); }, [open, reset]);

  const mut = useMutation({
    mutationFn: (v: Values) => upsertFn({ data: {
      vehicle_id: v.vehicle_id, serviced_on: v.serviced_on, service_type: v.service_type,
      odometer_km: v.odometer_km ? Number(v.odometer_km) : null,
      cost: Number(v.cost || 0), vendor: v.vendor || null,
      next_service_due_on: v.next_service_due_on || null,
      next_service_due_km: v.next_service_due_km ? Number(v.next_service_due_km) : null,
      notes: v.notes || null,
    } }),
    onSuccess: () => {
      toast.success("Service recorded");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["vehicle-health"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maintenance"] }); qc.invalidateQueries({ queryKey: ["vehicle-health"] }); },
  });

  function healthColor(s: number) {
    if (s >= 80) return "text-accent";
    if (s >= 60) return "text-yellow-500";
    return "text-destructive";
  }

  return (
    <AppShell title="Maintenance" description="Service history + real-time vehicle health score based on document expiries and service load."
      action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Log service</Button>}>
      {logs.isLoading || health.isLoading ? <LoadingState /> : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <Heart className="h-4 w-4 text-primary" /><CardTitle className="text-base">Vehicle health</CardTitle>
            </CardHeader>
            <CardContent>
              {(!health.data || health.data.length === 0) ? (
                <div className="text-sm text-muted-foreground">Add vehicles to see health scores.</div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {health.data.map((h) => (
                    <div key={h.vehicle_id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm">{h.registration_number}</span>
                        <span className={`num text-lg font-semibold ${healthColor(h.score)}`}>{h.score}</span>
                      </div>
                      {h.issues.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                          {h.issues.slice(0, 4).map((i, idx) => <li key={idx}>· {i}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Service history</CardTitle></CardHeader>
            <CardContent>
              {!logs.data || logs.data.length === 0 ? (
                <EmptyState icon={<Wrench className="h-6 w-6" />} title="No services logged yet"
                  description="Record every service to build up a real maintenance history."
                  action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Log service</Button>} />
              ) : (
                <div className="grid gap-2">
                  {logs.data.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {m.vehicle && <Badge variant="secondary">{m.vehicle.registration_number}</Badge>}
                          <span className="text-sm font-semibold">{m.service_type}</span>
                          {Number(m.cost) > 0 && <span className="num text-xs text-muted-foreground">{formatINR(Number(m.cost))}</span>}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDate(m.serviced_on)}{m.vendor ? ` · ${m.vendor}` : ""}
                          {m.next_service_due_on ? ` · next due ${formatDate(m.next_service_due_on)}` : ""}
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove entry?")) del.mutate(m.id as string); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Log service</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="grid gap-3 sm:grid-cols-2">
            <F label="Vehicle *" full>
              <Select value={watch("vehicle_id")} onValueChange={(v) => setValue("vehicle_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>{(vehiclesQ.data ?? []).map((v) => (<SelectItem key={v.id} value={v.id}>{v.registration_number}</SelectItem>))}</SelectContent>
              </Select>
            </F>
            <F label="Date *"><Input type="date" required {...register("serviced_on")} /></F>
            <F label="Service type *"><Input required placeholder="Oil change / Brake pads / ..." {...register("service_type")} /></F>
            <F label="Odometer (km)"><Input type="number" step="1" {...register("odometer_km")} /></F>
            <F label="Cost (₹)"><Input type="number" step="0.01" {...register("cost")} /></F>
            <F label="Vendor" full><Input {...register("vendor")} /></F>
            <F label="Next due (date)"><Input type="date" {...register("next_service_due_on")} /></F>
            <F label="Next due (km)"><Input type="number" step="1" {...register("next_service_due_km")} /></F>
            <F label="Notes" full><Input {...register("notes")} /></F>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={mut.isPending || !watch("vehicle_id")}>{mut.isPending ? "Saving..." : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (<div className={full ? "sm:col-span-2 space-y-1" : "space-y-1"}><Label className="text-xs">{label}</Label>{children}</div>);
}