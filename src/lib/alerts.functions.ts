import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WINDOWS = [30, 15, 7, 3, 0] as const;

function bucket(daysRemaining: number): number | null {
  for (const w of WINDOWS) {
    if (daysRemaining <= w) return w;
  }
  return null;
}

function severity(daysRemaining: number): "info" | "warning" | "critical" {
  if (daysRemaining <= 3) return "critical";
  if (daysRemaining <= 15) return "warning";
  return "info";
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

interface AlertRow {
  owner_id: string;
  vehicle_id?: string | null;
  driver_id?: string | null;
  kind: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  due_date: string;
  days_remaining: number;
  dedup_key: string;
}

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("alerts")
      .select("*, vehicle:vehicles(id, registration_number), driver:drivers(id, full_name)")
      .eq("owner_id", context.userId)
      .eq("is_dismissed", false)
      .order("severity", { ascending: false })
      .order("days_remaining", { ascending: true });
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return data ?? [];
  });

export const recomputeAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [vehR, driR] = await Promise.all([
      supabase.from("vehicles").select("id, registration_number, insurance_expiry, permit_expiry, fitness_expiry, puc_expiry, emi_next_due, maintenance_next_due").eq("owner_id", userId),
      supabase.from("drivers").select("id, full_name, license_expiry").eq("owner_id", userId),
    ]);

    const rows: AlertRow[] = [];

    const pushVehicle = (
      v: { id: string; registration_number: string },
      kind: string,
      label: string,
      date: string | null | undefined,
    ) => {
      const days = daysUntil(date ?? null);
      if (days == null) return;
      const b = bucket(days);
      if (b == null || days < 0 && b !== 0) {
        // Overdue: still alert once at bucket 0
        if (days >= -7) {
          rows.push({
            owner_id: userId,
            vehicle_id: v.id,
            kind,
            severity: "critical",
            title: `${label} overdue`,
            message: `${v.registration_number} — ${label} was due ${Math.abs(days)} day(s) ago.`,
            due_date: date!,
            days_remaining: days,
            dedup_key: `veh:${v.id}:${kind}:overdue`,
          });
        }
        return;
      }
      rows.push({
        owner_id: userId,
        vehicle_id: v.id,
        kind,
        severity: severity(days),
        title: `${label} in ${days} day(s)`,
        message: `${v.registration_number} — ${label} expires on ${date}.`,
        due_date: date!,
        days_remaining: days,
        dedup_key: `veh:${v.id}:${kind}:${b}`,
      });
    };

    for (const v of vehR.data ?? []) {
      pushVehicle(v, "insurance_expiry", "Insurance", v.insurance_expiry);
      pushVehicle(v, "permit_expiry", "Permit", v.permit_expiry);
      pushVehicle(v, "fitness_expiry", "Fitness certificate", v.fitness_expiry);
      pushVehicle(v, "puc_expiry", "PUC", v.puc_expiry);
      pushVehicle(v, "emi_due", "EMI payment", v.emi_next_due);
      pushVehicle(v, "maintenance_due", "Scheduled maintenance", v.maintenance_next_due);
    }
    for (const d of driR.data ?? []) {
      const days = daysUntil(d.license_expiry);
      if (days == null) continue;
      const b = bucket(days);
      if (b == null) continue;
      rows.push({
        owner_id: userId,
        driver_id: d.id,
        kind: "license_expiry",
        severity: severity(days),
        title: `Driving license in ${days} day(s)`,
        message: `${d.full_name} — license expires on ${d.license_expiry}.`,
        due_date: d.license_expiry!,
        days_remaining: days,
        dedup_key: `dri:${d.id}:license_expiry:${b}`,
      });
    }

    if (rows.length) {
      const { error } = await supabase.from("alerts").upsert(rows as never, { onConflict: "owner_id,dedup_key", ignoreDuplicates: false });
      if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    }

    return { generated: rows.length };
  });

export const dismissAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("alerts").update({ is_dismissed: true }).eq("id", data.id).eq("owner_id", context.userId);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return { ok: true };
  });
