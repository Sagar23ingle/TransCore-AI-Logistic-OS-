import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PlanInput = z.object({
  origin: z.string().trim().min(2).max(200),
  destination: z.string().trim().min(2).max(200),
  vehicle_id: z.string().uuid().nullish(),
  avoid_tolls: z.boolean().default(false),
});

export const planRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => PlanInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { geocode, computeRoutes } = await import("./routes.server");
    const { supabase, userId } = context;

    const [origin, destination] = await Promise.all([
      geocode(data.origin),
      geocode(data.destination),
    ]);

    const routes = await computeRoutes({ origin, destination, avoidTolls: data.avoid_tolls });

    // Fuel basis derived from the fleet's OWN fuel logs (no assumed constants).
    let query = supabase
      .from("fuel_logs")
      .select("vehicle_id, odometer_km, litres, price_per_litre, is_full_tank, filled_on")
      .eq("owner_id", userId)
      .order("filled_on", { ascending: false })
      .limit(40);
    if (data.vehicle_id) query = query.eq("vehicle_id", data.vehicle_id);
    const { data: logs, error } = await query;
    if (error) {
      console.error(error);
      throw new Error("Request failed. Please try again.");
    }

    const rows = (logs ?? []).map((l) => ({
      odo: Number(l.odometer_km),
      litres: Number(l.litres),
      price: Number(l.price_per_litre),
      full: Boolean(l.is_full_tank),
    }));
    const price_per_litre = rows.length > 0 ? rows[0]!.price : null;

    let kmpl: number | null = null;
    const fulls = rows.filter((r) => r.full && r.odo > 0).sort((a, b) => a.odo - b.odo);
    if (fulls.length >= 2) {
      const span = fulls[fulls.length - 1]!.odo - fulls[0]!.odo;
      const litres = fulls.slice(1).reduce((s, r) => s + r.litres, 0);
      if (span > 0 && litres > 0) kmpl = Math.round((span / litres) * 100) / 100;
    }

    const withCost = routes.map((r) => {
      const litres = kmpl ? Math.round((r.distance_km / kmpl) * 10) / 10 : null;
      const fuel_cost =
        litres != null && price_per_litre != null ? Math.round(litres * price_per_litre) : null;
      const total_cost =
        fuel_cost != null ? fuel_cost + Math.round(r.toll_amount ?? 0) : null;
      return { ...r, litres, fuel_cost, total_cost };
    });

    return {
      origin,
      destination,
      routes: withCost,
      basis: { kmpl, price_per_litre, samples: rows.length },
    };
  });