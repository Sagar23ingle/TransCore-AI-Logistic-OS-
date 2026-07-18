import { createFileRoute } from "@tanstack/react-router";

/**
 * Nightly automated alert scanner (called by pg_cron).
 * POST /api/public/hooks/compliance-scan
 * Auth: send the shared secret as either
 *   X-Cron-Secret: <CRON_SECRET>
 *   -- or --
 *   Authorization: Bearer <CRON_SECRET>
 * The value is validated with a constant-time compare against process.env.CRON_SECRET.
 *
 * Detects across every company:
 *  - Document / permit / insurance / PUC / fitness / EMI expiries
 *  - Scheduled maintenance due
 *  - Driver license expiry
 *  - Idle vehicles (active vehicle with no GPS ping for >48h)
 *  - Low fuel efficiency (last 30d km/l < 60% of vehicle's trailing 90d average)
 * Idempotent — uses (owner_id, dedup_key) upserts. Dispatches Web Push
 * notifications for newly-created critical/warning alerts to the vehicle's
 * owner (respecting per-user alert_prefs.push_enabled).
 */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

const WINDOWS = [30, 15, 7, 3, 0] as const;
function bucket(days: number): number | null {
  for (const w of WINDOWS) if (days <= w) return w;
  return null;
}
function severity(days: number): "info" | "warning" | "critical" {
  if (days <= 3) return "critical";
  if (days <= 15) return "warning";
  return "info";
}

type Row = {
  owner_id: string;
  company_id: string;
  vehicle_id?: string | null;
  driver_id?: string | null;
  kind: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  due_date: string | null;
  days_remaining: number | null;
  dedup_key: string;
};

