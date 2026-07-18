import { createFileRoute } from "@tanstack/react-router";

/**
 * HMAC-signed GPS ingest for external trackers (Traccar / Teltonika / MapMyIndia / custom).
 *
 *   POST /api/public/gps/ingest
 *   Content-Type: application/json
 *   X-Signature: hex(HMAC-SHA256(GPS_INGEST_SECRET, rawBody))
 *   {
 *     "vehicle_id": "<uuid>",
 *     "points": [{ "lat": 19.07, "lng": 72.87, "speed": 42.1, "heading": 90, "accuracy": 12, "recorded_at": "2026-07-14T12:00:00Z" }]
 *   }
 */
export const Route = createFileRoute("/api/public/gps/ingest")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const secret = process.env.GPS_INGEST_SECRET;
        if (!secret) return json({ error: "server_misconfigured" }, 500);

        const { createHmac, timingSafeEqual } = await import("crypto");
        const raw = await request.text();
        const provided = request.headers.get("x-signature") ?? "";
        const expected = createHmac("sha256", secret).update(raw).digest("hex");
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return json({ error: "invalid_signature" }, 401);
        }

        let payload: unknown;
        try { payload = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
        const body = payload as {
          vehicle_id?: string;
          points?: Array<{ lat?: number; lng?: number; speed?: number; heading?: number; accuracy?: number; recorded_at?: string; source?: string }>;
        };
        if (!body.vehicle_id || !Array.isArray(body.points) || body.points.length === 0) {
          return json({ error: "invalid_payload" }, 400);
        }
        if (body.points.length > 500) return json({ error: "too_many_points" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Per-vehicle throttle: 60 ingest calls / minute, 1000 / hour.
        // A well-behaved tracker pings every 5-30 seconds; this catches runaway devices
        // or compromised secrets without blocking legitimate fleets.
        const [rlM, rlH] = await Promise.all([
          supabaseAdmin.rpc("check_rate_limit", { _key: `gps:${body.vehicle_id}:m`, _max: 60, _window_seconds: 60 }),
          supabaseAdmin.rpc("check_rate_limit", { _key: `gps:${body.vehicle_id}:h`, _max: 1000, _window_seconds: 3600 }),
        ]);
        if (rlM.data === false || rlH.data === false) {
          return json({ error: "rate_limited" }, 429);
        }

        const { data: vehicle, error: vErr } = await supabaseAdmin
          .from("vehicles")
          .select("id, owner_id")
          .eq("id", body.vehicle_id)
          .maybeSingle();
        if (vErr || !vehicle) return json({ error: "unknown_vehicle" }, 404);

        const rows = body.points
          .filter((p) => typeof p.lat === "number" && typeof p.lng === "number" &&
            p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180)
          .map((p) => ({
            owner_id: vehicle.owner_id,
            vehicle_id: vehicle.id,
            lat: p.lat!,
            lng: p.lng!,
            speed_kmh: p.speed ?? null,
            heading: p.heading ?? null,
            accuracy_m: p.accuracy ?? null,
            source: (p.source ?? "device").toString().slice(0, 30),
            recorded_at: p.recorded_at ?? new Date().toISOString(),
          }));

        if (rows.length === 0) return json({ error: "no_valid_points" }, 400);

        const { error: insErr } = await supabaseAdmin.from("gps_pings").insert(rows as never);
        if (insErr) return json({ error: "insert_failed", detail: insErr.message }, 500);

        const last = rows[rows.length - 1];
        const { data: openTrip } = await supabaseAdmin
          .from("trips")
          .select("id")
          .eq("vehicle_id", vehicle.id)
          .eq("status", "in_progress")
          .order("actual_start", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (openTrip?.id) {
          await supabaseAdmin
            .from("trips")
            .update({ current_lat: last.lat, current_lng: last.lng, last_ping_at: last.recorded_at } as never)
            .eq("id", openTrip.id);
        }

        return json({ ok: true, accepted: rows.length }, 200);
      },
    },
  },
} as never);

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}