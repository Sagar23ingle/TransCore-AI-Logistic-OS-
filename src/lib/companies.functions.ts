import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("company_members")
      .select("role, company:companies(id, name, gstin, contact_email, contact_phone, created_at)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return (data ?? []).map((m) => ({
      company_id: (m.company as { id: string } | null)?.id ?? "",
      name: (m.company as { name: string } | null)?.name ?? "",
      gstin: (m.company as { gstin: string | null } | null)?.gstin ?? null,
      contact_email: (m.company as { contact_email: string | null } | null)?.contact_email ?? null,
      contact_phone: (m.company as { contact_phone: string | null } | null)?.contact_phone ?? null,
      role: m.role as "owner" | "manager" | "driver" | "broker" | "viewer",
    })).filter((c) => c.company_id);
  });

const CompanyInput = z.object({
  name: z.string().trim().min(2).max(120),
  gstin: z.string().trim().max(20).nullish(),
  contact_email: z.string().trim().email().max(200).nullish(),
  contact_phone: z.string().trim().max(30).nullish(),
  address: z.string().trim().max(500).nullish(),
});

export const createCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CompanyInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { data: company, error } = await context.supabase
      .from("companies")
      .insert({ ...data, created_by: context.userId } as never)
      .select("id")
      .single();
    if (error || !company) { console.error(error); throw new Error("Could not create company."); }
    const { error: mErr } = await context.supabase
      .from("company_members")
      .insert({ company_id: company.id, user_id: context.userId, role: "owner" } as never);
    if (mErr) { console.error(mErr); throw new Error("Could not add you as owner."); }
    return company;
  });

export const updateCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CompanyInput.extend({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("companies").update(patch as never).eq("id", id);
    if (error) { console.error(error); throw new Error("Update failed."); }
    return { ok: true };
  });

export const listCompanyMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ company_id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { data: members, error } = await context.supabase
      .from("company_members")
      .select("id, role, user_id, created_at")
      .eq("company_id", data.company_id)
      .order("created_at", { ascending: true });
    if (error) { console.error(error); throw new Error("Request failed."); }
    const ids = (members ?? []).map((m) => m.user_id as string);
    const profileMap = new Map<string, { full_name: string | null; phone: string | null }>();
    if (ids.length) {
      const { data: profs } = await context.supabase.from("profiles").select("id, full_name, phone").in("id", ids);
      for (const p of profs ?? []) profileMap.set(p.id as string, { full_name: p.full_name as string | null, phone: p.phone as string | null });
    }
    return (members ?? []).map((m) => ({
      ...m,
      full_name: profileMap.get(m.user_id as string)?.full_name ?? null,
      phone: profileMap.get(m.user_id as string)?.phone ?? null,
    }));
  });

const InviteInput = z.object({
  company_id: z.string().uuid(),
  email: z.string().trim().email().max(200),
  role: z.enum(["owner", "manager", "driver", "broker", "viewer"]),
});

export const addCompanyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => InviteInput.parse(raw))
  .handler(async ({ context, data }) => {
    // Privileged (admin listUsers). Verify the CALLER is an owner/manager of
    // this company before doing anything — otherwise any signed-in user can
    // probe whether an email has an account here.
    const { data: canWrite, error: permErr } = await context.supabase
      .rpc("can_write_company", { _company: data.company_id });
    if (permErr) { console.error(permErr); throw new Error("Permission check failed."); }
    if (!canWrite) throw new Error("You do not have permission to add members to this company.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // listUsers is paginated (default perPage=50, cap 1000). Walk pages until
    // we find the target or run out — the old `perPage: 200` silently missed
    // any user past the first page.
    const needle = data.email.toLowerCase();
    let target: { id: string } | undefined;
    for (let page = 1; page <= 20; page++) {
      const { data: list, error: lErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (lErr) { console.error(lErr); throw new Error("Could not look up user."); }
      target = list?.users?.find((u) => u.email?.toLowerCase() === needle);
      if (target) break;
      if (!list?.users || list.users.length < 1000) break;
    }
    if (!target) throw new Error("No user with that email. Ask them to sign up first.");
    const { error } = await context.supabase
      .from("company_members")
      .upsert({ company_id: data.company_id, user_id: target.id, role: data.role, invited_by: context.userId } as never, { onConflict: "company_id,user_id" });
    if (error) { console.error(error); throw new Error("Could not add member."); }
    return { ok: true, user_id: target.id };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    id: z.string().uuid(),
    role: z.enum(["owner", "manager", "driver", "broker", "viewer"]),
  }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("company_members").update({ role: data.role } as never).eq("id", data.id);
    if (error) { console.error(error); throw new Error("Update failed."); }
    return { ok: true };
  });

export const removeCompanyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("company_members").delete().eq("id", data.id);
    if (error) { console.error(error); throw new Error("Remove failed."); }
    return { ok: true };
  });