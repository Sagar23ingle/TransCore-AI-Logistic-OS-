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
  name: "list_trips",
  title: "List trips",
  description:
    "List trips in the signed-in user's fleet. Filter by status and limit to recent rows for quick summaries.",
  inputSchema: {
    status: z.enum(["planned", "in_progress", "completed", "cancelled"]).optional(),
    limit: z.number().int().min(1).max(200).optional().describe("Default 25."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("trips")
      .select("id, origin, destination, status, scheduled_start, actual_start, actual_end, distance_km, freight_amount, advance_paid, client_name, vehicle_id, driver_id")
      .order("scheduled_start", { ascending: false, nullsFirst: false })
      .limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `${data?.length ?? 0} trips\n\n${JSON.stringify(data, null, 2)}` }],
      structuredContent: { trips: data ?? [] },
    };
  },
});