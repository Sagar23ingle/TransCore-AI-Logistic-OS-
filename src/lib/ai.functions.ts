import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const AiInput = z.object({
  kind: z.enum(["chat", "trip_analysis", "expense_insight", "document_summary"]),
  prompt: z.string().trim().min(2).max(4000),
});

const SYSTEM_PROMPT = `You are TransCore AI, a truthful logistics assistant for an Indian truck fleet company.

STRICT GROUNDING RULES:
1. A JSON block labelled COMPANY_DATA is provided with the user's real fleet, drivers, trips, fuel, expenses, maintenance, invoices, alerts and documents.
2. Answer EVERY question using ONLY facts derivable from COMPANY_DATA. Never use generic/world knowledge, industry averages, or invented numbers when COMPANY_DATA is non-empty.
3. If the specific fact the user asked about is not in COMPANY_DATA, reply exactly: "I don't have that information in your company data yet." — then suggest what to log so the answer becomes available.
4. Only when COMPANY_DATA is entirely empty (a brand-new account with no records at all) may you give generic logistics guidance, and you must prefix it with "General guidance (no company data found):".
5. Cite specifics: registration numbers, driver names, trip IDs, amounts in ₹, dates. Be concise and actionable.`;

async function callGemini(prompt: string, kind: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service is not configured on this server.");
  const gateway = createLovableAiGatewayProvider(key);
  const model = gateway("google/gemini-2.5-flash");

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text } = await generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: `[Task: ${kind}]\n${prompt}`,
      });
      return text;
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (/429|rate|5\d\d/i.test(message) && attempt === 0) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      break;
    }
  }
  const message = lastError instanceof Error ? lastError.message : "Unknown AI error";
  throw new Error(message);
}

export const runAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => AiInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Per-user cost guard: 20 AI calls / minute and 200 / hour.
    // Uses a Postgres SECURITY DEFINER counter (see check_rate_limit).
    const [minute, hour] = await Promise.all([
      supabase.rpc("check_rate_limit", { _key: `ai:${userId}:m`, _max: 20, _window_seconds: 60 }),
      supabase.rpc("check_rate_limit", { _key: `ai:${userId}:h`, _max: 200, _window_seconds: 3600 }),
    ]);
    if (minute.data === false || hour.data === false) {
      return { ok: false as const, error: "You're sending AI requests too fast. Please wait a moment and try again." };
    }

    try {
      const response = await callGemini(data.prompt, data.kind);
      await supabase.from("ai_requests").insert({
        owner_id: userId,
        kind: data.kind,
        prompt: data.prompt,
        response,
        model: "google/gemini-2.5-flash",
        status: "success",
      } as never);
      return { ok: true as const, response };
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI service temporarily unavailable. Please try again later.";
      await supabase.from("ai_requests").insert({
        owner_id: userId,
        kind: data.kind,
        prompt: data.prompt,
        model: "google/gemini-2.5-flash",
        status: "error",
        error: message,
      } as never);
      return { ok: false as const, error: "AI service temporarily unavailable. Please try again later." };
    }
  });

