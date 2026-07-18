import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LoadInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(120),
  origin: z.string().trim().min(2).max(200),
  origin_lat: z.number().min(-90).max(90).nullish(),
  origin_lng: z.number().min(-180).max(180).nullish(),
  destination: z.string().trim().min(2).max(200),
  destination_lat: z.number().min(-90).max(90).nullish(),
  destination_lng: z.number().min(-180).max(180).nullish(),
  distance_km: z.number().min(0).max(10000).nullish(),
  goods_type: z.string().trim().min(2).max(80),
  weight_tons: z.number().min(0.1).max(200),
  vehicle_type: z.string().trim().min(2).max(40),
  pickup_at: z.string(),
  delivery_by: z.string().nullish(),
  budget_amount: z.number().min(0).max(10_000_000),
  contact_name: z.string().max(120).nullish(),
  contact_phone: z.string().max(30).nullish(),
  notes: z.string().max(1000).nullish(),
  status: z.enum(["open", "assigned", "in_transit", "delivered", "cancelled"]).default("open"),
});

const TruckPostInput = z.object({
  id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid().nullish(),
  from_location: z.string().trim().min(2).max(200),
  from_lat: z.number().min(-90).max(90).nullish(),
  from_lng: z.number().min(-180).max(180).nullish(),
  to_location: z.string().max(200).nullish(),
  to_lat: z.number().min(-90).max(90).nullish(),
  to_lng: z.number().min(-180).max(180).nullish(),
  vehicle_type: z.string().trim().min(2).max(40),
  capacity_tons: z.number().min(0.1).max(200),
  available_from: z.string(),
  expected_rate: z.number().min(0).max(10_000_000).nullish(),
  contact_phone: z.string().max(30).nullish(),
  notes: z.string().max(1000).nullish(),
  is_active: z.boolean().default(true),
});

// Column list for loads readable by any authenticated user (contact_name/contact_phone are revoked at the DB level).
const LOAD_PUBLIC_COLS =
  "id, broker_id, assigned_owner_id, assigned_vehicle_id, title, origin, origin_lat, origin_lng, destination, destination_lat, destination_lng, distance_km, goods_type, weight_tons, vehicle_type, pickup_at, delivery_by, budget_amount, notes, status, created_at, updated_at";

// Same for truck_posts (contact_phone is revoked).
const TRUCK_POST_PUBLIC_COLS =
  "id, owner_id, vehicle_id, from_location, from_lat, from_lng, to_location, to_lat, to_lng, vehicle_type, capacity_tons, available_from, expected_rate, notes, is_active, created_at, updated_at";

export const listOpenLoads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("loads")
      .select(LOAD_PUBLIC_COLS)
      .in("status", ["open", "assigned"])
      .order("pickup_at", { ascending: true })
      .limit(200);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return data ?? [];
  });

export const listMyLoads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("loads")
      .select(LOAD_PUBLIC_COLS)
      .eq("broker_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return data ?? [];
  });

export const upsertLoad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => LoadInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("loads")
      .upsert({ ...data, broker_id: context.userId } as never, { onConflict: "id" })
      .select("id")
      .single();
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return row;
  });

export const cancelLoad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("loads")
      .update({ status: "cancelled" } as never)
      .eq("id", data.id)
      .eq("broker_id", context.userId);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return { ok: true };
  });

export const listAvailableTrucks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("truck_posts")
      .select(TRUCK_POST_PUBLIC_COLS)
      .eq("is_active", true)
      .order("available_from", { ascending: true })
      .limit(200);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return data ?? [];
  });

export const listMyTruckPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("truck_posts")
      .select(`${TRUCK_POST_PUBLIC_COLS}, vehicle:vehicles(id, registration_number)`)
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return data ?? [];
  });

export const upsertTruckPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => TruckPostInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("truck_posts")
      .upsert({ ...data, owner_id: context.userId } as never, { onConflict: "id" })
      .select("id")
      .single();
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return row;
  });

export const deactivateTruckPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("truck_posts")
      .update({ is_active: false } as never)
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return { ok: true };
  });

export const placeBid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ load_id: z.string().uuid(), bid_amount: z.number().min(1).max(10_000_000), message: z.string().max(500).optional() }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("load_bids")
      .upsert({
        load_id: data.load_id,
        bidder_id: context.userId,
        bid_amount: data.bid_amount,
        message: data.message ?? null,
        status: "offered",
      } as never, { onConflict: "load_id,bidder_id" })
      .select("*")
      .single();
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return row;
  });

export const listBidsForLoad = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ load_id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("load_bids")
      .select("*")
      .eq("load_id", data.load_id)
      .order("bid_amount", { ascending: true });
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return rows ?? [];
  });

export const acceptBid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ bid_id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: bid, error: be } = await supabase.from("load_bids").select("id, load_id, bidder_id, bid_amount").eq("id", data.bid_id).single();
    if (be || !bid) { if (be) console.error(be); throw new Error("Bid not found"); }
    const { data: load, error: le } = await supabase.from("loads").select("id, broker_id").eq("id", bid.load_id).single();
    if (le || !load) { if (le) console.error(le); throw new Error("Load not found"); }
    if (load.broker_id !== userId) throw new Error("Only the load broker can accept a bid");

    await supabase.from("loads").update({ status: "assigned", assigned_owner_id: bid.bidder_id } as never).eq("id", load.id);
    await supabase.from("load_bids").update({ status: "accepted" } as never).eq("id", bid.id);
    await supabase.from("load_bids").update({ status: "rejected" } as never).eq("load_id", load.id).neq("id", bid.id);
    return { ok: true };
  });

export const suggestMatchesForLoad = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ load_id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: load, error: le } = await supabase.from("loads").select("*").eq("id", data.load_id).single();
    if (le || !load) { if (le) console.error(le); throw new Error("Load not found"); }

    const { data: trucks, error: te } = await supabase
      .from("truck_posts")
      .select("*")
      .eq("is_active", true)
      .gte("capacity_tons", load.weight_tons);
    if (te) { console.error(te); throw new Error("Request failed. Please try again."); }

    const R = 6371;
    const rad = (deg: number) => (deg * Math.PI) / 180;
    function haversineKm(a1: number, o1: number, a2: number, o2: number) {
      const dLat = rad(a2 - a1), dLon = rad(o2 - o1);
      const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a1)) * Math.cos(rad(a2)) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.asin(Math.sqrt(s));
    }

    const scored = (trucks ?? []).map((t) => {
      let score = 50;
      if (t.vehicle_type === load.vehicle_type) score += 25;
      const capFit = Number(t.capacity_tons) / Number(load.weight_tons);
      if (capFit >= 1 && capFit <= 1.5) score += 15;
      else if (capFit <= 2) score += 8;
      let distanceKm: number | null = null;
      if (load.origin_lat != null && load.origin_lng != null && t.from_lat != null && t.from_lng != null) {
        distanceKm = haversineKm(Number(load.origin_lat), Number(load.origin_lng), Number(t.from_lat), Number(t.from_lng));
        if (distanceKm <= 50) score += 20;
        else if (distanceKm <= 200) score += 10;
        else if (distanceKm <= 500) score += 3;
      }
      const daysDiff = Math.abs(new Date(t.available_from as string).getTime() - new Date(load.pickup_at as string).getTime()) / 86400000;
      if (daysDiff <= 1) score += 10;
      else if (daysDiff <= 3) score += 5;
      return { truck: t, score: Math.min(100, score), distance_from_pickup_km: distanceKm };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, 20);
  });