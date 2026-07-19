import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HomeExtras = Awaited<ReturnType<typeof getHomeExtras>>;

export const getHomeExtras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const startISO = monthStart.toISOString().slice(0, 10);

    const [recentR, vehR, fuelR, kmplR] = await Promise.all([
      supabase
        .from("trips")
        .select("id, origin, destination, status, freight_amount, actual_end, scheduled_start, created_at, vehicle:vehicles(registration_number), driver:drivers(full_name)")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("vehicles").select("id, fuel_type").eq("owner_id", userId),
      supabase
        .from("fuel_logs")
        .select("vehicle_id, total_amount, filled_on")
        .eq("owner_id", userId)
        .gte("filled_on", startISO),
      supabase
        .from("fuel_logs")
        .select("vehicle_id, litres, odometer_km, filled_on, is_full_tank")
        .eq("owner_id", userId)
        .order("filled_on", { ascending: true })
        .limit(2000),
    ]);

    const recentTrips = (recentR.data ?? []).map((t) => ({
      id: t.id as string,
      origin: t.origin as string,
      destination: t.destination as string,
      status: t.status as string,
      freight_amount: Number(t.freight_amount ?? 0),
      when: (t.actual_end ?? t.scheduled_start ?? t.created_at) as string | null,
      vehicle: (t.vehicle as { registration_number?: string } | null)?.registration_number ?? null,
      driver: (t.driver as { full_name?: string } | null)?.full_name ?? null,
    }));

    // Fuel cost split by vehicle fuel_type (MTD)
    const fuelTypeByVehicle = new Map<string, string>();
    for (const v of vehR.data ?? []) {
      fuelTypeByVehicle.set(v.id as string, ((v.fuel_type as string | null) ?? "diesel").toLowerCase());
    }
    const fuelByType: Record<string, number> = { diesel: 0, petrol: 0, cng: 0, electric: 0, other: 0 };
    let totalFuelCost = 0;
    for (const f of fuelR.data ?? []) {
      const t = fuelTypeByVehicle.get(f.vehicle_id as string) ?? "other";
      const key = ["diesel", "petrol", "cng", "electric"].includes(t) ? t : "other";
      const amt = Number(f.total_amount ?? 0);
      fuelByType[key] += amt;
      totalFuelCost += amt;
    }

    // Fleet-wide fuel efficiency (km/L) from full-tank pairs
    const byVeh = new Map<string, { odometer_km: number; litres: number; filled_on: string; is_full_tank: boolean }[]>();
    for (const l of kmplR.data ?? []) {
      const arr = byVeh.get(l.vehicle_id as string) ?? [];
      arr.push({
        odometer_km: Number(l.odometer_km ?? 0),
        litres: Number(l.litres ?? 0),
        filled_on: l.filled_on as string,
        is_full_tank: Boolean(l.is_full_tank),
      });
      byVeh.set(l.vehicle_id as string, arr);
    }
    let totalKm = 0, totalL = 0;
    for (const arr of byVeh.values()) {
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].is_full_tank && arr[i - 1].is_full_tank) {
          const km = arr[i].odometer_km - arr[i - 1].odometer_km;
          if (km > 0 && arr[i].litres > 0) { totalKm += km; totalL += arr[i].litres; }
        }
      }
    }
    const kmpl = totalL > 0 ? Number((totalKm / totalL).toFixed(2)) : 0;

    return {
      recentTrips,
      fuel: {
        totalCost: Math.round(totalFuelCost),
        byType: Object.entries(fuelByType)
          .filter(([, v]) => v > 0)
          .map(([type, amount]) => ({ type, amount: Math.round(amount) })),
        kmpl,
      },
    };
  });