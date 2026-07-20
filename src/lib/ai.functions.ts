import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const AiInput = z.object({
  kind: z.enum(["chat", "trip_analysis", "expense_insight", "document_summary", "route_optimize", "suggestion"]),
  prompt: z.string().trim().min(2).max(4000),
});

// Per-kind rate limits (see docs/user requirements).
// Values are (max, window seconds). All are per authenticated user.
const KIND_LIMITS: Record<string, ReadonlyArray<{ max: number; window: number; label: string }>> = {
  chat: [{ max: 10, window: 60, label: "minute" }],
  route_optimize: [{ max: 20, window: 3600, label: "hour" }],
  suggestion: [{ max: 15, window: 3600, label: "hour" }],
  trip_analysis: [{ max: 10, window: 3600, label: "hour" }],
  expense_insight: [{ max: 10, window: 3600, label: "hour" }],
  document_summary: [{ max: 15, window: 3600, label: "hour" }],
};
const AI_GLOBAL_HOUR = { max: 200, window: 3600 };

async function enforceAiLimits(
  supabase: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: boolean | null }> },
  userId: string,
  kind: string,
): Promise<string | null> {
  const tiers = KIND_LIMITS[kind] ?? [{ max: 10, window: 60, label: "minute" }];
  const checks = await Promise.all([
    ...tiers.map((t) =>
      supabase.rpc("check_rate_limit", {
        _key: `ai:${userId}:${kind}:${t.window}`,
        _max: t.max,
        _window_seconds: t.window,
      }),
    ),
    supabase.rpc("check_rate_limit", {
      _key: `ai:${userId}:all:h`,
      _max: AI_GLOBAL_HOUR.max,
      _window_seconds: AI_GLOBAL_HOUR.window,
    }),
  ]);
  if (checks.some((c) => c.data === false)) {
    return "Rate limit reached. Please wait before making another AI request.";
  }
  return null;
}

const SYSTEM_PROMPT = `You are TransCore AI — a warm, sharp fleet co-pilot for an Indian trucking business. Talk like a trusted operations manager sitting next to the owner, not a database.

GROUNDING:
- A JSON block COMPANY_DATA holds the user's real fleet, drivers, trips, fuel, expenses, maintenance, invoices, alerts, documents, and pre-computed AGGREGATES.
- Use ONLY facts derivable from COMPANY_DATA. Never invent numbers. If a fact is missing, say naturally it isn't logged yet and suggest what to record.
- If COMPANY_DATA is entirely empty, prefix generic advice with "General guidance (no company data found):".

VOICE & STYLE (this is a voice assistant — very important):
- Reply in the SAME language and script the user used. Hindi stays Hindi, Hinglish stays Hinglish, English stays English. Never translate their words.
- Sound human and conversational — like a friend explaining, not a report. Short sentences. Contractions are fine.
- Structure every answer as three tiny beats:
    1) Direct answer in one line (the headline number or fact).
    2) One useful insight (compare to fleet average, last month, a threshold, etc.).
    3) One helpful follow-up you could dig into — phrased as an offer, e.g. "Agar chahein to main bata sakta hoon…" or "Want me to break it down by route?".
- NEVER use markdown formatting (no *, **, #, -, tables, code fences). No emoji. Plain sentences only — this text will be spoken aloud.
- Keep total length under ~90 words unless the user explicitly asks for detail.
- Numbers in ₹ with Indian formatting (e.g. ₹1,25,000).
- Do the math yourself: mileage (km ÷ litres), cost/km, margin (freight − expenses), on-time %, ranking, period compares.
- For vague check-ins give a 4-line snapshot: revenue, expenses, top issue, one action.`;

async function callGemini(prompt: string, kind: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service is not configured on this server.");
  const gateway = createLovableAiGatewayProvider(key);
  // Pro for grounded chat (deeper reasoning), flash for quick tasks.
  const modelId = kind === "chat" ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash";
  const model = gateway(modelId);

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text } = await generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: `[Task: ${kind}]\n${prompt}`,
        temperature: 0.3,
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

    const blocked = await enforceAiLimits(supabase as never, userId, data.kind);
    if (blocked) return { ok: false as const, error: blocked };

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
    aggregates: computeAggregates({
      vehicles: vehicles.data ?? [],
      trips: trips.data ?? [],
      fuel: fuel.data ?? [],
      expenses: expenses.data ?? [],
      invoices: invoices.data ?? [],
      documents: documents.data ?? [],
    }),
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

