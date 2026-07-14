import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TripInput = z.object({
  id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid().nullish(),
  driver_id: z.string().uuid().nullish(),
  origin: z.string().trim().min(2).max(200),
  destination: z.string().trim().min(2).max(200),
  status: z.enum(["planned", "in_progress", "completed", "cancelled"]),
  scheduled_start: z.string().nullish(),
  actual_start: z.string().nullish(),
  actual_end: z.string().nullish(),
  distance_km: z.number().min(0).nullish(),
  freight_amount: z.number().min(0).nullish(),
  advance_paid: z.number().min(0).nullish(),
  goods_description: z.string().max(500).nullish(),
  client_name: z.string().max(200).nullish(),
  notes: z.string().max(2000).nullish(),
});

export const listTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("trips")
      .select("*, vehicle:vehicles(id, registration_number), driver:drivers(id, full_name)")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return data ?? [];
  });

export const upsertTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => TripInput.parse(raw))
  .handler(async ({ context, data }) => {
    const payload = { ...data, owner_id: context.userId };
    const { data: row, error } = await context.supabase
      .from("trips")
      .upsert(payload as never, { onConflict: "id" })
      .select("*")
      .single();
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return row;
  });

export const deleteTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("trips")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return { ok: true };
  });
