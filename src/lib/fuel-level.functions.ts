import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VehicleFuelLevel = {
  vehicle_id: string;
  registration_number: string;
  fuel_type: string;
  tank_litres: number;
  litres_remaining: number;
  pct: number;
  range_km: number;
  kmpl: number;
  severity: "ok" | "low" | "critical";
  reason: "computed" | "insufficient_data";
};

// Sensible default tank sizes when the vehicle has no explicit tank_capacity_litres
// and we have no full-tank fill history to infer from.
const TANK_DEFAULTS: Record<string, number> = {
  truck: 300,
  trailer: 400,
  tanker: 400,
  container: 300,
  pickup: 60,
  other: 80,
};

export const getVehicleFuelLevels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [vehR, fuelR] = await Promise.all([
      supabase
        .from("vehicles")
        .select("id, registration_number, vehicle_type, fuel_type, odometer_km, tank_capacity_litres, status")
        .eq("owner_id", userId)
        .neq("status", "inactive")
        .order("registration_number", { ascending: true }),
      supabase
        .from("fuel_logs")
        .select("vehicle_id, filled_on, odometer_km, litres, is_full_tank")
        .eq("owner_id", userId)
        .order("filled_on", { ascending: true })
        .limit(3000),
    ]);
    const vehicles = vehR.data ?? [];
    const logs = fuelR.data ?? [];

    // Group fuel logs by vehicle
    const byVeh = new Map<string, typeof logs>();
    for (const l of logs) {
      const arr = byVeh.get(l.vehicle_id as string) ?? [];
      arr.push(l);
      byVeh.set(l.vehicle_id as string, arr);
    }

    const levels: VehicleFuelLevel[] = [];
    for (const v of vehicles) {
      const arr = byVeh.get(v.id as string) ?? [];
      const type = ((v.vehicle_type as string | null) ?? "other").toLowerCase();
      const tankFallback = TANK_DEFAULTS[type] ?? TANK_DEFAULTS.other;

      // Compute km/L from consecutive full-tank pairs
      const kmpls: number[] = [];
      let maxLitres = 0;
      for (let i = 0; i < arr.length; i++) {
        const li = Number(arr[i].litres ?? 0);
        if (arr[i].is_full_tank && li > maxLitres) maxLitres = li;
        if (i === 0) continue;
        const a = arr[i - 1];
        const b = arr[i];
        if (a.is_full_tank && b.is_full_tank) {
          const km = Number(b.odometer_km ?? 0) - Number(a.odometer_km ?? 0);
          const l = Number(b.litres ?? 0);
          if (km > 0 && l > 0) kmpls.push(km / l);
        }
      }
      const kmpl = kmpls.length > 0 ? kmpls.reduce((a, b) => a + b, 0) / kmpls.length : 0;

      // Tank size: explicit column > largest full-tank fill * 1.05 > preset default
      const tank_litres = Number(
        (v.tank_capacity_litres as number | null) ??
          (maxLitres > 0 ? Math.round(maxLitres * 1.05) : tankFallback),
      );

      // Find latest full-tank fill (the reference "100%" point)
      let lastFull: (typeof arr)[number] | undefined;
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].is_full_tank) { lastFull = arr[i]; break; }
      }
      // Partial fills logged after the last full-tank fill add litres back to the tank
      const partialsAfter = lastFull
        ? arr.filter((r) => !r.is_full_tank && new Date(r.filled_on as string) > new Date(lastFull!.filled_on as string))
        : [];
      const addedLitres = partialsAfter.reduce((s, r) => s + Number(r.litres ?? 0), 0);

      const currentOdo = Number(v.odometer_km ?? 0);
      const refOdo = lastFull ? Number(lastFull.odometer_km ?? 0) : currentOdo;
      const distanceSince = Math.max(0, currentOdo - refOdo);

      let litres_remaining = 0;
      let pct = 0;
      let reason: "computed" | "insufficient_data" = "computed";
      if (lastFull && kmpl > 0 && tank_litres > 0) {
        const startLitres = Math.min(tank_litres, Number(lastFull.litres ?? 0) + tank_litres * 0);
        // Assume last full-tank fill filled the tank to `tank_litres`.
        const startFull = tank_litres;
        const used = distanceSince / kmpl;
        litres_remaining = Math.max(0, Math.min(tank_litres, startFull - used + addedLitres));
        pct = Math.round((litres_remaining / tank_litres) * 100);
        // avoid unused-var warning
        void startLitres;
      } else {
        reason = "insufficient_data";
      }

      const range_km = Math.round(litres_remaining * kmpl);
      const severity: "ok" | "low" | "critical" =
        reason === "insufficient_data" ? "ok" : pct <= 10 ? "critical" : pct <= 20 ? "low" : "ok";

      levels.push({
        vehicle_id: v.id as string,
        registration_number: (v.registration_number as string) ?? "—",
        fuel_type: ((v.fuel_type as string | null) ?? "diesel").toLowerCase(),
        tank_litres: Math.round(tank_litres),
        litres_remaining: Number(litres_remaining.toFixed(1)),
        pct,
        range_km,
        kmpl: Number(kmpl.toFixed(2)),
        severity,
        reason,
      });
    }

    // Emit low/critical alerts (dedup per vehicle per day per severity)
    const today = new Date().toISOString().slice(0, 10);
    const alertRows = levels
      .filter((l) => l.reason === "computed" && (l.severity === "low" || l.severity === "critical"))
      .map((l) => ({
        owner_id: userId,
        vehicle_id: l.vehicle_id,
        kind: "fuel_low",
        severity: (l.severity === "critical" ? "critical" : "warning") as "critical" | "warning",
        title: l.severity === "critical" ? "Critical Fuel Level" : "Low Fuel",
        message:
          l.severity === "critical"
            ? `Vehicle ${l.registration_number} at ${l.pct}% fuel. Refuel immediately to avoid trip interruption.`
            : `Vehicle ${l.registration_number} has only ${l.pct}% fuel remaining. Estimated range: ${l.range_km} km.`,
        dedup_key: `fuel_${l.severity}_${l.vehicle_id}_${today}`,
      }));
    if (alertRows.length > 0) {
      await supabase
        .from("alerts")
        .upsert(alertRows as never, { onConflict: "owner_id,dedup_key", ignoreDuplicates: true });
    }

    return levels;
  });