type Row = Record<string, unknown>;
function num(v: unknown): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function computeAggregates(d: { vehicles: Row[]; trips: Row[]; fuel: Row[]; expenses: Row[]; invoices: Row[]; documents: Row[] }) {
  const now = Date.now();
  const in30 = now + 30 * 86400_000;
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const monthStart = startOfMonth.getTime();

  const fuelThisMonth = d.fuel.filter((f) => new Date(String(f.filled_at)).getTime() >= monthStart);
  const expensesThisMonth = d.expenses.filter((e) => new Date(String(e.incurred_on)).getTime() >= monthStart);
  const tripsThisMonth = d.trips.filter((t) => new Date(String(t.actual_start ?? t.planned_start)).getTime() >= monthStart);

  const revenueThisMonth = tripsThisMonth.reduce((s, t) => s + num(t.freight_amount), 0);
  const fuelSpendThisMonth = fuelThisMonth.reduce((s, f) => s + num(f.total_amount), 0);
  const otherExpensesThisMonth = expensesThisMonth.reduce((s, e) => s + num(e.amount), 0);

  const litresByVehicle = new Map<string, { l: number; km: number; cost: number }>();
  for (const f of d.fuel) {
    const k = String(f.vehicle_id ?? "");
    const prev = litresByVehicle.get(k) ?? { l: 0, km: 0, cost: 0 };
    prev.l += num(f.quantity_liters); prev.cost += num(f.total_amount);
    litresByVehicle.set(k, prev);
  }
  const kmByVehicle = new Map<string, number>();
  for (const t of d.trips) {
    const k = String(t.vehicle_id ?? "");
    kmByVehicle.set(k, (kmByVehicle.get(k) ?? 0) + num(t.distance_km));
  }
  const vehicleMileage = d.vehicles.map((v) => {
    const id = String(v.id);
    const f = litresByVehicle.get(id) ?? { l: 0, km: 0, cost: 0 };
    const km = kmByVehicle.get(id) ?? 0;
    return {
      registration: String(v.registration_number ?? ""),
      km_travelled: km,
      litres_consumed: +f.l.toFixed(1),
      kmpl: f.l > 0 ? +(km / f.l).toFixed(2) : null,
      fuel_cost: +f.cost.toFixed(0),
      cost_per_km: km > 0 ? +(f.cost / km).toFixed(2) : null,
    };
  });

  const expiringDocs = d.documents
    .filter((doc) => doc.expiry_date && new Date(String(doc.expiry_date)).getTime() <= in30)
    .map((doc) => ({ name: String(doc.name ?? ""), doc_type: String(doc.doc_type ?? ""), expiry_date: String(doc.expiry_date ?? "") }));

  const overdueInvoices = d.invoices
    .filter((i) => i.status !== "paid" && i.due_on && new Date(String(i.due_on)).getTime() < now)
    .map((i) => ({ invoice_number: String(i.invoice_number ?? ""), customer: String(i.customer_name ?? ""), amount: num(i.total_amount), due_on: String(i.due_on ?? "") }));

  const tripStatus = d.trips.reduce<Record<string, number>>((acc, t) => {
    const s = String(t.status ?? "unknown"); acc[s] = (acc[s] ?? 0) + 1; return acc;
  }, {});

  const vehicleStatus = d.vehicles.reduce<Record<string, number>>((acc, v) => {
    const s = String(v.status ?? "unknown"); acc[s] = (acc[s] ?? 0) + 1; return acc;
  }, {});

  return {
    this_month: {
      revenue_inr: revenueThisMonth,
      fuel_spend_inr: fuelSpendThisMonth,
      other_expenses_inr: otherExpensesThisMonth,
      gross_margin_inr: revenueThisMonth - fuelSpendThisMonth - otherExpensesThisMonth,
      trips_count: tripsThisMonth.length,
    },
    vehicle_mileage: vehicleMileage,
    trip_status_counts: tripStatus,
    vehicle_status_counts: vehicleStatus,
    expiring_docs_30d: expiringDocs,
    overdue_invoices: overdueInvoices,
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

    const blocked = await enforceAiLimits(supabase as never, userId, "chat");
    if (blocked) return { ok: false as const, error: blocked };

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
