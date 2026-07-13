import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ExpenseInput = z.object({
  id: z.string().uuid().optional(),
  trip_id: z.string().uuid().nullish(),
  vehicle_id: z.string().uuid().nullish(),
  category: z.enum(["fuel", "toll", "maintenance", "driver_allowance", "loading", "unloading", "other"]),
  amount: z.number().min(0),
  incurred_on: z.string(),
  description: z.string().max(500).nullish(),
});

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("expenses")
      .select("*, vehicle:vehicles(id, registration_number), trip:trips(id, origin, destination)")
      .eq("owner_id", context.userId)
      .order("incurred_on", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ExpenseInput.parse(raw))
  .handler(async ({ context, data }) => {
    const payload = { ...data, owner_id: context.userId };
    const { data: row, error } = await context.supabase
      .from("expenses")
      .upsert(payload as never, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("expenses")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
