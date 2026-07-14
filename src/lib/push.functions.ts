import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SubInput = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  user_agent: z.string().max(500).optional(),
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => SubInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .upsert({ ...data, user_id: context.userId, last_seen_at: new Date().toISOString() } as never, { onConflict: "endpoint" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ endpoint: z.string().url() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAlertPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("alert_prefs").select("*").eq("user_id", context.userId).maybeSingle();
    return data ?? {
      user_id: context.userId, email_enabled: true, push_enabled: true, document_expiry: true,
      emi_reminders: true, maintenance: true, trip_updates: true, marketplace_matches: true,
    };
  });

export const saveAlertPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    email_enabled: z.boolean(), push_enabled: z.boolean(), document_expiry: z.boolean(),
    emi_reminders: z.boolean(), maintenance: z.boolean(), trip_updates: z.boolean(), marketplace_matches: z.boolean(),
  }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("alert_prefs")
      .upsert({ user_id: context.userId, ...data, updated_at: new Date().toISOString() } as never, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });