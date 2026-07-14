import { getRequest } from "@tanstack/react-start/server";

type AuditSupabase = {
  from: (table: "audit_log") => {
    insert: (row: Record<string, unknown>) => Promise<unknown>;
  };
};

export async function audit(
  supabase: AuditSupabase,
  actorId: string | null,
  action: string,
  entity?: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const req = getRequest();
      if (req?.headers) {
        ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        userAgent = req.headers.get("user-agent") ?? null;
      }
    } catch {
      /* no request context (e.g. cron) */
    }
    await supabase.from("audit_log").insert({
      actor_id: actorId,
      action,
      entity: entity ?? null,
      entity_id: entityId ?? null,
      metadata: metadata ?? null,
      ip,
      user_agent: userAgent,
    });
  } catch (err) {
    console.error("[audit] failed", err);
  }
}