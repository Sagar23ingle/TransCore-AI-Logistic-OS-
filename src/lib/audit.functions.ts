import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ListInput = z.object({
  company_id: z.string().uuid().nullish(),
  q: z.string().trim().max(200).nullish(),
  action: z.string().trim().max(60).nullish(),
  entity: z.string().trim().max(60).nullish(),
  from: z.string().nullish(),
  to: z.string().nullish(),
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).max(10000).default(0),
});

export const listAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ListInput.parse(raw ?? {}))
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("audit_log")
      .select("id, actor_id, action, entity, entity_id, metadata, ip, user_agent, occurred_at, company_id")
      .order("occurred_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.company_id) q = q.eq("company_id", data.company_id);
    if (data.action) q = q.eq("action", data.action);
    if (data.entity) q = q.eq("entity", data.entity);
    if (data.from) q = q.gte("occurred_at", data.from);
    if (data.to) q = q.lte("occurred_at", data.to);
    if (data.q) {
      const like = `%${data.q}%`;
      q = q.or(`action.ilike.${like},entity.ilike.${like},entity_id.ilike.${like},ip.ilike.${like}`);
    }
    const { data: rows, error } = await q;
    if (error) { console.error(error); throw new Error("Request failed."); }
    const actorIds = Array.from(new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean))) as string[];
    const nameMap = new Map<string, string>();
    if (actorIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles").select("id, full_name").in("id", actorIds);
      for (const p of profs ?? []) nameMap.set(p.id as string, (p.full_name as string) ?? "");
    }
    return (rows ?? []).map((r) => ({
      ...r,
      actor_name: r.actor_id ? (nameMap.get(r.actor_id as string) ?? null) : null,
    }));
  });

export const listAuditFilterOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ company_id: z.string().uuid().nullish() }).parse(raw ?? {}))
  .handler(async ({ context, data }) => {
    let q = context.supabase.from("audit_log").select("action, entity").limit(1000);
    if (data.company_id) q = q.eq("company_id", data.company_id);
    const { data: rows } = await q;
    const actions = Array.from(new Set((rows ?? []).map((r) => r.action as string).filter(Boolean))).sort();
    const entities = Array.from(new Set((rows ?? []).map((r) => r.entity as string).filter(Boolean))).sort();
    return { actions, entities };
  });