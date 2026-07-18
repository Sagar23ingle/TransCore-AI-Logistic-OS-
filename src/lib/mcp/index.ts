import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listVehicles from "./tools/list_vehicles";
import listDrivers from "./tools/list_drivers";
import listTrips from "./tools/list_trips";
import listAlerts from "./tools/list_alerts";
import getFleetSummary from "./tools/get_fleet_summary";

// The OAuth issuer MUST be the direct Supabase host. On publish, SUPABASE_URL
// is rewritten to the `.lovable.cloud` proxy, which mcp-js rejects (RFC 8414
// issuer mismatch). VITE_SUPABASE_PROJECT_ID is inlined by Vite at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "transcore-ai-mcp",
  title: "TransCore AI",
  version: "0.1.0",
  instructions:
    "Fleet operations tools for TransCore AI. All tools read the signed-in user's own fleet under RLS. Start with `get_fleet_summary` for an overview, then drill into `list_vehicles`, `list_drivers`, `list_trips`, or `list_alerts`.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getFleetSummary, listVehicles, listDrivers, listTrips, listAlerts],
});