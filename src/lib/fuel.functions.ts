import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FuelInput = z.object({
  id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid(),
  trip_id: z.string().uuid().nullish(),
  driver_id: z.string().uuid().nullish(),
  filled_on: z.string(),
  odometer_km: z.number().min(0).max(9_999_999),
  litres: z.number().min(0.1).max(2000),
  price_per_litre: z.number().min(1).max(500),
  total_amount: z.number().min(0).max(1_000_000),
  station: z.string().max(120).nullish(),
  is_full_tank: z.boolean().default(true),
  notes: z.string().max(500).nullish(),
});

export const listFuelLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("fuel_logs")
      .select("*, vehicle:vehicles(id, registration_number)")
      .eq("owner_id", context.userId)
      .order("filled_on", { ascending: false })
      .limit(500);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return data ?? [];
  });

export const upsertFuelLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => FuelInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("fuel_logs")
      .upsert({ ...data, owner_id: context.userId } as never, { onConflict: "id" })
      .select("*")
      .single();
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    await context.supabase.from("expenses").insert({
      owner_id: context.userId,
      vehicle_id: data.vehicle_id,
      trip_id: data.trip_id ?? null,
      category: "fuel",
      amount: data.total_amount,
      incurred_on: data.filled_on,
      description: `Fuel: ${data.litres}L @ ₹${data.price_per_litre}/L${data.station ? " · " + data.station : ""}`,
    } as never);
    return row;
  });

export const deleteFuelLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("fuel_logs")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return { ok: true };
  });

export const getFuelAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: logs, error } = await supabase
      .from("fuel_logs")
      .select("id, vehicle_id, filled_on, odometer_km, litres, total_amount, is_full_tank")
      .eq("owner_id", userId)
      .order("filled_on", { ascending: true })
      .limit(2000);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }

    const byVehicle = new Map<string, NonNullable<typeof logs>>();
    for (const l of logs ?? []) {
      const arr = byVehicle.get(l.vehicle_id) ?? [];
      arr.push(l);
      byVehicle.set(l.vehicle_id, arr);
    }

    type Anomaly = { id: string; filled_on: string; kmpl: number; deviation: number };
    type VStat = {
      vehicle_id: string;
      total_litres: number;
      total_cost: number;
      distance_km: number;
      avg_kmpl: number | null;
      fills: number;
      anomalies: Anomaly[];
    };
    const stats: VStat[] = [];
    for (const [vehicle_id, arr] of byVehicle) {
      let totalL = 0, totalC = 0, dist = 0;
      const kmpls: number[] = [];
      for (let i = 0; i < arr.length; i++) {
        totalL += Number(arr[i].litres);
        totalC += Number(arr[i].total_amount);
        if (i > 0 && arr[i].is_full_tank && arr[i - 1].is_full_tank) {
          const km = Number(arr[i].odometer_km) - Number(arr[i - 1].odometer_km);
          const l = Number(arr[i].litres);
          if (km > 0 && l > 0) { dist += km; kmpls.push(km / l); }
        }
      }
      const avg = kmpls.length > 0 ? kmpls.reduce((a, b) => a + b, 0) / kmpls.length : null;
      const anomalies: Anomaly[] = [];
      if (avg != null && kmpls.length >= 3) {
        for (let i = 1; i < arr.length; i++) {
          const km = Number(arr[i].odometer_km) - Number(arr[i - 1].odometer_km);
          const l = Number(arr[i].litres);
          if (arr[i].is_full_tank && arr[i - 1].is_full_tank && km > 0 && l > 0) {
            const kmpl = km / l;
            const dev = (kmpl - avg) / avg;
            if (Math.abs(dev) > 0.4) {
              anomalies.push({
                id: arr[i].id as string,
                filled_on: arr[i].filled_on as string,
                kmpl: Number(kmpl.toFixed(2)),
                deviation: Number((dev * 100).toFixed(1)),
              });
            }
          }
        }
      }
      stats.push({
        vehicle_id,
        total_litres: Number(totalL.toFixed(2)),
        total_cost: Number(totalC.toFixed(2)),
        distance_km: Number(dist.toFixed(1)),
        avg_kmpl: avg == null ? null : Number(avg.toFixed(2)),
        fills: arr.length,
        anomalies,
      });
    }

    const monthly = new Map<string, { litres: number; cost: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly.set(key, { litres: 0, cost: 0 });
    }
    for (const l of logs ?? []) {
      const d = new Date(l.filled_on as string);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = monthly.get(key);
      if (m) { m.litres += Number(l.litres); m.cost += Number(l.total_amount); }
    }
    const trend = Array.from(monthly.entries()).map(([key, v]) => ({
      key,
      label: new Date(key + "-01").toLocaleString("en-IN", { month: "short" }),
      litres: Number(v.litres.toFixed(1)),
      cost: Number(v.cost.toFixed(0)),
    }));

    return { stats, trend };
  });