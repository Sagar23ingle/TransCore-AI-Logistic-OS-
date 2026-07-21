import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useMutation, useQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Truck, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SelectPills, SearchableDropdown } from "@/components/ui/smart-select";
import { upsertTrip } from "@/lib/trips.functions";
import { listVehicles } from "@/lib/vehicles.functions";
import { listDrivers } from "@/lib/drivers.functions";
import type { Tables } from "@/integrations/supabase/types";

type Trip = Tables<"trips">;
type Values = {
  origin: string; destination: string; vehicle_id: string; driver_id: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  scheduled_start: string; actual_start: string; actual_end: string;
  distance_km: string; freight_amount: string; advance_paid: string;
  goods_description: string; client_name: string; notes: string;
};
const d = (v: string | null | undefined) => v ?? "";
const TRIP_STATUS = [
  { value: "planned" as const, label: "Planned", icon: Calendar },
  { value: "in_progress" as const, label: "Active", icon: Truck },
  { value: "completed" as const, label: "Done", icon: CheckCircle2 },
  { value: "cancelled" as const, label: "Cancelled", icon: XCircle },
];

export function TripFormDialog({ open, onOpenChange, initial, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; initial?: Trip; onSaved?: () => void }) {
  const upsert = useServerFn(upsertTrip);
  const vehiclesFn = useServerFn(listVehicles);
  const driversFn = useServerFn(listDrivers);
  const { register, handleSubmit, reset, setValue, watch } = useForm<Values>();

  const vehiclesQ = useQuery(queryOptions({ queryKey: ["vehicles"], queryFn: () => vehiclesFn(), enabled: open }));
  const driversQ = useQuery(queryOptions({ queryKey: ["drivers"], queryFn: () => driversFn(), enabled: open }));

  useEffect(() => {
    if (open) reset({
      origin: initial?.origin ?? "", destination: initial?.destination ?? "",
      vehicle_id: d(initial?.vehicle_id), driver_id: d(initial?.driver_id),
      status: (initial?.status as Values["status"]) ?? "planned",
      scheduled_start: initial?.scheduled_start ? initial.scheduled_start.slice(0, 16) : "",
      actual_start: initial?.actual_start ? initial.actual_start.slice(0, 16) : "",
      actual_end: initial?.actual_end ? initial.actual_end.slice(0, 16) : "",
      distance_km: initial?.distance_km != null ? String(initial.distance_km) : "",
      freight_amount: initial?.freight_amount != null ? String(initial.freight_amount) : "",
      advance_paid: initial?.advance_paid != null ? String(initial.advance_paid) : "",
      goods_description: d(initial?.goods_description), client_name: d(initial?.client_name), notes: d(initial?.notes),
    });
  }, [open, initial, reset]);

  const mut = useMutation({
    mutationFn: (v: Values) => upsert({
      data: {
        id: initial?.id,
        origin: v.origin, destination: v.destination,
        vehicle_id: v.vehicle_id || null, driver_id: v.driver_id || null,
        status: v.status,
        scheduled_start: v.scheduled_start ? new Date(v.scheduled_start).toISOString() : null,
        actual_start: v.actual_start ? new Date(v.actual_start).toISOString() : null,
        actual_end: v.actual_end ? new Date(v.actual_end).toISOString() : null,
        distance_km: v.distance_km ? Number(v.distance_km) : null,
        freight_amount: v.freight_amount ? Number(v.freight_amount) : null,
        advance_paid: v.advance_paid ? Number(v.advance_paid) : null,
        goods_description: v.goods_description || null, client_name: v.client_name || null, notes: v.notes || null,
      },
    }),
    onSuccess: () => { toast.success(initial ? "Trip updated" : "Trip created"); onOpenChange(false); onSaved?.(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92dvh] gap-3 overflow-hidden p-0 sm:p-6 flex flex-col">
        <DialogHeader className="px-4 pt-4 sm:px-0 sm:pt-0"><DialogTitle>{initial ? "Edit trip" : "New trip"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="grid gap-3 sm:grid-cols-2 overflow-y-auto px-4 pb-4 sm:px-0 sm:pb-0 min-h-0 flex-1">
          <F label="Origin *"><Input {...register("origin", { required: true })} /></F>
          <F label="Destination *"><Input {...register("destination", { required: true })} /></F>
          <F label="Vehicle">
            <SearchableDropdown
              ariaLabel="Vehicle"
              placeholder="Unassigned"
              clearable
              value={watch("vehicle_id")}
              onChange={(v) => setValue("vehicle_id", v)}
              options={(vehiclesQ.data ?? []).map((v) => ({ value: v.id, label: v.registration_number }))}
            />
          </F>
          <F label="Driver">
            <SearchableDropdown
              ariaLabel="Driver"
              placeholder="Unassigned"
              clearable
              value={watch("driver_id")}
              onChange={(v) => setValue("driver_id", v)}
              options={(driversQ.data ?? []).map((dr) => ({ value: dr.id, label: dr.full_name }))}
            />
          </F>
          <F label="Status" full>
            <SelectPills
              ariaLabel="Trip status"
              value={watch("status")}
              onChange={(v) => setValue("status", v)}
              options={TRIP_STATUS}
            />
          </F>
          <F label="Client name"><Input {...register("client_name")} /></F>
          <F label="Scheduled start"><Input type="datetime-local" {...register("scheduled_start")} /></F>
          <F label="Actual start"><Input type="datetime-local" {...register("actual_start")} /></F>
          <F label="Actual end"><Input type="datetime-local" {...register("actual_end")} /></F>
          <F label="Distance (km)"><Input type="number" step="0.1" {...register("distance_km")} /></F>
          <F label="Freight amount (₹)"><Input type="number" step="0.01" {...register("freight_amount")} /></F>
          <F label="Advance paid (₹)"><Input type="number" step="0.01" {...register("advance_paid")} /></F>
          <F label="Goods description" full><Input {...register("goods_description")} /></F>
          <F label="Notes" full><Textarea rows={2} {...register("notes")} /></F>
          <DialogFooter className="sm:col-span-2 sticky bottom-0 bg-background pt-3 -mx-4 px-4 sm:mx-0 sm:px-0 border-t sm:border-t-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (<div className={full ? "sm:col-span-2 space-y-1" : "space-y-1"}><Label className="text-xs">{label}</Label>{children}</div>);
}
