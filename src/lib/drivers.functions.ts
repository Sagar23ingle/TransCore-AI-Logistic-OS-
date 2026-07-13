import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DriverInput = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(20).nullish(),
  license_number: z.string().trim().max(40).nullish(),
  license_expiry: z.string().nullish(),
  address: z.string().max(500).nullish(),
  status: z.enum(["active", "on_leave", "inactive"]),
  monthly_salary: z.number().min(0).nullish(),
  joined_on: z.string().nullish(),
  notes: z.string().max(2000).nullish(),
});

export const listDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("drivers")
      .select("*")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => DriverInput.parse(raw))
  .handler(async ({ context, data }) => {
    const payload = { ...data, owner_id: context.userId };
    const { data: row, error } = await context.supabase
      .from("drivers")
      .upsert(payload as never, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("drivers")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
