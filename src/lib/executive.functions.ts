import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getExecutiveOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ company_id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startYear = new Date(now.getFullYear(), 0, 1).toISOString();
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    // Batch every read in one round-trip. Vehicles/drivers rows contain all
    // the columns we need for both KPI and expiry logic, so we no longer
    // fetch those tables twice.
    const [vehR, driR, tripsYearR, expYearR, tripsTodayR, scoresR, criticalAlertsR] = await Promise.all([
      supabase.from("vehicles").select("id, registration_number, status, insurance_expiry, permit_expiry, fitness_expiry, puc_expiry, maintenance_next_due").eq("company_id", data.company_id),
      supabase.from("drivers").select("id, full_name, status, license_expiry").eq("company_id", data.company_id),
      supabase.from("trips").select("id, vehicle_id, freight_amount, actual_end").eq("company_id", data.company_id).eq("status", "completed").gte("actual_end", startYear),
      supabase.from("expenses").select("amount, vehicle_id, incurred_on").eq("company_id", data.company_id).gte("incurred_on", startYear.slice(0, 10)),
      supabase.from("trips").select("id", { count: "exact", head: true }).eq("company_id", data.company_id).gte("created_at", startDay),
      supabase.from("driver_scores").select("driver_id, overall_score, period_end, driver:drivers(id, full_name)").eq("company_id", data.company_id).order("period_end", { ascending: false }).limit(200),
      supabase.from("alerts").select("id", { count: "exact", head: true }).eq("company_id", data.company_id).eq("severity", "critical").eq("is_dismissed", false),
    ]);
    const monthStartDate = startMonth.slice(0, 10);
    const tripsMonth = (tripsYearR.data ?? []).filter((t) => (t.actual_end ?? "") >= startMonth);
    const expMonth = (expYearR.data ?? []).filter((e) => (e.incurred_on ?? "") >= monthStartDate);

    const activeVehicles = (vehR.data ?? []).filter((v) => v.status === "active").length;
    const activeDrivers = (driR.data ?? []).filter((d) => d.status === "active").length;

    const revenueMTD = tripsMonth.reduce((s, t) => s + Number(t.freight_amount || 0), 0);
    const revenueYTD = (tripsYearR.data ?? []).reduce((s, t) => s + Number(t.freight_amount || 0), 0);
    const expensesMTD = expMonth.reduce((s, e) => s + Number(e.amount || 0), 0);
    const expensesYTD = (expYearR.data ?? []).reduce((s, e) => s + Number(e.amount || 0), 0);
    const profitMTD = revenueMTD - expensesMTD;
    const profitYTD = revenueYTD - expensesYTD;

    // Per-vehicle profit MTD → top 5
    const revByVeh = new Map<string, number>();
    for (const t of tripsMonth) {
      if (!t.vehicle_id) continue;
      revByVeh.set(t.vehicle_id, (revByVeh.get(t.vehicle_id) ?? 0) + Number(t.freight_amount || 0));
    }
    const expByVeh = new Map<string, number>();
    for (const e of expMonth) {
      if (!e.vehicle_id) continue;
      expByVeh.set(e.vehicle_id, (expByVeh.get(e.vehicle_id) ?? 0) + Number(e.amount || 0));
    }
    const topVehicles = (vehR.data ?? []).map((v) => ({
      id: v.id as string,
      registration_number: v.registration_number as string,
      revenue: Math.round(revByVeh.get(v.id as string) ?? 0),
      expenses: Math.round(expByVeh.get(v.id as string) ?? 0),
      profit: Math.round((revByVeh.get(v.id as string) ?? 0) - (expByVeh.get(v.id as string) ?? 0)),
    })).sort((a, b) => b.profit - a.profit).slice(0, 5);

    // Expiring docs and maintenance due in 30 days
    const isBetween = (d: string | null) => !!d && d >= today && d <= in30;
    const isOverdue = (d: string | null) => !!d && d < today;
    let expiringDocs = 0, expiredDocs = 0, maintenanceDue = 0, maintenanceOverdue = 0;
    for (const v of vehR.data ?? []) {
      for (const d of [v.insurance_expiry, v.permit_expiry, v.fitness_expiry, v.puc_expiry] as (string | null)[]) {
        if (isBetween(d)) expiringDocs += 1;
        if (isOverdue(d)) expiredDocs += 1;
      }
      if (isBetween(v.maintenance_next_due as string | null)) maintenanceDue += 1;
      if (isOverdue(v.maintenance_next_due as string | null)) maintenanceOverdue += 1;
    }
    for (const d of driR.data ?? []) {
      if (isBetween(d.license_expiry as string | null)) expiringDocs += 1;
      if (isOverdue(d.license_expiry as string | null)) expiredDocs += 1;
    }

    // Top drivers by score (last snapshot per driver)
    const latest = new Map<string, { name: string; score: number }>();
    for (const s of scoresR.data ?? []) {
      const did = s.driver_id as string;
      if (!latest.has(did)) {
        latest.set(did, {
          name: (s.driver as { full_name: string } | null)?.full_name ?? "Driver",
          score: Number(s.overall_score) || 0,
        });
      }
    }
    const topDrivers = Array.from(latest.entries())
      .map(([id, v]) => ({ id, name: v.name, score: v.score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const criticalAlerts = criticalAlertsR.count ?? 0;

    return {
      revenueMTD, revenueYTD, expensesMTD, expensesYTD, profitMTD, profitYTD,
      activeVehicles, totalVehicles: vehR.data?.length ?? 0,
      activeDrivers, totalDrivers: driR.data?.length ?? 0,
      tripsToday: tripsTodayR.count ?? 0,
      expiringDocs, expiredDocs, maintenanceDue, maintenanceOverdue,
      criticalAlerts,
      topVehicles,
      topDrivers,
    };
  });