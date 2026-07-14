import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MaintenanceInput = z.object({
  id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid(),
  serviced_on: z.string(),
  service_type: z.string().trim().min(2).max(120),
  odometer_km: z.number().min(0).max(9_999_999).nullish(),
  cost: z.number().min(0).max(10_000_000),
  vendor: z.string().max(120).nullish(),
  next_service_due_on: z.string().nullish(),
  next_service_due_km: z.number().min(0).max(9_999_999).nullish(),
  notes: z.string().max(1000).nullish(),
});

export const listMaintenance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("maintenance_logs")
      .select("*, vehicle:vehicles(id, registration_number)")
      .eq("owner_id", context.userId)
      .order("serviced_on", { ascending: false })
      .limit(500);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return data ?? [];
  });

export const upsertMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => MaintenanceInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("maintenance_logs")
      .upsert({ ...data, owner_id: context.userId } as never, { onConflict: "id" })
      .select("*")
      .single();
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    if (data.next_service_due_on) {
      await context.supabase
        .from("vehicles")
        .update({ maintenance_next_due: data.next_service_due_on } as never)
        .eq("id", data.vehicle_id)
        .eq("owner_id", context.userId);
    }
    if (data.cost > 0) {
      await context.supabase.from("expenses").insert({
        owner_id: context.userId,
        vehicle_id: data.vehicle_id,
        category: "maintenance",
        amount: data.cost,
        incurred_on: data.serviced_on,
        description: `${data.service_type}${data.vendor ? " · " + data.vendor : ""}`,
      } as never);
    }
    return row;
  });

export const deleteMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("maintenance_logs")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return { ok: true };
  });

export const getVehicleHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [vR, mR] = await Promise.all([
      supabase.from("vehicles").select("id, registration_number, insurance_expiry, permit_expiry, fitness_expiry, puc_expiry, maintenance_next_due").eq("owner_id", userId),
      supabase.from("maintenance_logs").select("vehicle_id, serviced_on, cost").eq("owner_id", userId).gte("serviced_on", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    ]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scores = (vR.data ?? []).map((v) => {
      let score = 100;
      const issues: string[] = [];
      const fields: Array<[string, string | null]> = [
        ["Insurance", v.insurance_expiry as string | null],
        ["Permit", v.permit_expiry as string | null],
        ["Fitness", v.fitness_expiry as string | null],
        ["PUC", v.puc_expiry as string | null],
        ["Service", v.maintenance_next_due as string | null],
      ];
      for (const [name, date] of fields) {
        if (!date) { score -= 5; issues.push(`${name} date missing`); continue; }
        const d = new Date(date);
        const days = Math.floor((d.getTime() - today.getTime()) / 86400000);
        if (days < 0) { score -= 20; issues.push(`${name} expired`); }
        else if (days <= 7) { score -= 10; issues.push(`${name} expires in ${days}d`); }
        else if (days <= 30) { score -= 3; }
      }
      const recent = (mR.data ?? []).filter((m) => m.vehicle_id === v.id);
      if (recent.length >= 3) { score -= 5; issues.push(`${recent.length} services in last 90d`); }
      return {
        vehicle_id: v.id,
        registration_number: v.registration_number as string,
        score: Math.max(0, Math.min(100, score)),
        issues,
      };
    });
    return scores.sort((a, b) => a.score - b.score);
  });