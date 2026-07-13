import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VehicleInput = z.object({
  id: z.string().uuid().optional(),
  registration_number: z.string().trim().min(3).max(20).transform((s) => s.toUpperCase()),
  make: z.string().max(60).nullish(),
  model: z.string().max(60).nullish(),
  year: z.number().int().min(1980).max(2100).nullish(),
  vehicle_type: z.enum(["truck", "trailer", "tanker", "container", "pickup", "other"]),
  status: z.enum(["active", "maintenance", "inactive"]),
  capacity_tons: z.number().min(0).max(1000).nullish(),
  odometer_km: z.number().min(0).nullish(),
  fuel_type: z.string().max(30).nullish(),
  insurance_expiry: z.string().nullish(),
  permit_expiry: z.string().nullish(),
  fitness_expiry: z.string().nullish(),
  puc_expiry: z.string().nullish(),
  emi_next_due: z.string().nullish(),
  maintenance_next_due: z.string().nullish(),
  notes: z.string().max(2000).nullish(),
});

export const listVehicles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vehicles")
      .select("*")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getVehicle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("vehicles")
      .select("*")
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const upsertVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => VehicleInput.parse(raw))
  .handler(async ({ context, data }) => {
    const payload = { ...data, owner_id: context.userId };
    const { data: row, error } = await context.supabase
      .from("vehicles")
      .upsert(payload as never, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("vehicles")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
