import { createFileRoute } from "@tanstack/react-router";

/**
 * Nightly compliance scanner (called by pg_cron).
 * POST /api/public/hooks/compliance-scan
 * Auth: send the shared secret as either
 *   X-Cron-Secret: <CRON_SECRET>
 *   -- or --
 *   Authorization: Bearer <CRON_SECRET>
 * The value is validated with a constant-time compare against process.env.CRON_SECRET.
 *
 * Scans all vehicles + drivers, generates/updates alerts for expiring documents,
 * maintenance and license renewals. Idempotent — uses (company_id, dedup_key) upserts.
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
  due_date: string;
  days_remaining: number;
  dedup_key: string;
};

export const Route = createFileRoute("/api/public/hooks/compliance-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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

        if (rows.length === 0) return json({ ok: true, generated: 0 });

        // upsert per (owner_id, dedup_key)
        const { error } = await supabaseAdmin
          .from("alerts")
          .upsert(rows as never, { onConflict: "owner_id,dedup_key", ignoreDuplicates: false });
        if (error) return json({ error: "insert_failed", detail: error.message }, 500);
        return json({ ok: true, generated: rows.length });
      },
    },
  },
});