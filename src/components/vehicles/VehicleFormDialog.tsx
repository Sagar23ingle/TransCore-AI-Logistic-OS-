import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertVehicle } from "@/lib/vehicles.functions";
import type { Tables } from "@/integrations/supabase/types";

type Vehicle = Tables<"vehicles">;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Vehicle;
  onSaved?: () => void;
}

type FormValues = {
  registration_number: string;
  make: string;
  model: string;
  year: string;
  vehicle_type: "truck" | "trailer" | "tanker" | "container" | "pickup" | "other";
  status: "active" | "maintenance" | "inactive";
  capacity_tons: string;
  fuel_type: string;
  insurance_expiry: string;
  permit_expiry: string;
  fitness_expiry: string;
  puc_expiry: string;
  emi_next_due: string;
  maintenance_next_due: string;
  notes: string;
};

function d(v: string | null | undefined) {
  return v ? v : "";
}

export function VehicleFormDialog({ open, onOpenChange, initial, onSaved }: Props) {
  const upsert = useServerFn(upsertVehicle);
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>();

  useEffect(() => {
    if (open) {
      reset({
        registration_number: initial?.registration_number ?? "",
        make: d(initial?.make),
        model: d(initial?.model),
        year: initial?.year ? String(initial.year) : "",
        vehicle_type: (initial?.vehicle_type as FormValues["vehicle_type"]) ?? "truck",
        status: (initial?.status as FormValues["status"]) ?? "active",
        capacity_tons: initial?.capacity_tons != null ? String(initial.capacity_tons) : "",
        fuel_type: d(initial?.fuel_type),
        insurance_expiry: d(initial?.insurance_expiry),
        permit_expiry: d(initial?.permit_expiry),
        fitness_expiry: d(initial?.fitness_expiry),
        puc_expiry: d(initial?.puc_expiry),
        emi_next_due: d(initial?.emi_next_due),
        maintenance_next_due: d(initial?.maintenance_next_due),
        notes: d(initial?.notes),
      });
    }
  }, [open, initial, reset]);

  const mut = useMutation({
    mutationFn: (data: FormValues) =>
      upsert({
        data: {
          id: initial?.id,
          registration_number: data.registration_number,
          make: data.make || null,
          model: data.model || null,
          year: data.year ? Number(data.year) : null,
          vehicle_type: data.vehicle_type,
          status: data.status,
          capacity_tons: data.capacity_tons ? Number(data.capacity_tons) : null,
          fuel_type: data.fuel_type || null,
          insurance_expiry: data.insurance_expiry || null,
          permit_expiry: data.permit_expiry || null,
          fitness_expiry: data.fitness_expiry || null,
          puc_expiry: data.puc_expiry || null,
          emi_next_due: data.emi_next_due || null,
          maintenance_next_due: data.maintenance_next_due || null,
          notes: data.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success(initial ? "Vehicle updated" : "Vehicle added");
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="grid gap-3 sm:grid-cols-2">
          <Field label="Registration number *">
            <Input {...register("registration_number", { required: true, minLength: 3 })} placeholder="MH12AB1234" />
            {errors.registration_number && <ErrorText>Required</ErrorText>}
          </Field>
          <Field label="Type">
            <Select value={watch("vehicle_type")} onValueChange={(v) => setValue("vehicle_type", v as FormValues["vehicle_type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["truck", "trailer", "tanker", "container", "pickup", "other"] as const).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Make"><Input {...register("make")} /></Field>
          <Field label="Model"><Input {...register("model")} /></Field>
          <Field label="Year"><Input type="number" {...register("year")} /></Field>
          <Field label="Status">
            <Select value={watch("status")} onValueChange={(v) => setValue("status", v as FormValues["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["active", "maintenance", "inactive"] as const).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Capacity (tons)"><Input type="number" step="0.01" {...register("capacity_tons")} /></Field>
          <Field label="Fuel type"><Input {...register("fuel_type")} placeholder="Diesel" /></Field>
          <Field label="Insurance expiry"><Input type="date" {...register("insurance_expiry")} /></Field>
          <Field label="Permit expiry"><Input type="date" {...register("permit_expiry")} /></Field>
          <Field label="Fitness expiry"><Input type="date" {...register("fitness_expiry")} /></Field>
          <Field label="PUC expiry"><Input type="date" {...register("puc_expiry")} /></Field>
          <Field label="Next EMI due"><Input type="date" {...register("emi_next_due")} /></Field>
          <Field label="Next maintenance"><Input type="date" {...register("maintenance_next_due")} /></Field>
          <Field label="Notes" full><Textarea rows={2} {...register("notes")} /></Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2 space-y-1" : "space-y-1"}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-destructive">{children}</p>;
}
