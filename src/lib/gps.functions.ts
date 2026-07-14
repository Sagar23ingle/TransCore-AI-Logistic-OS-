import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Vehicles + their most-recent ping. Status derived from ping age & speed. */
export const getFleetLive = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [vehiclesR, pingsR] = await Promise.all([
      supabase
        .from("vehicles")
        .select("id, registration_number, make, model, vehicle_type, status")
        .eq("owner_id", userId),
      supabase
        .from("gps_pings")
        .select("vehicle_id, lat, lng, speed_kmh, heading, recorded_at, source")
        .eq("owner_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(500),
    ]);
    const latest = new Map<
      string,
      { lat: number; lng: number; speed_kmh: number | null; heading: number | null; recorded_at: string; source: string }
    >();
    for (const p of pingsR.data ?? []) {
      if (!latest.has(p.vehicle_id)) {
        latest.set(p.vehicle_id, {
          lat: Number(p.lat),
          lng: Number(p.lng),
          speed_kmh: p.speed_kmh == null ? null : Number(p.speed_kmh),
          heading: p.heading == null ? null : Number(p.heading),
          recorded_at: p.recorded_at as string,
          source: p.source as string,
        });
      }
    }
    const now = Date.now();
    return (vehiclesR.data ?? []).map((v) => {
      const last = latest.get(v.id);
      let liveStatus: "running" | "idle" | "offline" = "offline";
      if (last) {
        const ageMs = now - new Date(last.recorded_at).getTime();
        if (ageMs > 15 * 60 * 1000) liveStatus = "offline";
        else if ((last.speed_kmh ?? 0) > 5) liveStatus = "running";
        else liveStatus = "idle";
      }
      return { ...v, last, liveStatus };
    });
  });

/** Full route polyline for a trip (all pings, in order). */
export const getTripRoute = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ trip_id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("gps_pings")
      .select("lat, lng, speed_kmh, recorded_at")
      .eq("owner_id", userId)
      .eq("trip_id", data.trip_id)
      .order("recorded_at", { ascending: true })
      .limit(5000);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return (rows ?? []).map((r) => ({
      lat: Number(r.lat),
      lng: Number(r.lng),
      speed_kmh: r.speed_kmh == null ? null : Number(r.speed_kmh),
      recorded_at: r.recorded_at as string,
    }));
  });

/** Route history for a single vehicle in a time window. */
export const getVehicleHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({ vehicle_id: z.string().uuid(), since_iso: z.string().datetime().optional() })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const since = data.since_iso ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from("gps_pings")
      .select("lat, lng, speed_kmh, heading, recorded_at")
      .eq("owner_id", userId)
      .eq("vehicle_id", data.vehicle_id)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true })
      .limit(5000);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return (rows ?? []).map((r) => ({
      lat: Number(r.lat),
      lng: Number(r.lng),
      speed_kmh: r.speed_kmh == null ? null : Number(r.speed_kmh),
      heading: r.heading == null ? null : Number(r.heading),
      recorded_at: r.recorded_at as string,
    }));
  });

/** Browser-side driver ping (used by driver PWA while trip active). */
export const submitBrowserPing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        vehicle_id: z.string().uuid(),
        trip_id: z.string().uuid().optional(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        speed_kmh: z.number().min(0).max(300).optional(),
        heading: z.number().min(0).max(360).optional(),
        accuracy_m: z.number().min(0).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("gps_pings").insert({
      owner_id: userId,
      vehicle_id: data.vehicle_id,
      trip_id: data.trip_id ?? null,
      lat: data.lat,
      lng: data.lng,
      speed_kmh: data.speed_kmh ?? null,
      heading: data.heading ?? null,
      accuracy_m: data.accuracy_m ?? null,
      source: "browser",
    } as never);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return { ok: true };
  });