export const Route = createFileRoute("/api/public/hooks/compliance-scan")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const expected = process.env.CRON_SECRET;
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected || !provided || provided.length !== expected.length) {
          return json({ error: "unauthorized" }, 401);
        }
        // Timing-safe compare
        let diff = 0;
        for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
        if (diff !== 0) return json({ error: "unauthorized" }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Hard per-endpoint throttle: at most 6 successful runs / hour, regardless of caller.
        // Prevents runaway loops if the cron misfires or the secret leaks.
        const rl = await supabaseAdmin.rpc("check_rate_limit", {
          _key: "compliance-scan:global",
          _max: 6,
          _window_seconds: 3600,
        });
        if (rl.data === false) return json({ error: "rate_limited" }, 429);

        const [vehR, driR] = await Promise.all([
          supabaseAdmin.from("vehicles").select("id, owner_id, company_id, registration_number, insurance_expiry, permit_expiry, fitness_expiry, puc_expiry, emi_next_due, maintenance_next_due"),
          supabaseAdmin.from("drivers").select("id, owner_id, company_id, full_name, license_expiry"),
        ]);

        const rows: Row[] = [];

        function pushVehicle(v: {
          id: string; owner_id: string; company_id: string | null; registration_number: string;
        }, kind: string, label: string, date: string | null | undefined) {
          if (!v.company_id) return;
          const days = daysUntil(date ?? null);
          if (days == null) return;
          if (days < 0) {
            if (days < -7) return;
            rows.push({
              owner_id: v.owner_id, company_id: v.company_id, vehicle_id: v.id,
              kind, severity: "critical",
              title: `${label} overdue`,
              message: `${v.registration_number} — ${label} was due ${Math.abs(days)} day(s) ago.`,
              due_date: date!, days_remaining: days,
              dedup_key: `veh:${v.id}:${kind}:overdue`,
            });
            return;
          }
          const b = bucket(days);
          if (b == null) return;
          rows.push({
            owner_id: v.owner_id, company_id: v.company_id, vehicle_id: v.id,
            kind, severity: severity(days),
            title: `${label} in ${days} day(s)`,
            message: `${v.registration_number} — ${label} expires on ${date}.`,
            due_date: date!, days_remaining: days,
            dedup_key: `veh:${v.id}:${kind}:${b}`,
          });
        }

        for (const v of vehR.data ?? []) {
          const vv = v as unknown as { id: string; owner_id: string; company_id: string | null; registration_number: string; insurance_expiry: string | null; permit_expiry: string | null; fitness_expiry: string | null; puc_expiry: string | null; emi_next_due: string | null; maintenance_next_due: string | null };
          pushVehicle(vv, "insurance_expiry", "Insurance", vv.insurance_expiry);
          pushVehicle(vv, "permit_expiry", "Permit", vv.permit_expiry);
          pushVehicle(vv, "fitness_expiry", "Fitness certificate", vv.fitness_expiry);
          pushVehicle(vv, "puc_expiry", "PUC", vv.puc_expiry);
          pushVehicle(vv, "emi_due", "EMI payment", vv.emi_next_due);
          pushVehicle(vv, "maintenance_due", "Scheduled maintenance", vv.maintenance_next_due);
        }

        for (const d of driR.data ?? []) {
          const dd = d as unknown as { id: string; owner_id: string; company_id: string | null; full_name: string; license_expiry: string | null };
          if (!dd.company_id) continue;
          const days = daysUntil(dd.license_expiry);
          if (days == null) continue;
          if (days < 0 && days < -7) continue;
          const b = days < 0 ? null : bucket(days);
          if (days >= 0 && b == null) continue;
          rows.push({
            owner_id: dd.owner_id, company_id: dd.company_id, driver_id: dd.id,
            kind: "license_expiry",
            severity: days < 0 ? "critical" : severity(days),
            title: days < 0 ? "Driving license overdue" : `Driving license in ${days} day(s)`,
            message: `${dd.full_name} — license ${days < 0 ? `expired ${Math.abs(days)}d ago` : `expires on ${dd.license_expiry}`}.`,
            due_date: dd.license_expiry!,
            days_remaining: days,
            dedup_key: days < 0 ? `dri:${dd.id}:license_expiry:overdue` : `dri:${dd.id}:license_expiry:${b}`,
          });
        }

        // --- Idle vehicles: no GPS ping in the last 48h while status = active ---
        const activeVehicles = (vehR.data ?? []).filter((v) => {
          const vv = v as { status?: string | null };
          return vv.status === "active";
        });
        if (activeVehicles.length > 0) {
          const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
          const { data: recentPings } = await supabaseAdmin
            .from("gps_pings")
            .select("vehicle_id")
            .gte("recorded_at", since);
          const seen = new Set<string>((recentPings ?? []).map((p) => (p as { vehicle_id: string }).vehicle_id));
          for (const v of activeVehicles) {
            const vv = v as unknown as { id: string; owner_id: string; company_id: string | null; registration_number: string };
            if (!vv.company_id || seen.has(vv.id)) continue;
            rows.push({
              owner_id: vv.owner_id, company_id: vv.company_id, vehicle_id: vv.id,
              kind: "vehicle_idle", severity: "warning",
              title: "Vehicle idle >48h",
              message: `${vv.registration_number} — no GPS activity in the last 48 hours.`,
              due_date: null, days_remaining: null,
              dedup_key: `veh:${vv.id}:vehicle_idle:48h`,
            });
          }
        }

        // --- Low fuel efficiency: last 30d km/l < 60% of trailing 90d average ---
        const day = 86400000;
        const since90 = new Date(Date.now() - 90 * day).toISOString().slice(0, 10);
        const { data: fuelRows } = await supabaseAdmin
          .from("fuel_logs")
          .select("vehicle_id, owner_id, company_id, filled_on, odometer_km, litres")
          .gte("filled_on", since90)
          .order("filled_on", { ascending: true });
        type Fuel = { vehicle_id: string; owner_id: string; company_id: string | null; filled_on: string; odometer_km: number | null; litres: number | null };
        const byVeh = new Map<string, Fuel[]>();
        for (const r of (fuelRows ?? []) as Fuel[]) {
          if (!r.company_id || r.litres == null || r.odometer_km == null) continue;
          const arr = byVeh.get(r.vehicle_id) ?? [];
          arr.push(r); byVeh.set(r.vehicle_id, arr);
        }
        const regByVeh = new Map<string, string>();
        for (const v of vehR.data ?? []) {
          const vv = v as { id: string; registration_number: string };
          regByVeh.set(vv.id, vv.registration_number);
        }
        const cutoff30 = new Date(Date.now() - 30 * day).toISOString().slice(0, 10);
        for (const [vehId, logs] of byVeh) {
          if (logs.length < 4) continue;
          const kmpl = (subset: Fuel[]) => {
            if (subset.length < 2) return null;
            const first = subset[0], last = subset[subset.length - 1];
            const km = Number(last.odometer_km) - Number(first.odometer_km);
            const lit = subset.slice(1).reduce((s, r) => s + Number(r.litres ?? 0), 0);
            if (km <= 0 || lit <= 0) return null;
            return km / lit;
          };
          const recent = logs.filter((r) => r.filled_on >= cutoff30);
          const avg90 = kmpl(logs);
          const avg30 = kmpl(recent);
          if (!avg90 || !avg30 || avg30 >= avg90 * 0.6) continue;
          const owner = logs[0].owner_id, company = logs[0].company_id!;
          rows.push({
            owner_id: owner, company_id: company, vehicle_id: vehId,
            kind: "low_fuel_efficiency", severity: "warning",
            title: "Fuel efficiency dropped",
            message: `${regByVeh.get(vehId) ?? "Vehicle"} — last 30d avg ${avg30.toFixed(1)} km/l vs 90d avg ${avg90.toFixed(1)} km/l.`,
            due_date: null, days_remaining: null,
            dedup_key: `veh:${vehId}:low_fuel_efficiency:30v90`,
          });
        }

        if (rows.length === 0) return json({ ok: true, generated: 0, pushed: 0 });

        // upsert per (owner_id, dedup_key)
        const { data: upserted, error } = await supabaseAdmin
          .from("alerts")
          .upsert(rows as never, { onConflict: "owner_id,dedup_key", ignoreDuplicates: false })
          .select("id, owner_id, title, message, severity, dedup_key, created_at");
        if (error) return json({ error: "insert_failed", detail: error.message }, 500);

        // --- Push notifications for freshly-created critical/warning alerts ---
        let pushed = 0;
        try {
          const fresh = (upserted ?? []).filter((a) => {
            const created = new Date((a as { created_at: string }).created_at).getTime();
            const sev = (a as { severity: string }).severity;
            return Date.now() - created < 5 * 60 * 1000 && (sev === "critical" || sev === "warning");
          });
          if (fresh.length > 0) {
            const ownerIds = Array.from(new Set(fresh.map((a) => (a as { owner_id: string }).owner_id)));
            const [{ data: prefs }, { data: subs }] = await Promise.all([
              supabaseAdmin.from("alert_prefs").select("user_id, push_enabled").in("user_id", ownerIds),
              supabaseAdmin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").in("user_id", ownerIds),
            ]);
            const pushOff = new Set((prefs ?? []).filter((p) => (p as { push_enabled: boolean }).push_enabled === false).map((p) => (p as { user_id: string }).user_id));
            const subsByUser = new Map<string, { endpoint: string; p256dh: string; auth: string }[]>();
            for (const s of (subs ?? []) as { user_id: string; endpoint: string; p256dh: string; auth: string }[]) {
              if (pushOff.has(s.user_id)) continue;
              const arr = subsByUser.get(s.user_id) ?? [];
              arr.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
              subsByUser.set(s.user_id, arr);
            }
            if (subsByUser.size > 0) {
              const { sendPush } = await import("@/lib/push-dispatch.server");
              const expiredAll: string[] = [];
              for (const a of fresh) {
                const aa = a as { owner_id: string; title: string; message: string; dedup_key: string };
                const targets = subsByUser.get(aa.owner_id);
                if (!targets?.length) continue;
                const res = await sendPush(targets, {
                  title: aa.title, body: aa.message, tag: aa.dedup_key, url: "/alerts",
                });
                pushed += res.sent;
                expiredAll.push(...res.expired);
              }
              if (expiredAll.length) {
                await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expiredAll);
              }
            }
          }
        } catch (e) {
          console.error("push dispatch failed", e);
        }

        return json({ ok: true, generated: rows.length, pushed });
      },
    },
  },
} as never);