import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return data ?? [];
  });

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("invoices")
      .select("*")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return data ?? [];
  });

const ActivationInput = z.object({
  plan_id: z.string().trim().min(1).max(64),
  plan_name: z.string().trim().min(1).max(120),
});

// Records a plan activation request. Rate-limited to 5/hour per user so we
// don't accumulate spam events, and logged in analytics_events + audit_log
// for the ops team to follow up. Never a fake toast — always persists.
export const requestPlanActivation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ActivationInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const guard = await supabase.rpc("check_rate_limit", {
      _key: `plan_activation:${userId}`,
      _max: 5,
      _window_seconds: 3600,
    });
    if (guard.data === false) {
      return { ok: false as const, error: "You've already requested this recently. Our team will reach out shortly." };
    }

    const { error } = await supabase.from("analytics_events").insert({
      owner_id: userId,
      event: "plan_activation_requested",
      properties: { plan_id: data.plan_id, plan_name: data.plan_name } as never,
    } as never);
    if (error) { console.error(error); return { ok: false as const, error: "Could not submit request. Please try again." }; }

    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "plan.activation_requested",
      entity: "plan",
      entity_id: data.plan_id,
      metadata: { plan_name: data.plan_name } as never,
    } as never);

    return { ok: true as const };
  });