import { useState, useEffect, useMemo, useRef, forwardRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check, ChevronsUpDown, Zap, Truck, ShieldCheck, FileText, Wallet,
  Calendar as CalendarIcon, Sparkles, AlertTriangle, CircleCheck, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { upsertVehicle } from "@/lib/vehicles.functions";
import { VEHICLE_MAKES, MODELS_BY_MAKE, FUEL_TYPES, INDIAN_STATE_CODES } from "./vehicle-presets";
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
  const [quickMode, setQuickMode] = useState(false);
  const [regParts, setRegParts] = useState({ state: "", district: "", series: "", number: "" });
  const stateRef = useRef<HTMLInputElement>(null);
  const districtRef = useRef<HTMLInputElement>(null);
  const seriesRef = useRef<HTMLInputElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);

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
      setQuickMode(!initial);
      setRegParts(parseReg(initial?.registration_number ?? ""));
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

  const make = watch("make");
  const model = watch("model");
  const status = watch("status");
  const vehicleType = watch("vehicle_type");
  const fuelType = watch("fuel_type");

  const modelOptions = useMemo(() => MODELS_BY_MAKE[make] ?? [], [make]);

  // Sync reg parts -> full registration string
  useEffect(() => {
    const composed = [regParts.state, regParts.district, regParts.series, regParts.number]
      .filter(Boolean)
      .join("");
    setValue("registration_number", composed.toUpperCase());
  }, [regParts, setValue]);

  const handlePickModel = (preset: { name: string; fuel: string; capacityTons: number }) => {
    setValue("model", preset.name);
    if (!watch("fuel_type")) setValue("fuel_type", preset.fuel);
    else setValue("fuel_type", preset.fuel);
    setValue("capacity_tons", String(preset.capacityTons));
  };

  const onSubmit = (v: FormValues) => {
    if (!v.registration_number || v.registration_number.length < 3) {
      toast.error("Enter a valid registration number");
      return;
    }
    mut.mutate(v);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[92vh] overflow-hidden border-border/50 bg-background/95 p-0 backdrop-blur-xl sm:rounded-2xl"
      >
        {/* Header */}
        <div className="relative border-b border-border/50 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 px-6 py-5">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/15 p-2.5 text-primary ring-1 ring-primary/20">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg">
                    {initial ? "Edit vehicle" : "Add vehicle"}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    {quickMode ? "Quick entry — under 30 seconds" : "Full details for compliance & finance"}
                  </p>
                </div>
              </div>
              {!initial && (
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs">
                  <Zap className={cn("h-3.5 w-3.5", quickMode && "text-primary")} />
                  <span className="hidden sm:inline">Quick mode</span>
                  <Switch checked={quickMode} onCheckedChange={setQuickMode} />
                </label>
              )}
            </div>
          </DialogHeader>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex max-h-[calc(92vh-88px)] flex-col"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {/* Registration */}
            <SectionCard icon={<Sparkles className="h-4 w-4" />} title="Registration">
              <div className="grid gap-2 sm:grid-cols-[80px_80px_90px_1fr]">
                <RegPart
                  ref={stateRef}
                  label="State"
                  value={regParts.state}
                  onChange={(v) => {
                    const up = v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
                    setRegParts((p) => ({ ...p, state: up }));
                    if (up.length === 2) districtRef.current?.focus();
                  }}
                  placeholder="MH"
                  list="state-codes"
                />
                <datalist id="state-codes">
                  {INDIAN_STATE_CODES.map((s) => <option key={s} value={s} />)}
                </datalist>
                <RegPart
                  ref={districtRef}
                  label="District"
                  value={regParts.district}
                  onChange={(v) => {
                    const up = v.replace(/[^0-9]/g, "").slice(0, 2);
                    setRegParts((p) => ({ ...p, district: up }));
                    if (up.length === 2) seriesRef.current?.focus();
                  }}
                  placeholder="23"
                />
                <RegPart
                  ref={seriesRef}
                  label="Series"
                  value={regParts.series}
                  onChange={(v) => {
                    const up = v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
                    setRegParts((p) => ({ ...p, series: up }));
                    if (up.length >= 2) numberRef.current?.focus();
                  }}
                  placeholder="AZ"
                />
                <RegPart
                  ref={numberRef}
                  label="Number"
                  value={regParts.number}
                  onChange={(v) => {
                    const up = v.replace(/[^0-9]/g, "").slice(0, 4);
                    setRegParts((p) => ({ ...p, number: up }));
                  }}
                  placeholder="2364"
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Preview:{" "}
                  <span className="font-mono font-semibold tracking-wider text-foreground">
                    {watch("registration_number") || "—"}
                  </span>
                </span>
                {errors.registration_number && (
                  <span className="text-destructive">Required</span>
                )}
              </div>
              <input type="hidden" {...register("registration_number", { required: true, minLength: 3 })} />
            </SectionCard>

            {/* Make / Model / Fuel / Capacity */}
            <SectionCard icon={<Truck className="h-4 w-4" />} title="Vehicle details">
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldWrap label="Make">
                  <Combobox
                    value={make}
                    onChange={(v) => {
                      setValue("make", v);
                      setValue("model", "");
                    }}
                    options={VEHICLE_MAKES}
                    placeholder="Select or type…"
                    emptyLabel="Use custom make"
                  />
                </FieldWrap>
                <FieldWrap label="Model">
                  <Combobox
                    value={model}
                    onChange={(v) => {
                      setValue("model", v);
                      const preset = modelOptions.find((m) => m.name === v);
                      if (preset) handlePickModel(preset);
                    }}
                    options={modelOptions.map((m) => m.name)}
                    placeholder={make ? "Select or type model…" : "Pick a make first"}
                    emptyLabel="Use custom model"
                    disabled={!make && modelOptions.length === 0}
                  />
                  {model && modelOptions.find((m) => m.name === model) && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-primary">
                      <Sparkles className="h-3 w-3" /> Auto-filled fuel & capacity
                    </p>
                  )}
                </FieldWrap>

                {!quickMode && (
                  <>
                    <FieldWrap label="Fuel type">
                      <Combobox
                        value={fuelType}
                        onChange={(v) => setValue("fuel_type", v)}
                        options={FUEL_TYPES}
                        placeholder="Diesel"
                        emptyLabel="Use custom fuel"
                      />
                    </FieldWrap>
                    <FieldWrap label="Capacity (tons)">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-10 rounded-lg"
                        {...register("capacity_tons")}
                      />
                    </FieldWrap>
                    <FieldWrap label="Year">
                      <Input type="number" className="h-10 rounded-lg" placeholder="2022" {...register("year")} />
                    </FieldWrap>
                    <FieldWrap label="Type">
                      <ChipRow
                        options={[
                          { v: "truck", label: "Truck" },
                          { v: "trailer", label: "Trailer" },
                          { v: "tanker", label: "Tanker" },
                          { v: "container", label: "Container" },
                          { v: "pickup", label: "Pickup" },
                          { v: "other", label: "Other" },
                        ]}
                        value={vehicleType}
                        onChange={(v) => setValue("vehicle_type", v as FormValues["vehicle_type"])}
                      />
                    </FieldWrap>
                  </>
                )}
              </div>

              <div className="mt-3">
                <Label className="mb-1.5 block text-xs text-muted-foreground">Status</Label>
                <ChipRow
                  options={[
                    { v: "active", label: "● Active", tone: "success" },
                    { v: "on_trip", label: "● On Trip", tone: "info" },
                    { v: "maintenance", label: "● Maintenance", tone: "warn" },
                    { v: "inactive", label: "● Inactive", tone: "muted" },
                  ]}
                  value={status}
                  onChange={(v) => {
                    // schema only allows active/maintenance/inactive — map on_trip -> active
                    const mapped = v === "on_trip" ? "active" : (v as FormValues["status"]);
                    setValue("status", mapped);
                  }}
                />
              </div>
            </SectionCard>

            {!quickMode && (
              <>
                {/* Documents */}
                <SectionCard icon={<ShieldCheck className="h-4 w-4" />} title="Document expiry">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DateField label="Insurance" reg={register("insurance_expiry")} value={watch("insurance_expiry")} />
                    <DateField label="Permit" reg={register("permit_expiry")} value={watch("permit_expiry")} />
                    <DateField label="Fitness" reg={register("fitness_expiry")} value={watch("fitness_expiry")} />
                    <DateField label="PUC" reg={register("puc_expiry")} value={watch("puc_expiry")} />
                  </div>
                </SectionCard>

                {/* EMI & Maintenance */}
                <SectionCard icon={<Wallet className="h-4 w-4" />} title="EMI & maintenance">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DateField label="Next EMI due" reg={register("emi_next_due")} value={watch("emi_next_due")} />
                    <DateField label="Next maintenance" reg={register("maintenance_next_due")} value={watch("maintenance_next_due")} />
                  </div>
                </SectionCard>

                {/* Notes */}
                <SectionCard icon={<FileText className="h-4 w-4" />} title="Notes">
                  <Textarea
                    rows={2}
                    className="rounded-lg"
                    placeholder="Any additional info about this vehicle…"
                    {...register("notes")}
                  />
                </SectionCard>
              </>
            )}
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border/50 bg-background/95 px-6 py-3 backdrop-blur-xl">
            <div className="text-[11px] text-muted-foreground">
              {quickMode ? "Add more details anytime later." : "All fields optional except registration."}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={mut.isPending}
                className="min-w-[110px] rounded-lg shadow-lg shadow-primary/20"
              >
                {mut.isPending ? "Saving…" : initial ? "Save changes" : "Add vehicle"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Helpers ---------- */

function parseReg(raw: string) {
  const clean = (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = clean.match(/^([A-Z]{0,2})(\d{0,2})([A-Z]{0,3})(\d{0,4})/);
  return {
    state: m?.[1] ?? "",
    district: m?.[2] ?? "",
    series: m?.[3] ?? "",
    number: m?.[4] ?? "",
  };
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-4 shadow-sm backdrop-blur-md transition-colors hover:border-border">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <span className="text-primary">{icon}</span>
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

type RegPartProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  list?: string;
};
const RegPart = forwardRef<HTMLInputElement, RegPartProps>(function RegPart(
  { label, value, onChange, placeholder, list }, ref,
) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={list}
        className="h-11 rounded-lg text-center font-mono text-base font-semibold tracking-widest uppercase"
      />
    </div>
  );
});