async function buildCompanyContext(supabase: typeof import("@supabase/supabase-js").SupabaseClient.prototype, userId: string) {
  // Resolve the caller's active company (falls back to owner-scoped rows if none).
  const { data: companyId } = await supabase.rpc("default_company_for", { _user: userId });

  const scoped = <T>(q: T): T => {
    const anyQ = q as unknown as { eq: (col: string, v: string) => T };
    return companyId ? anyQ.eq("company_id", companyId as string) : anyQ.eq("owner_id", userId);
  };

  const [vehicles, drivers, trips, fuel, expenses, maintenance, invoices, alerts, documents, driverScores] = await Promise.all([
    scoped(supabase.from("vehicles").select("id, registration_number, status, vehicle_type, make, model, year, fitness_expiry, insurance_expiry, permit_expiry, puc_expiry, odometer_km").limit(100)),
    scoped(supabase.from("drivers").select("id, full_name, phone, status, license_number, license_expiry, rating").limit(100)),
    scoped(supabase.from("trips").select("id, origin, destination, status, freight_amount, distance_km, planned_start, planned_end, actual_start, actual_end, vehicle_id, driver_id").order("created_at", { ascending: false }).limit(60)),
    scoped(supabase.from("fuel_logs").select("vehicle_id, fuel_type, quantity_liters, price_per_liter, total_amount, odometer_km, filled_at").order("filled_at", { ascending: false }).limit(80)),
    scoped(supabase.from("expenses").select("category, amount, incurred_on, vehicle_id, trip_id, description").order("incurred_on", { ascending: false }).limit(100)),
    scoped(supabase.from("maintenance_logs").select("vehicle_id, service_type, cost, service_date, next_service_km, next_service_date").order("service_date", { ascending: false }).limit(60)),
    scoped(supabase.from("invoices").select("invoice_number, status, total_amount, tax_amount, issued_on, due_on, paid_on, customer_name").order("issued_on", { ascending: false }).limit(60)),
    scoped(supabase.from("alerts").select("kind, severity, title, message, status, created_at").order("created_at", { ascending: false }).limit(40)),
    scoped(supabase.from("documents").select("name, doc_type, expiry_date, status").order("created_at", { ascending: false }).limit(60)),
    scoped(supabase.from("driver_scores").select("driver_id, period_start, period_end, overall_score, safety_score, efficiency_score, trips_count").order("period_end", { ascending: false }).limit(40)),
  ]);

  return {
    company_id: companyId ?? null,
    generated_at: new Date().toISOString(),
    counts: {
      vehicles: vehicles.data?.length ?? 0,
      drivers: drivers.data?.length ?? 0,
      trips: trips.data?.length ?? 0,
      fuel_logs: fuel.data?.length ?? 0,
      expenses: expenses.data?.length ?? 0,
      maintenance: maintenance.data?.length ?? 0,
      invoices: invoices.data?.length ?? 0,
      alerts: alerts.data?.length ?? 0,
      documents: documents.data?.length ?? 0,
    },
    vehicles: vehicles.data ?? [],
    drivers: drivers.data ?? [],
    trips: trips.data ?? [],
    fuel_logs: fuel.data ?? [],
    expenses: expenses.data ?? [],
    maintenance: maintenance.data ?? [],
    invoices: invoices.data ?? [],
    alerts: alerts.data ?? [],
    documents: documents.data ?? [],
    driver_scores: driverScores.data ?? [],
  };
}

export const buildFleetContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => buildCompanyContext(context.supabase as never, context.userId));

// Grounded chat: assembles company context server-side and forces Gemini to
// answer only from it. Never trusts client-supplied context.
const AskInput = z.object({ question: z.string().trim().min(2).max(2000) });

export const askCompanyAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => AskInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const [minute, hour] = await Promise.all([
      supabase.rpc("check_rate_limit", { _key: `ai:${userId}:m`, _max: 20, _window_seconds: 60 }),
      supabase.rpc("check_rate_limit", { _key: `ai:${userId}:h`, _max: 200, _window_seconds: 3600 }),
    ]);
    if (minute.data === false || hour.data === false) {
      return { ok: false as const, error: "You're sending AI requests too fast. Please wait a moment and try again." };
    }

    try {
      const ctx = await buildCompanyContext(supabase as never, userId);
      const hasData = Object.values(ctx.counts).some((n) => n > 0);
      const prompt = `COMPANY_DATA (${hasData ? "populated" : "EMPTY"}):
${JSON.stringify(ctx)}

USER_QUESTION: ${data.question}

Answer strictly from COMPANY_DATA per the system rules.`;
      const response = await callGemini(prompt, "chat");
      await supabase.from("ai_requests").insert({
        owner_id: userId,
        kind: "chat",
        prompt: data.question,
        response,
        model: "google/gemini-2.5-flash",
        status: "success",
      } as never);
      return { ok: true as const, response, grounded: hasData };
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI error";
      await supabase.from("ai_requests").insert({
        owner_id: userId,
        kind: "chat",
        prompt: data.question,
        model: "google/gemini-2.5-flash",
        status: "error",
        error: message,
      } as never);
      return { ok: false as const, error: "AI service temporarily unavailable. Please try again later." };
    }
  });
