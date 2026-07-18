import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_fleet_summary",
  title: "Fleet summary",
  description:
    "Counts across the signed-in user's fleet: vehicles by status, drivers by status, trips in progress, and open critical/warning alerts. Great starting point for any question about fleet health.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const [veh, drv, trips, alerts] = await Promise.all([
      sb.from("vehicles").select("status"),
      sb.from("drivers").select("status"),
      sb.from("trips").select("status"),
      sb.from("alerts").select("severity, is_dismissed"),
    ]);
    const err = veh.error ?? drv.error ?? trips.error ?? alerts.error;
    if (err) return { content: [{ type: "text", text: err.message }], isError: true };

    const bucket = <T extends { status: string | null }>(rows: T[] | null) => {
      const out: Record<string, number> = {};
      for (const r of rows ?? []) { const k = r.status ?? "unknown"; out[k] = (out[k] ?? 0) + 1; }
      return out;
    };
    const openAlerts = (alerts.data ?? []).filter((a) => !a.is_dismissed);
    const summary = {
      vehicles: { total: veh.data?.length ?? 0, by_status: bucket(veh.data as { status: string | null }[]) },
      drivers: { total: drv.data?.length ?? 0, by_status: bucket(drv.data as { status: string | null }[]) },
      trips: { total: trips.data?.length ?? 0, by_status: bucket(trips.data as { status: string | null }[]) },
      open_alerts: {
        total: openAlerts.length,
        critical: openAlerts.filter((a) => a.severity === "critical").length,
        warning: openAlerts.filter((a) => a.severity === "warning").length,
        info: openAlerts.filter((a) => a.severity === "info").length,
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});