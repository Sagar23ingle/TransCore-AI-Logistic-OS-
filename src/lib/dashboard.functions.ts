import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [vehiclesR, driversR, tripsR, activeTripsR, expensesR, tripsMonthR] = await Promise.all([
      supabase.from("vehicles").select("id, status", { count: "exact", head: false }).eq("owner_id", userId),
      supabase.from("drivers").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("trips").select("id, status, freight_amount, distance_km, actual_end", { count: "exact", head: false }).eq("owner_id", userId),
      supabase.from("trips").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("status", "in_progress"),
      supabase.from("expenses").select("amount, category, incurred_on").eq("owner_id", userId).gte("incurred_on", start.slice(0, 10)),
      supabase.from("trips").select("freight_amount, actual_end, distance_km").eq("owner_id", userId).eq("status", "completed").gte("actual_end", start),
    ]);

    const totalVehicles = vehiclesR.count ?? vehiclesR.data?.length ?? 0;
    const activeVehicles = (vehiclesR.data ?? []).filter((v) => v.status === "active").length;
    const totalDrivers = driversR.count ?? 0;
    const totalTrips = tripsR.count ?? 0;
    const activeTrips = activeTripsR.count ?? 0;
    const completedTrips = (tripsR.data ?? []).filter((t) => t.status === "completed").length;

    const revenueMTD = (tripsMonthR.data ?? []).reduce((s, t) => s + (Number(t.freight_amount) || 0), 0);
    const distanceMTD = (tripsMonthR.data ?? []).reduce((s, t) => s + (Number(t.distance_km) || 0), 0);

    const expensesMTD = (expensesR.data ?? []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const fuelMTD = (expensesR.data ?? []).filter((e) => e.category === "fuel").reduce((s, e) => s + Number(e.amount || 0), 0);
    const profitMTD = revenueMTD - expensesMTD;

    const fleetUtilization =
      totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0;

    return {
      totalVehicles,
      activeVehicles,
      totalDrivers,
      totalTrips,
      activeTrips,
      completedTrips,
      revenueMTD,
      expensesMTD,
      fuelMTD,
      profitMTD,
      distanceMTD,
      fleetUtilization,
    };
  });

export const getRevenueByMonth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const start = new Date();
    start.setMonth(start.getMonth() - 5);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const [tripsR, expR] = await Promise.all([
      supabase.from("trips").select("freight_amount, actual_end").eq("owner_id", userId).eq("status", "completed").gte("actual_end", start.toISOString()),
      supabase.from("expenses").select("amount, incurred_on").eq("owner_id", userId).gte("incurred_on", start.toISOString().slice(0, 10)),
    ]);

    const months: { key: string; label: string; revenue: number; expenses: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(start);
      d.setMonth(start.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: d.toLocaleString("en-IN", { month: "short" }), revenue: 0, expenses: 0 });
    }
    for (const t of tripsR.data ?? []) {
      if (!t.actual_end) continue;
      const d = new Date(t.actual_end);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find((x) => x.key === key);
      if (m) m.revenue += Number(t.freight_amount) || 0;
    }
    for (const e of expR.data ?? []) {
      const d = new Date(e.incurred_on);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find((x) => x.key === key);
      if (m) m.expenses += Number(e.amount) || 0;
    }
    return months;
  });

export const getExpenseBreakdown = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const start = new Date();
    start.setDate(1);
    const { data } = await supabase
      .from("expenses")
      .select("category, amount")
      .eq("owner_id", userId)
      .gte("incurred_on", start.toISOString().slice(0, 10));
    const map = new Map<string, number>();
    for (const e of data ?? []) {
      map.set(e.category as string, (map.get(e.category as string) ?? 0) + Number(e.amount || 0));
    }
    return Array.from(map.entries()).map(([category, amount]) => ({ category, amount }));
  });
