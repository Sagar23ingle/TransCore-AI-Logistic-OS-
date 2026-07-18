import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CircleCheck, Clock, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SelectPills } from "@/components/ui/smart-select";
import { upsertDriver } from "@/lib/drivers.functions";
import type { Tables } from "@/integrations/supabase/types";

type Driver = Tables<"drivers">;
type FormValues = {
  full_name: string; phone: string; license_number: string; license_expiry: string;
  address: string; status: "active" | "on_leave" | "inactive"; monthly_salary: string;
  joined_on: string; notes: string;
};
const d = (v: string | null | undefined) => v ?? "";
const STATUS_OPTIONS = [
  { value: "active" as const, label: "Active", icon: CircleCheck },
  { value: "on_leave" as const, label: "On leave", icon: Clock },
  { value: "inactive" as const, label: "Inactive", icon: PauseCircle },
];

export function DriverFormDialog({ open, onOpenChange, initial, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; initial?: Driver; onSaved?: () => void }) {
  const upsert = useServerFn(upsertDriver);
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>();

  useEffect(() => {
    if (open) reset({
      full_name: initial?.full_name ?? "", phone: d(initial?.phone), license_number: d(initial?.license_number),
      license_expiry: d(initial?.license_expiry), address: d(initial?.address),
      status: (initial?.status as FormValues["status"]) ?? "active",
      monthly_salary: initial?.monthly_salary != null ? String(initial.monthly_salary) : "",
      joined_on: d(initial?.joined_on), notes: d(initial?.notes),
    });
  }, [open, initial, reset]);

  const mut = useMutation({
    mutationFn: (v: FormValues) => upsert({
      data: {
        id: initial?.id, full_name: v.full_name, phone: v.phone || null,
        license_number: v.license_number || null, license_expiry: v.license_expiry || null,
        address: v.address || null, status: v.status,
        monthly_salary: v.monthly_salary ? Number(v.monthly_salary) : null,
        joined_on: v.joined_on || null, notes: v.notes || null,
      },
    }),
    onSuccess: () => { toast.success(initial ? "Driver updated" : "Driver added"); onOpenChange(false); onSaved?.(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{initial ? "Edit driver" : "Add driver"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="grid gap-3 sm:grid-cols-2">
          <F label="Full name *"><Input {...register("full_name", { required: true })} /></F>
          <F label="Phone"><Input {...register("phone")} /></F>
          <F label="License number"><Input {...register("license_number")} /></F>
          <F label="License expiry"><Input type="date" {...register("license_expiry")} /></F>
          <F label="Status">
            <SelectPills
              ariaLabel="Driver status"
              value={watch("status")}
              onChange={(v) => setValue("status", v)}
              options={STATUS_OPTIONS}
            />
          </F>
          <F label="Monthly salary (₹)"><Input type="number" step="0.01" {...register("monthly_salary")} /></F>
          <F label="Joined on"><Input type="date" {...register("joined_on")} /></F>
          <F label="Address" full><Input {...register("address")} /></F>
          <F label="Notes" full><Textarea rows={2} {...register("notes")} /></F>
          <DialogFooter className="sm:col-span-2">
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
