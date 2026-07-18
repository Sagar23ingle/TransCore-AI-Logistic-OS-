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
  name: "list_drivers",
  title: "List drivers",
  description:
    "List drivers in the signed-in user's fleet with license expiry, status, and joining date.",
  inputSchema: {
    status: z.enum(["active", "on_leave", "terminated"]).optional().describe("Filter by driver status."),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("drivers")
      .select("id, full_name, phone, license_number, license_expiry, status, monthly_salary, joined_on")
      .order("full_name", { ascending: true })
      .limit(limit ?? 50);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `${data?.length ?? 0} drivers\n\n${JSON.stringify(data, null, 2)}` }],
      structuredContent: { drivers: data ?? [] },
    };
  },
});