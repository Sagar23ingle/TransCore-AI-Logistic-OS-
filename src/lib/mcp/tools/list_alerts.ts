import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_alerts",
  title: "List fleet alerts",
  description:
    "List current fleet alerts (insurance/permit/fitness/PUC expiry, idle vehicles, low fuel efficiency, maintenance due). Only active (undismissed) alerts by default.",
  inputSchema: {
    severity: z.enum(["critical", "warning", "info"]).optional(),
    include_dismissed: z.boolean().optional().describe("Include dismissed alerts (default false)."),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ severity, include_dismissed, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("alerts")
      .select("id, kind, severity, title, message, due_date, days_remaining, is_read, is_dismissed, created_at, vehicle_id, driver_id")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (severity) q = q.eq("severity", severity);
    if (!include_dismissed) q = q.eq("is_dismissed", false);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `${data?.length ?? 0} alerts\n\n${JSON.stringify(data, null, 2)}` }],
      structuredContent: { alerts: data ?? [] },
    };
  },
});