import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const recomputeDriverScores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const periodEnd = new Date();
    const periodStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const startISO = periodStart.toISOString();

    const [driversR, tripsR, pingsR] = await Promise.all([
      supabase.from("drivers").select("id, full_name").eq("owner_id", userId),
      supabase.from("trips").select("id, driver_id, status, scheduled_start, actual_end, distance_km").eq("owner_id", userId).gte("created_at", startISO),
      supabase.from("gps_pings").select("vehicle_id, trip_id, speed_kmh, recorded_at").eq("owner_id", userId).gte("recorded_at", startISO).limit(20000),
    ]);

    const drivers = driversR.data ?? [];
    const trips = tripsR.data ?? [];
    const pings = pingsR.data ?? [];

    const results: Array<{ driver_id: string; overall: number }> = [];
    for (const d of drivers) {
      const dt = trips.filter((t) => t.driver_id === d.id);
      const completed = dt.filter((t) => t.status === "completed").length;
      const delayed = dt.filter((t) =>
        t.status === "completed" && t.actual_end && t.scheduled_start &&
        new Date(t.actual_end).getTime() > new Date(t.scheduled_start).getTime() + 24 * 3600 * 1000,
      ).length;
      const totalKm = dt.reduce((s, t) => s + Number(t.distance_km || 0), 0);

      const tripIds = new Set(dt.map((t) => t.id));
      const dp = pings.filter((p) => p.trip_id && tripIds.has(p.trip_id));
      const speeds = dp.map((p) => Number(p.speed_kmh || 0));
      const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;
      const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : null;
      const violations = speeds.filter((s) => s > 80).length;

      const performance = dt.length === 0 ? 0 :
        Math.max(0, Math.min(100, (completed / dt.length) * 80 + (1 - delayed / Math.max(1, completed)) * 20));
      const safety = Math.max(0, Math.min(100, 100 - (totalKm > 0 ? (violations / totalKm) * 100 * 20 : violations * 2)));
      const overall = Number((0.6 * performance + 0.4 * safety).toFixed(2));

      await supabase.from("driver_scores").upsert({
        owner_id: userId,
        driver_id: d.id,
        period_start: periodStart.toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
        trips_completed: completed,
        trips_delayed: delayed,
        avg_speed_kmh: avgSpeed == null ? null : Number(avgSpeed.toFixed(2)),
        max_speed_kmh: maxSpeed == null ? null : Number(maxSpeed.toFixed(2)),
        speed_violations: violations,
        distance_km: Number(totalKm.toFixed(2)),
        safety_score: Number(safety.toFixed(2)),
        performance_score: Number(performance.toFixed(2)),
        overall_score: overall,
        computed_at: new Date().toISOString(),
      } as never, { onConflict: "driver_id,period_start,period_end" });

      results.push({ driver_id: d.id, overall });
    }
    return { computed: results.length };
  });

export const listDriverScores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("driver_scores")
      .select("*, driver:drivers(id, full_name, status)")
      .eq("owner_id", context.userId)
      .order("overall_score", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });