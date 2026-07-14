import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProfitPerVehicle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since = new Date();
    since.setMonth(since.getMonth() - 6);
    const [vR, tR, eR] = await Promise.all([
      supabase.from("vehicles").select("id, registration_number").eq("owner_id", userId),
      supabase.from("trips").select("vehicle_id, freight_amount, distance_km, status, actual_end").eq("owner_id", userId).eq("status", "completed").gte("actual_end", since.toISOString()),
      supabase.from("expenses").select("vehicle_id, amount, incurred_on").eq("owner_id", userId).gte("incurred_on", since.toISOString().slice(0, 10)),
    ]);
    const rows = (vR.data ?? []).map((v) => {
      const trips = (tR.data ?? []).filter((t) => t.vehicle_id === v.id);
      const revenue = trips.reduce((s, t) => s + Number(t.freight_amount || 0), 0);
      const distance = trips.reduce((s, t) => s + Number(t.distance_km || 0), 0);
      const expenses = (eR.data ?? []).filter((e) => e.vehicle_id === v.id).reduce((s, e) => s + Number(e.amount || 0), 0);
      const profit = revenue - expenses;
      const cost_per_km = distance > 0 ? Number((expenses / distance).toFixed(2)) : null;
      const revenue_per_km = distance > 0 ? Number((revenue / distance).toFixed(2)) : null;
      return {
        vehicle_id: v.id,
        registration_number: v.registration_number as string,
        trips: trips.length,
        revenue: Math.round(revenue),
        expenses: Math.round(expenses),
        profit: Math.round(profit),
        distance_km: Math.round(distance),
        cost_per_km,
        revenue_per_km,
      };
    });
    return rows.sort((a, b) => b.profit - a.profit);
  });

export const getForecast = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since = new Date();
    since.setMonth(since.getMonth() - 6);
    since.setDate(1);
    const [tR, eR] = await Promise.all([
      supabase.from("trips").select("freight_amount, actual_end").eq("owner_id", userId).eq("status", "completed").gte("actual_end", since.toISOString()),
      supabase.from("expenses").select("amount, incurred_on").eq("owner_id", userId).gte("incurred_on", since.toISOString().slice(0, 10)),
    ]);
    const months: { key: string; label: string; revenue: number; expenses: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(since); d.setMonth(since.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: d.toLocaleString("en-IN", { month: "short" }), revenue: 0, expenses: 0 });
    }
    for (const t of tR.data ?? []) {
      if (!t.actual_end) continue;
      const d = new Date(t.actual_end); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find((x) => x.key === key); if (m) m.revenue += Number(t.freight_amount || 0);
    }
    for (const e of eR.data ?? []) {
      const d = new Date(e.incurred_on as string); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find((x) => x.key === key); if (m) m.expenses += Number(e.amount || 0);
    }

    function linfit(y: number[]) {
      const n = y.length;
      const xs = Array.from({ length: n }, (_, i) => i);
      const meanX = xs.reduce((a, b) => a + b, 0) / n;
      const meanY = y.reduce((a, b) => a + b, 0) / n;
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) { num += (xs[i] - meanX) * (y[i] - meanY); den += (xs[i] - meanX) ** 2; }
      const slope = den === 0 ? 0 : num / den;
      const intercept = meanY - slope * meanX;
      return (x: number) => Math.max(0, intercept + slope * x);
    }

    const rFit = linfit(months.map((m) => m.revenue));
    const eFit = linfit(months.map((m) => m.expenses));
    const forecast: typeof months = [];
    for (let i = 6; i < 9; i++) {
      const d = new Date(since); d.setMonth(since.getMonth() + i);
      forecast.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleString("en-IN", { month: "short" }) + " (fcst)",
        revenue: Math.round(rFit(i)),
        expenses: Math.round(eFit(i)),
      });
    }
    return { history: months, forecast };
  });