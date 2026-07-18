import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side super-admin gate + cross-tenant counts.
 * Replaces client-side `supabase.from(...).select({ count: 'exact' })` that used to
 * run straight from the admin page, so authorization no longer relies on RLS
 * alone — the caller's role is verified server-side before any privileged read.
 */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: rerr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (rerr) { console.error(rerr); throw new Error("Request failed. Please try again."); }
    if (!isAdmin) throw new Error("Forbidden");

    // Only after role verification, use the admin client for cross-tenant counts.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [users, vehicles, trips, ai] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("vehicles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("trips").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("ai_requests").select("id", { count: "exact", head: true }),
    ]);

    return {
      users: users.count ?? 0,
      vehicles: vehicles.count ?? 0,
      trips: trips.count ?? 0,
      ai: ai.count ?? 0,
    };
  });