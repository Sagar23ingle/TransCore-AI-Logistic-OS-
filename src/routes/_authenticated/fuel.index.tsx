import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fuel, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableDropdown } from "@/components/ui/smart-select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { deleteFuelLog, listFuelLogs, upsertFuelLog, getFuelAnalytics } from "@/lib/fuel.functions";
import { listVehicles } from "@/lib/vehicles.functions";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/fuel/")({
  head: () => ({ meta: [{ title: "Fuel — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: FuelPage,
});

type Values = {
  vehicle_id: string; filled_on: string; odometer_km: string; litres: string;
  price_per_litre: string; total_amount: string; station: string; is_full_tank: boolean; notes: string;
};

function FuelPage() {
  const listFn = useServerFn(listFuelLogs);
  const upsertFn = useServerFn(upsertFuelLog);
  const delFn = useServerFn(deleteFuelLog);
  const anFn = useServerFn(getFuelAnalytics);
  const vFn = useServerFn(listVehicles);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const logs = useQuery(queryOptions({ queryKey: ["fuel-logs"], queryFn: () => listFn() }));
  const ana = useQuery(queryOptions({ queryKey: ["fuel-analytics"], queryFn: () => anFn() }));
  const vehiclesQ = useQuery(queryOptions({ queryKey: ["vehicles"], queryFn: () => vFn(), enabled: open }));

  const { register, handleSubmit, reset, setValue, watch } = useForm<Values>({
    defaultValues: {
      vehicle_id: "", filled_on: new Date().toISOString().slice(0, 10), odometer_km: "",
      litres: "", price_per_litre: "", total_amount: "", station: "", is_full_tank: true, notes: "",
    },
  });
  useEffect(() => { if (open) reset({
    vehicle_id: "", filled_on: new Date().toISOString().slice(0, 10), odometer_km: "",
    litres: "", price_per_litre: "", total_amount: "", station: "", is_full_tank: true, notes: "",
  }); }, [open, reset]);

  // Auto-compute total when litres + price changes
  const litres = watch("litres"); const price = watch("price_per_litre");
  useEffect(() => {
    const l = Number(litres), p = Number(price);
    if (l > 0 && p > 0) setValue("total_amount", (l * p).toFixed(2));
  }, [litres, price, setValue]);

  const mut = useMutation({
    mutationFn: (v: Values) => upsertFn({ data: {
      vehicle_id: v.vehicle_id, filled_on: v.filled_on, odometer_km: Number(v.odometer_km),
      litres: Number(v.litres), price_per_litre: Number(v.price_per_litre), total_amount: Number(v.total_amount),
      station: v.station || null, is_full_tank: v.is_full_tank, notes: v.notes || null,
    } }),
    onSuccess: () => {
      toast.success("Fuel entry saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["fuel-logs"] });
      qc.invalidateQueries({ queryKey: ["fuel-analytics"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fuel-logs"] });
      qc.invalidateQueries({ queryKey: ["fuel-analytics"] });
    },
  });

  const anomalies = (ana.data?.stats ?? []).flatMap((s) => s.anomalies.map((a) => ({ ...a, vehicle_id: s.vehicle_id })));

  return (
    <AppShell title="Fuel Management" description="Track fills, mileage, and detect anomalies that may indicate leaks or theft."
      action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Log fill</Button>}>
      {logs.isLoading || ana.isLoading ? <LoadingState /> : (
        <div className="space-y-6">
          {anomalies.length > 0 && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader className="flex-row items-center gap-2 space-y-0"><AlertTriangle className="h-4 w-4 text-destructive" /><CardTitle className="text-sm">Fuel anomalies detected</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {anomalies.slice(0, 5).map((a) => (
                    <li key={a.id}>
                      {formatDate(a.filled_on)} — {a.kmpl} km/l ({a.deviation > 0 ? "+" : ""}{a.deviation}% vs average)
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Monthly fuel spend</CardTitle></CardHeader>
              <CardContent className="h-64">
                {(!ana.data || ana.data.trend.every((t) => t.cost === 0)) ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Log fills to see the trend.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ana.data.trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                      <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)" }} />
                      <Bar dataKey="cost" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Monthly litres</CardTitle></CardHeader>
              <CardContent className="h-64">
                {(!ana.data || ana.data.trend.every((t) => t.litres === 0)) ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">—</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ana.data.trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                      <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)" }} />
                      <Line type="monotone" dataKey="litres" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Fuel logs</CardTitle></CardHeader>
            <CardContent>
              {!logs.data || logs.data.length === 0 ? (
                <EmptyState icon={<Fuel className="h-6 w-6" />} title="No fills yet"
                  description="Log every fuel fill to compute real mileage and catch anomalies."
                  action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Log fill</Button>} />
              ) : (
                <div className="grid gap-2">
                  {logs.data.map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {l.vehicle && <Badge variant="secondary">{l.vehicle.registration_number}</Badge>}
                          <span className="num text-sm font-semibold">{formatNumber(Number(l.litres), 1)} L</span>
                          <span className="text-xs text-muted-foreground">@ ₹{Number(l.price_per_litre).toFixed(2)}/L</span>
                          <span className="num text-sm font-semibold">{formatINR(Number(l.total_amount))}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDate(l.filled_on)} · odo {formatNumber(Number(l.odometer_km))} km
                          {l.station ? ` · ${l.station}` : ""}
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove entry?")) del.mutate(l.id as string); }}>
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
          <DialogHeader><DialogTitle>Log fuel fill</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="grid gap-3 sm:grid-cols-2">
            <F label="Vehicle *" full>
              <SearchableDropdown
                placeholder="Select vehicle" ariaLabel="Vehicle"
                value={watch("vehicle_id")}
                onChange={(v) => setValue("vehicle_id", v as string)}
                options={(vehiclesQ.data ?? []).map((v) => ({ value: v.id, label: v.registration_number }))}
              />
            </F>
            <F label="Date *"><Input type="date" required {...register("filled_on")} /></F>
            <F label="Odometer (km) *"><Input type="number" step="1" required {...register("odometer_km")} /></F>
            <F label="Litres *"><Input type="number" step="0.01" required {...register("litres")} /></F>
            <F label="Price/L (₹) *"><Input type="number" step="0.01" required {...register("price_per_litre")} /></F>
            <F label="Total (₹) *" full><Input type="number" step="0.01" required {...register("total_amount")} /></F>
            <F label="Station" full><Input {...register("station")} /></F>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input id="ft" type="checkbox" {...register("is_full_tank")} />
              <Label htmlFor="ft" className="text-xs">Tank filled to full (required for mileage calc)</Label>
            </div>
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