function ChipRow<T extends string>({
  options, value, onChange,
}: {
  options: { v: T; label: string; tone?: "success" | "warn" | "info" | "muted" }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.v === value;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-all",
              active
                ? "border-primary/40 bg-primary/15 text-primary shadow-sm shadow-primary/20 ring-1 ring-primary/30"
                : "border-border/60 bg-card/50 text-muted-foreground hover:border-border hover:bg-card",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Combobox({
  value, onChange, options, placeholder, emptyLabel, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  emptyLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/50 px-3 text-sm transition-colors",
            "hover:border-border focus:outline-none focus:ring-2 focus:ring-primary/30",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
        <Command shouldFilter>
          <CommandInput placeholder="Search or type custom…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              {query ? (
                <button
                  type="button"
                  onClick={() => { onChange(query); setOpen(false); setQuery(""); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Use "<span className="font-medium">{query}</span>"
                </button>
              ) : (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">{emptyLabel}</div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => { onChange(opt); setOpen(false); setQuery(""); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                  {opt}
                </CommandItem>
              ))}
              {query && !options.some((o) => o.toLowerCase() === query.toLowerCase()) && (
                <CommandItem
                  value={`__use_${query}`}
                  onSelect={() => { onChange(query); setOpen(false); setQuery(""); }}
                >
                  <Sparkles className="mr-2 h-4 w-4 text-primary" />
                  Use "{query}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DateField({
  label, reg, value,
}: {
  label: string;
  reg: ReturnType<ReturnType<typeof useForm<FormValues>>["register"]>;
  value: string;
}) {
  const badge = getExpiryBadge(value);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {badge && (
          <Badge variant="outline" className={cn("gap-1 px-1.5 py-0 text-[10px]", badge.className)}>
            <badge.Icon className="h-3 w-3" />
            {badge.label}
          </Badge>
        )}
      </div>
      <div className="relative">
        <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input type="date" className="h-10 rounded-lg pl-9" {...reg} />
      </div>
    </div>
  );
}

function getExpiryBadge(value: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: "Expired", Icon: AlertTriangle, className: "border-destructive/40 text-destructive" };
  if (days <= 30) return { label: `${days}d left`, Icon: Clock, className: "border-yellow-500/40 text-yellow-500" };
  return { label: "Valid", Icon: CircleCheck, className: "border-emerald-500/40 text-emerald-500" };
}
