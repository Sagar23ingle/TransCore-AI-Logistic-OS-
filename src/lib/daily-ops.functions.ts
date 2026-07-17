import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const today = startOfDay(new Date());
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export type DailyOps = Awaited<ReturnType<typeof getDailyOps>>;

export const getDailyOps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last7 = new Date(todayStart.getTime() - 7 * 86400000);
    const prev7 = new Date(todayStart.getTime() - 14 * 86400000);
    const last30 = new Date(todayStart.getTime() - 30 * 86400000);
    const last90 = new Date(todayStart.getTime() - 90 * 86400000);
    const monthStartDate = monthStart.toISOString().slice(0, 10);
    const prevMonthStartDate = prevMonthStart.toISOString().slice(0, 10);
    const todayISODate = todayStart.toISOString().slice(0, 10);
    const yesterdayISODate = yesterdayStart.toISOString().slice(0, 10);
    const in30 = new Date(todayStart.getTime() + 30 * 86400000).toISOString().slice(0, 10);

    const [
      profileR, vehR, driR, tripsR, expR, fuelR, alertsR, scoresR, maintR,
    ] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      supabase.from("vehicles").select("id, registration_number, status, insurance_expiry, permit_expiry, fitness_expiry, puc_expiry, maintenance_next_due, updated_at").eq("owner_id", userId),
      supabase.from("drivers").select("id, full_name, status, license_expiry").eq("owner_id", userId),
      supabase.from("trips").select("id, vehicle_id, driver_id, status, freight_amount, distance_km, actual_start, actual_end, created_at").eq("owner_id", userId).gte("created_at", last90.toISOString()),
      supabase.from("expenses").select("amount, category, vehicle_id, incurred_on").eq("owner_id", userId).gte("incurred_on", last90.toISOString().slice(0, 10)),
      supabase.from("fuel_logs").select("vehicle_id, litres, total_amount, odometer_km, filled_on").eq("owner_id", userId).gte("filled_on", last90.toISOString().slice(0, 10)).order("filled_on", { ascending: true }),
      supabase.from("alerts").select("id, severity, kind, title, message, days_remaining, due_date, vehicle_id, driver_id").eq("owner_id", userId).eq("is_dismissed", false).order("days_remaining", { ascending: true }),
      supabase.from("driver_scores").select("driver_id, overall_score, period_end").eq("owner_id", userId).order("period_end", { ascending: false }).limit(200),
      supabase.from("maintenance_logs").select("vehicle_id, serviced_on, cost").eq("owner_id", userId).gte("serviced_on", last90.toISOString().slice(0, 10)),
    ]);

    const vehicles = vehR.data ?? [];
    const drivers = driR.data ?? [];
    const trips = tripsR.data ?? [];
    const expenses = expR.data ?? [];
    const fuel = fuelR.data ?? [];
    const alerts = alertsR.data ?? [];
    const scores = scoresR.data ?? [];

    // ------- Today snapshot -------
    const inTripsToday = trips.filter((t) => (t.actual_start ?? t.created_at ?? "") >= todayStart.toISOString());
    const tripsCompletedToday = trips.filter((t) => t.status === "completed" && (t.actual_end ?? "") >= todayStart.toISOString());
    const tripsCompletedYesterday = trips.filter((t) => t.status === "completed" && (t.actual_end ?? "") >= yesterdayStart.toISOString() && (t.actual_end ?? "") < todayStart.toISOString());
    const revenueToday = tripsCompletedToday.reduce((s, t) => s + Number(t.freight_amount || 0), 0);
    const revenueYesterday = tripsCompletedYesterday.reduce((s, t) => s + Number(t.freight_amount || 0), 0);
    const fuelToday = expenses.filter((e) => e.category === "fuel" && e.incurred_on === todayISODate).reduce((s, e) => s + Number(e.amount || 0), 0);
    const fuelYesterday = expenses.filter((e) => e.category === "fuel" && e.incurred_on === yesterdayISODate).reduce((s, e) => s + Number(e.amount || 0), 0);

    const driversActiveToday = new Set(
      trips.filter((t) => (t.actual_start ?? t.created_at ?? "") >= todayStart.toISOString() && t.driver_id).map((t) => t.driver_id as string),
    ).size;
    const trucksOnRoute = new Set(trips.filter((t) => t.status === "in_progress" && t.vehicle_id).map((t) => t.vehicle_id as string)).size;
    const activeVehicles = vehicles.filter((v) => v.status === "active").length;

    // ------- Document / maintenance counts -------
    const isSoon = (d: string | null | undefined) => !!d && d >= todayISODate && d <= in30;
    const isOverdue = (d: string | null | undefined) => !!d && d < todayISODate;
    let expiringDocs = 0, expiredDocs = 0, maintenanceDue = 0, maintenanceOverdue = 0;
    for (const v of vehicles) {
      for (const d of [v.insurance_expiry, v.permit_expiry, v.fitness_expiry, v.puc_expiry]) {
        if (isSoon(d)) expiringDocs++;
        if (isOverdue(d)) expiredDocs++;
      }
      if (isSoon(v.maintenance_next_due)) maintenanceDue++;
      if (isOverdue(v.maintenance_next_due)) maintenanceOverdue++;
    }
    for (const d of drivers) {
      if (isSoon(d.license_expiry)) expiringDocs++;
      if (isOverdue(d.license_expiry)) expiredDocs++;
    }

    // ------- Period totals (MTD vs prev-month-to-date) -------
    const dayOfMonth = now.getDate();
    const prevMonthCutoff = new Date(prevMonthStart);
    prevMonthCutoff.setDate(dayOfMonth);
    const revMTD = trips.filter((t) => t.status === "completed" && (t.actual_end ?? "") >= monthStart.toISOString()).reduce((s, t) => s + Number(t.freight_amount || 0), 0);
    const revPrevMTD = trips.filter((t) => t.status === "completed" && (t.actual_end ?? "") >= prevMonthStart.toISOString() && (t.actual_end ?? "") < prevMonthCutoff.toISOString()).reduce((s, t) => s + Number(t.freight_amount || 0), 0);
    const expMTD = expenses.filter((e) => (e.incurred_on ?? "") >= monthStartDate).reduce((s, e) => s + Number(e.amount || 0), 0);
    const expPrevMTD = expenses.filter((e) => (e.incurred_on ?? "") >= prevMonthStartDate && (e.incurred_on ?? "") < prevMonthCutoff.toISOString().slice(0, 10)).reduce((s, e) => s + Number(e.amount || 0), 0);
    const fuelMTD = expenses.filter((e) => e.category === "fuel" && (e.incurred_on ?? "") >= monthStartDate).reduce((s, e) => s + Number(e.amount || 0), 0);
    const fuelPrevMTD = expenses.filter((e) => e.category === "fuel" && (e.incurred_on ?? "") >= prevMonthStartDate && (e.incurred_on ?? "") < prevMonthCutoff.toISOString().slice(0, 10)).reduce((s, e) => s + Number(e.amount || 0), 0);

    // ------- Weekly (last 7d vs prev 7d) -------
    const fuel7 = expenses.filter((e) => e.category === "fuel" && (e.incurred_on ?? "") >= last7.toISOString().slice(0, 10)).reduce((s, e) => s + Number(e.amount || 0), 0);
    const fuelPrev7 = expenses.filter((e) => e.category === "fuel" && (e.incurred_on ?? "") >= prev7.toISOString().slice(0, 10) && (e.incurred_on ?? "") < last7.toISOString().slice(0, 10)).reduce((s, e) => s + Number(e.amount || 0), 0);
    const rev7 = trips.filter((t) => t.status === "completed" && (t.actual_end ?? "") >= last7.toISOString()).reduce((s, t) => s + Number(t.freight_amount || 0), 0);
    const revPrev7 = trips.filter((t) => t.status === "completed" && (t.actual_end ?? "") >= prev7.toISOString() && (t.actual_end ?? "") < last7.toISOString()).reduce((s, t) => s + Number(t.freight_amount || 0), 0);

    // ------- Trend series (last 30d daily) -------
    const trend: { date: string; revenue: number; fuel: number; trips: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      trend.push({ date: key, revenue: 0, fuel: 0, trips: 0 });
    }
    const byDate = new Map(trend.map((r) => [r.date, r]));
    for (const t of trips) {
      if (t.status !== "completed" || !t.actual_end) continue;
      const key = new Date(t.actual_end).toISOString().slice(0, 10);
      const row = byDate.get(key);
      if (row) { row.revenue += Number(t.freight_amount || 0); row.trips += 1; }
    }
    for (const e of expenses) {
      if (e.category !== "fuel") continue;
      const row = byDate.get(e.incurred_on as string);
      if (row) row.fuel += Number(e.amount || 0);
    }

    // ------- Fleet Health Score -------
    // Components 0..100 each, then weighted average.
    const docsTotalChecks = vehicles.length * 4 + drivers.length;
    const docsBad = expiredDocs * 2 + expiringDocs;
    const docsScore = docsTotalChecks === 0 ? 100 : Math.max(0, 100 - Math.round((docsBad / (docsTotalChecks * 2)) * 100));

    const utilScore = vehicles.length === 0 ? 100 : Math.round((activeVehicles / vehicles.length) * 100);

    const trips30 = trips.filter((t) => (t.actual_end ?? t.created_at ?? "") >= last30.toISOString());
    const completed30 = trips30.filter((t) => t.status === "completed").length;
    const cancelled30 = trips30.filter((t) => t.status === "cancelled").length;
    const denom30 = completed30 + cancelled30;
    const completionScore = denom30 === 0 ? 100 : Math.round((completed30 / denom30) * 100);

    // Fuel efficiency: km/L from fuel logs across fleet (last 90d)
    type FuelRow = { vehicle_id: string; litres: number; odometer_km: number | null; filled_on: string };
    const byVeh = new Map<string, FuelRow[]>();
    for (const f of fuel) {
      if (!f.vehicle_id) continue;
      const arr = byVeh.get(f.vehicle_id) ?? [];
      arr.push({ vehicle_id: f.vehicle_id, litres: Number(f.litres || 0), odometer_km: f.odometer_km ?? null, filled_on: f.filled_on });
      byVeh.set(f.vehicle_id, arr);
    }
    let totalKm = 0, totalL = 0;
    for (const arr of byVeh.values()) {
      const sorted = arr.filter((x) => x.odometer_km != null).sort((a, b) => (a.filled_on < b.filled_on ? -1 : 1));
      if (sorted.length >= 2) {
        const km = Number(sorted[sorted.length - 1].odometer_km) - Number(sorted[0].odometer_km);
        const l = sorted.slice(1).reduce((s, x) => s + Number(x.litres || 0), 0);
        if (km > 0 && l > 0) { totalKm += km; totalL += l; }
      }
    }
    const kmpl = totalL > 0 ? totalKm / totalL : null;
    // Target ~4 km/L for HCV; score linear 2→0, 5+→100
    const fuelScore = kmpl == null ? 75 : Math.max(0, Math.min(100, Math.round(((kmpl - 2) / 3) * 100)));

    // Driver performance (avg latest score / driver)
    const latestByDriver = new Map<string, number>();
    for (const s of scores) {
      if (!latestByDriver.has(s.driver_id as string)) latestByDriver.set(s.driver_id as string, Number(s.overall_score || 0));
    }
    const driverAvg = latestByDriver.size === 0 ? null : Array.from(latestByDriver.values()).reduce((a, b) => a + b, 0) / latestByDriver.size;
    const driverScore = driverAvg == null ? 75 : Math.round(Math.max(0, Math.min(100, driverAvg)));

    const health = Math.round(
      docsScore * 0.25 + utilScore * 0.2 + completionScore * 0.2 + fuelScore * 0.2 + driverScore * 0.15,
    );
    const healthBand: "excellent" | "good" | "attention" | "critical" =
      health >= 85 ? "excellent" : health >= 70 ? "good" : health >= 50 ? "attention" : "critical";

    const healthReasons: { label: string; score: number; weight: number }[] = [
      { label: "Document compliance", score: docsScore, weight: 25 },
      { label: "Fleet utilization", score: utilScore, weight: 20 },
      { label: "Trip completion rate", score: completionScore, weight: 20 },
      { label: "Fuel efficiency", score: fuelScore, weight: 20 },
      { label: "Driver performance", score: driverScore, weight: 15 },
    ];

    // ------- Smart insights (only when data supports them) -------
    type Insight = { id: string; tone: "positive" | "warning" | "critical" | "info"; issue: string; impact: string; action: string; href?: string };
    const insights: Insight[] = [];

    function pctChange(cur: number, prev: number): number | null {
      if (prev === 0) return cur === 0 ? 0 : null;
      return Math.round(((cur - prev) / prev) * 100);
    }

    const fuelWow = pctChange(fuel7, fuelPrev7);
    if (fuelWow != null && Math.abs(fuelWow) >= 5) {
      insights.push({
        id: "fuel-wow",
        tone: fuelWow > 0 ? "warning" : "positive",
        issue: `Fuel cost ${fuelWow > 0 ? "increased" : "reduced"} ${Math.abs(fuelWow)}% this week`,
        impact: `₹${Math.abs(fuel7 - fuelPrev7).toLocaleString("en-IN", { maximumFractionDigits: 0 })} ${fuelWow > 0 ? "more" : "saved"} vs previous 7 days`,
        action: fuelWow > 0 ? "Review fuel logs for anomalies" : "Keep monitoring — trend is positive",
        href: "/fuel",
      });
    }
    const revWow = pctChange(rev7, revPrev7);
    if (revWow != null && Math.abs(revWow) >= 8) {
      insights.push({
        id: "rev-wow",
        tone: revWow > 0 ? "positive" : "warning",
        issue: `Revenue ${revWow > 0 ? "up" : "down"} ${Math.abs(revWow)}% this week`,
        impact: `₹${Math.abs(rev7 - revPrev7).toLocaleString("en-IN", { maximumFractionDigits: 0 })} vs previous 7 days`,
        action: revWow > 0 ? "Consider raising utilization further" : "Check trip pipeline and marketplace",
        href: "/trips",
      });
    }

    // Idle vehicles (no trip start in 5+ days but status active)
    const lastTripByVehicle = new Map<string, string>();
    for (const t of trips) {
      const when = t.actual_start ?? t.created_at ?? "";
      if (!t.vehicle_id || !when) continue;
      const prev = lastTripByVehicle.get(t.vehicle_id) ?? "";
      if (when > prev) lastTripByVehicle.set(t.vehicle_id, when);
    }
    for (const v of vehicles) {
      if (v.status !== "active") continue;
      const last = lastTripByVehicle.get(v.id);
      const daysIdle = last ? Math.round((todayStart.getTime() - new Date(last).getTime()) / 86400000) : null;
      if (daysIdle != null && daysIdle >= 5) {
        insights.push({
          id: `idle-${v.id}`,
          tone: "warning",
          issue: `Truck ${v.registration_number} inactive for ${daysIdle} days`,
          impact: "Lost revenue opportunity while EMI and insurance continue",
          action: "Assign a load from marketplace",
          href: "/marketplace",
        });
        if (insights.filter((i) => i.id.startsWith("idle-")).length >= 3) break;
      }
    }

    // Nearest doc expiry insight
    const critAlert = alerts.find((a) => a.severity === "critical");
    if (critAlert) {
      insights.push({
        id: `alert-${critAlert.id}`,
        tone: "critical",
        issue: critAlert.title,
        impact: critAlert.message,
        action: "Renew now to avoid penalties",
        href: "/alerts",
      });
    }

    // Opportunity insight: MoM fuel saving
    const fuelMoM = pctChange(fuelMTD, fuelPrevMTD);
    if (fuelMoM != null && fuelMoM < -3 && fuelPrevMTD > 0) {
      insights.push({
        id: "fuel-mom",
        tone: "positive",
        issue: `Fuel spending reduced ${Math.abs(fuelMoM)}% vs last month`,
        impact: `₹${Math.abs(fuelMTD - fuelPrevMTD).toLocaleString("en-IN", { maximumFractionDigits: 0 })} saved so far`,
        action: "Great work — reinforce driver training",
        href: "/drivers-scoreboard",
      });
    }

    // ------- Priorities (Today's Priorities) -------
    type Priority = { id: string; severity: "critical" | "warning" | "info"; title: string; message: string; href: string };
    const priorities: Priority[] = alerts.slice(0, 8).map((a) => ({
      id: `alert-${a.id}`,
      severity: (a.severity as Priority["severity"]) ?? "info",
      title: a.title ?? "",
      message: a.message ?? "",
      href: a.kind?.startsWith("license") ? "/drivers" : a.kind?.startsWith("maintenance") ? "/maintenance" : "/alerts",
    }));

    // ------- Monthly goals (baseline: previous month totals) -------
    // Real data: prev-month full totals become this month's target.
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const revPrevMonthFull = trips.filter((t) => t.status === "completed" && (t.actual_end ?? "") >= prevMonthStart.toISOString() && (t.actual_end ?? "") <= prevMonthEnd.toISOString()).reduce((s, t) => s + Number(t.freight_amount || 0), 0);
    const tripsPrevMonthFull = trips.filter((t) => t.status === "completed" && (t.actual_end ?? "") >= prevMonthStart.toISOString() && (t.actual_end ?? "") <= prevMonthEnd.toISOString()).length;
    const fuelPrevMonthFull = expenses.filter((e) => e.category === "fuel" && (e.incurred_on ?? "") >= prevMonthStartDate && (e.incurred_on ?? "") <= prevMonthEnd.toISOString().slice(0, 10)).reduce((s, e) => s + Number(e.amount || 0), 0);
    const tripsMTDCount = trips.filter((t) => t.status === "completed" && (t.actual_end ?? "") >= monthStart.toISOString()).length;

    const goals = [
      { key: "revenue", label: "Revenue", current: Math.round(revMTD), target: Math.round(revPrevMonthFull), unit: "inr", higherIsBetter: true },
      { key: "trips", label: "Completed trips", current: tripsMTDCount, target: tripsPrevMonthFull, unit: "count", higherIsBetter: true },
      { key: "utilization", label: "Fleet utilization", current: utilScore, target: 90, unit: "pct", higherIsBetter: true },
      { key: "fuel_saving", label: "Fuel efficiency", current: kmpl ? Math.round(kmpl * 10) / 10 : 0, target: 4, unit: "kmpl", higherIsBetter: true },
    ];

    return {
      user: { fullName: (profileR.data?.full_name as string | undefined) ?? null, hour: now.getHours() },
      today: {
        trucksActive: activeVehicles,
        trucksOnRoute,
        driversActive: driversActiveToday,
        revenue: Math.round(revenueToday),
        revenueYesterday: Math.round(revenueYesterday),
        fuelCost: Math.round(fuelToday),
        fuelYesterday: Math.round(fuelYesterday),
        pendingDocs: expiringDocs + expiredDocs,
        upcomingRenewals: expiringDocs,
        overdueDocs: expiredDocs,
        tripsCompleted: tripsCompletedToday.length,
        newAlerts: alerts.length,
      },
      totals: {
        vehicles: vehicles.length,
        drivers: drivers.length,
        expiringDocs, expiredDocs, maintenanceDue, maintenanceOverdue,
      },
      health: { score: health, band: healthBand, reasons: healthReasons },
      periods: {
        revenueMTD: Math.round(revMTD), revenuePrevMTD: Math.round(revPrevMTD),
        expensesMTD: Math.round(expMTD), expensesPrevMTD: Math.round(expPrevMTD),
        fuelMTD: Math.round(fuelMTD), fuelPrevMTD: Math.round(fuelPrevMTD),
        rev7: Math.round(rev7), revPrev7: Math.round(revPrev7),
        fuel7: Math.round(fuel7), fuelPrev7: Math.round(fuelPrev7),
      },
      trend,
      insights,
      priorities,
      goals,
      onboarding: {
        hasVehicles: vehicles.length > 0,
        hasDrivers: drivers.length > 0,
        hasTrips: trips.length > 0,
        hasFuel: fuel.length > 0,
        hasDocuments: false, // computed client-side or extend later; keep neutral
      },
    };
  });