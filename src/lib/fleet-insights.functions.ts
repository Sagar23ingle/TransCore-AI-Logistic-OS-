import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const CACHE_TTL_MS = 30 * 60 * 1000;

const InsightSchema = z.object({
  title: z.string(),
  detail: z.string(),
  severity: z.enum(["info", "warning", "critical", "opportunity"]),
  category: z.enum(["trips", "fuel", "expenses", "drivers", "maintenance"]),
  action: z.string(),
});
export type FleetInsight = z.infer<typeof InsightSchema>;

const InsightsSchema = z.object({ insights: z.array(InsightSchema) });

const SYSTEM = `You are TransCore AI, a data-grounded logistics analyst for Indian truck fleet owners.
You MUST base every insight strictly on the JSON data provided. Never invent numbers, vehicles, drivers, or trips.
If data is sparse, say so honestly in the "detail". All money is in INR (₹). Be concise and actionable.
Return EXACTLY 5 insights covering a mix of trips, fuel, expenses, drivers, and maintenance where possible.`;

async function generateInsights(context: unknown): Promise<FleetInsight[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service is not configured on this server.");
  const gateway = createLovableAiGatewayProvider(key);
  const model = gateway("google/gemini-2.5-flash");

  const prompt = `Analyze this fleet's last 90 days of operations and produce exactly 5 distinct, high-value insights.

DATA (JSON):
${JSON.stringify(context).slice(0, 12000)}

Rules:
- Ground every claim in the data above.
- Prefer concrete numbers (₹, km, %, counts) taken from the data.
- Each "action" must be one short imperative sentence the owner can do this week.`;

  try {
    const { output } = await generateText({
      model,
      system: SYSTEM,
      prompt,
      output: Output.object({ schema: InsightsSchema }),
    });
    return output.insights.slice(0, 5);
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      try {
        const parsed = InsightsSchema.parse(JSON.parse(error.text ?? "{}"));
        return parsed.insights.slice(0, 5);
      } catch {
        return [];
      }
    }
    throw error;
  }
}

export const generateFleetInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ force: z.boolean().optional() }).parse(raw ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // 1) Serve from cache when fresh (<30 min) unless force refresh is requested.
    if (!data.force) {
      const { data: cached } = await supabase
        .from("fleet_insights_cache")
        .select("insights, generated_at")
        .eq("owner_id", userId)
        .maybeSingle();
      if (cached?.generated_at) {
        const ageMs = Date.now() - new Date(cached.generated_at).getTime();
        if (ageMs < CACHE_TTL_MS && Array.isArray(cached.insights)) {
          return {
            ok: true as const,
            insights: cached.insights as unknown as FleetInsight[],
            generatedAt: cached.generated_at,
            cached: true,
          };
        }
      }
    }

    // 2) Per-user cost guard: 6 refreshes / hour is enough given the 30-min cache.
    const guard = await supabase.rpc("check_rate_limit", {
      _key: `fleet_insights:${userId}`,
      _max: 6,
      _window_seconds: 3600,
    });
    if (guard.data === false) {
      return { ok: false as const, error: "Too many refreshes. Try again in a few minutes." };
    }

    // 3) Pull real, owner-scoped data (RLS enforced by requireSupabaseAuth).
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const [trips, fuel, expenses, drivers, maintenance] = await Promise.all([
      supabase
        .from("trips")
        .select("origin, destination, status, freight_amount, distance_km, actual_start, actual_end")
        .eq("owner_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("fuel_logs")
        .select("filled_on, litres, amount, odometer_km, station_name")
        .eq("owner_id", userId)
        .gte("filled_on", since.slice(0, 10))
        .order("filled_on", { ascending: false })
        .limit(80),
      supabase
        .from("expenses")
        .select("category, amount, incurred_on, notes")
        .eq("owner_id", userId)
        .gte("incurred_on", since.slice(0, 10))
        .order("incurred_on", { ascending: false })
        .limit(80),
      supabase
        .from("drivers")
        .select("full_name, status, license_expiry")
        .eq("owner_id", userId)
        .limit(50),
      supabase
        .from("maintenance_logs")
        .select("service_type, cost, serviced_on, odometer_km, notes")
        .eq("owner_id", userId)
        .gte("serviced_on", since.slice(0, 10))
        .order("serviced_on", { ascending: false })
        .limit(50),
    ]);

    const payload = {
      trips: trips.data ?? [],
      fuel_logs: fuel.data ?? [],
      expenses: expenses.data ?? [],
      drivers: drivers.data ?? [],
      maintenance: maintenance.data ?? [],
      counts: {
        trips: trips.data?.length ?? 0,
        fuel_logs: fuel.data?.length ?? 0,
        expenses: expenses.data?.length ?? 0,
        drivers: drivers.data?.length ?? 0,
        maintenance: maintenance.data?.length ?? 0,
      },
      window_days: 90,
    };

    const hasAnyData =
      payload.counts.trips + payload.counts.fuel_logs + payload.counts.expenses + payload.counts.maintenance > 0;
    if (!hasAnyData) {
      return { ok: false as const, error: "Not enough fleet data yet — log a few trips, fuel entries or expenses first." };
    }

    // 4) Call Gemini through the Lovable AI Gateway (server-only key).
    let insights: FleetInsight[] = [];
    try {
      insights = await generateInsights(payload);
    } catch {
      return { ok: false as const, error: "AI service temporarily unavailable. Please try again shortly." };
    }
    if (insights.length === 0) {
      return { ok: false as const, error: "Could not generate insights right now. Please try again shortly." };
    }

    // 5) Persist to cache (service_role so upsert isn't blocked by write-less RLS).
    const generatedAt = new Date().toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("fleet_insights_cache")
      .upsert({ owner_id: userId, insights: insights as unknown as never, generated_at: generatedAt });

    return { ok: true as const, insights, generatedAt, cached: false };
  });