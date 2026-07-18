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
  name: "list_vehicles",
  title: "List vehicles",
  description:
    "List vehicles in the signed-in user's fleet. Returns registration, make/model, status, odometer, and upcoming compliance expiries (insurance, permit, fitness, PUC).",
  inputSchema: {
    status: z.enum(["active", "in_maintenance", "inactive"]).optional().describe("Filter by vehicle status."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("vehicles")
      .select("id, registration_number, make, model, year, vehicle_type, status, odometer_km, insurance_expiry, permit_expiry, fitness_expiry, puc_expiry, maintenance_next_due")
      .order("registration_number", { ascending: true })
      .limit(limit ?? 50);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `${data?.length ?? 0} vehicles\n\n${JSON.stringify(data, null, 2)}` }],
      structuredContent: { vehicles: data ?? [] },
    };
  },
});