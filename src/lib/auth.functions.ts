import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  signupSchema,
  signinSchema,
  profileUpdateSchema,
  GENERIC_VALIDATION_ERROR,
} from "@/lib/auth-validation";

/**
 * Persist a rejected auth submission to `audit_log` so attack attempts are
 * reviewable later. Best-effort — never blocks the request or leaks details
 * to the caller. Uses the service-role client so pre-auth (anon) rejects
 * can still be recorded.
 */
async function logAuthReject(params: {
  action: "auth.signup.reject" | "auth.signin.reject" | "profile.update.reject";
  email?: string | null;
  actorId?: string | null;
  reasons: string[];
}) {
  try {
    let ip: string | null = null;
    let ua: string | null = null;
    try {
      const req = getRequest();
      ip = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      ua = req?.headers.get("user-agent") ?? null;
    } catch { /* no request ctx */ }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_log").insert({
      actor_id: params.actorId ?? null,
      action: params.action,
      entity: "auth",
      entity_id: null,
      // Store the email HASH-style prefix + reasons only — not the password
      // and not the raw HTML/script payload that triggered the reject.
      metadata: {
        email_prefix: (params.email ?? "").slice(0, 3),
        email_domain: (params.email ?? "").split("@")[1] ?? null,
        reasons: params.reasons.slice(0, 8),
      },
      ip,
      user_agent: ua,
    });
  } catch (err) {
    console.error("[auth-reject-log] failed", err);
  }
}

/**
 * Re-validate signup fields server-side. The client still calls
 * `supabase.auth.signUp` (needed for the email-confirm flow), but only
 * after this returns cleanly and only with the sanitised name we return.
 */
export const validateSignup = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => {
    const parsed = signupSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false as const,
        reasons: parsed.error.issues.map((i) => `${i.path.join(".")}:${i.code}`),
        raw: raw as { email?: unknown },
      };
    }
    return { ok: true as const, data: parsed.data };
  })
  .handler(async ({ data }) => {
    if (!data.ok) {
      await logAuthReject({
        action: "auth.signup.reject",
        email: typeof data.raw?.email === "string" ? data.raw.email : null,
        reasons: data.reasons,
      });
      throw new Error(GENERIC_VALIDATION_ERROR);
    }
    return { email: data.data.email, full_name: data.data.full_name };
  });

export const validateSignin = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => {
    const parsed = signinSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false as const,
        reasons: parsed.error.issues.map((i) => `${i.path.join(".")}:${i.code}`),
        raw: raw as { email?: unknown },
      };
    }
    return { ok: true as const, data: parsed.data };
  })
  .handler(async ({ data }) => {
    if (!data.ok) {
      await logAuthReject({
        action: "auth.signin.reject",
        email: typeof data.raw?.email === "string" ? data.raw.email : null,
        reasons: data.reasons,
      });
      throw new Error(GENERIC_VALIDATION_ERROR);
    }
    return { email: data.data.email };
  });

/**
 * Server-authoritative profile update. Replaces the direct
 * `supabase.from('profiles').upsert` the browser used to run — RLS
 * protected the row but not the field values.
 */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const parsed = profileUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false as const,
        reasons: parsed.error.issues.map((i) => `${i.path.join(".")}:${i.code}`),
      };
    }
    return { ok: true as const, data: parsed.data };
  })
  .handler(async ({ context, data }) => {
    if (!data.ok) {
      await logAuthReject({
        action: "profile.update.reject",
        actorId: context.userId,
        reasons: data.reasons,
      });
      throw new Error(GENERIC_VALIDATION_ERROR);
    }
    const now = new Date().toISOString();
    const { error } = await context.supabase.from("profiles").upsert({
      id: context.userId,
      full_name: data.data.full_name,
      phone: data.data.phone || null,
      company_name: data.data.company_name || null,
      updated_at: now,
    });
    if (error) {
      console.error("[updateMyProfile]", error);
      throw new Error("Request failed. Please try again.");
    }
    return { ok: true, full_name: data.data.full_name };
  });
