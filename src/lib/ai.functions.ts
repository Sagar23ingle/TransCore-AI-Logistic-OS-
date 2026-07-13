import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const AiInput = z.object({
  kind: z.enum(["chat", "trip_analysis", "expense_insight", "document_summary"]),
  prompt: z.string().trim().min(2).max(4000),
});

const SYSTEM_PROMPT = `You are TransCore AI, a truthful logistics assistant for Indian truck fleet owners.
You have access ONLY to the user's actual fleet, trip, expense, and document data provided in the prompt — never fabricate numbers, vehicles, drivers, trips, or metrics. If the user asks about data that is not in the prompt, say so honestly. Keep responses concise, actionable, and in INR (₹) where money is involved.`;

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

export const buildFleetContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [v, d, t, e] = await Promise.all([
      supabase.from("vehicles").select("registration_number, status, vehicle_type, insurance_expiry, permit_expiry").eq("owner_id", userId).limit(50),
      supabase.from("drivers").select("full_name, status, license_expiry").eq("owner_id", userId).limit(50),
      supabase.from("trips").select("origin, destination, status, freight_amount, distance_km, actual_end").eq("owner_id", userId).order("created_at", { ascending: false }).limit(30),
      supabase.from("expenses").select("category, amount, incurred_on").eq("owner_id", userId).order("incurred_on", { ascending: false }).limit(50),
    ]);
    return {
      vehicles: v.data ?? [],
      drivers: d.data ?? [],
      recentTrips: t.data ?? [],
      recentExpenses: e.data ?? [],
    };
  });
