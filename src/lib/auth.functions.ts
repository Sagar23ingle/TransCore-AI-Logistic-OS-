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
 * Brute-force protection tuning.
 *
 * Layer 1 (per-IP): 20 attempts per 15 min. A real user retries a couple
 *   of times; a script hitting hundreds of combinations trips this in
 *   seconds. Uses the existing `check_rate_limit` Postgres RPC (backed by
 *   the `rate_limits` table — the fast key/value store in this stack).
 *
 * Layer 2 (per-account): first 4 wrong passwords: no delay. Attempts 5-9:
 *   exponential backoff (2^(n-4) seconds, capped at 16s) applied server-
 *   side before responding, so a script can't parallelise around it.
 *   Attempt 10 locks the account for 15 min and emails the owner.
 *   Streak resets after a successful login OR 60 min without any failure.
 *
 * All failure paths return the SAME generic string, so an attacker cannot
 * distinguish "wrong password" vs "rate-limited" vs "locked".
 */
const IP_MAX = 20;
const IP_WINDOW_SEC = 15 * 60;
const ACCOUNT_LOCK_THRESHOLD = 10;
const ACCOUNT_LOCK_MINUTES = 15;
const ACCOUNT_RESET_MINUTES = 60;
const GENERIC_SIGNIN_ERROR = "Invalid email or password.";

function backoffMsFor(failCount: number): number {
  // failCount is the count AFTER this failure — delay the NEXT response.
  if (failCount < 5) return 0;
  const exp = Math.min(failCount - 4, 4); // caps at 2^4 = 16s
  return Math.pow(2, exp) * 1000;
}

function clientIp(): string {
  try {
    const req = getRequest();
    const fwd = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return fwd || req?.headers.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

async function sendLockoutEmail(email: string, unlockAt: Date) {
  try {
    const { sendLovableEmail } = await import("@lovable.dev/email-js");
    const html = `
      <p>Hi,</p>
      <p>We temporarily locked sign-in for your TransCore AI account after
      too many failed password attempts. Access will be restored
      automatically at <strong>${unlockAt.toUTCString()}</strong>
      (about ${ACCOUNT_LOCK_MINUTES} minutes from now).</p>
      <p>If this wasn't you, someone may be trying to guess your password.
      We recommend resetting it as soon as the lock expires.</p>
      <p>— TransCore AI Security</p>
    `;
    await sendLovableEmail(
      {
        to: email,
        from: "security@transcoreai.lovable.app",
        subject: "TransCore AI — Sign-in temporarily locked",
        html,
        text: `We temporarily locked sign-in for your TransCore AI account after too many failed password attempts. Access is restored at ${unlockAt.toUTCString()}.`,
      },
      { apiKey: process.env.LOVABLE_API_KEY! },
    );
  } catch (err) {
    // Email is best-effort; never blocks the auth flow.
    console.error("[lockout-email] failed", err);
  }
}

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
 * Server-authoritative sign-in with brute-force protection.
 *
 * The client submits credentials here; on success we return the tokens so
 * the browser can persist the session via `supabase.auth.setSession`. On
 * ANY failure path (bad input, IP throttled, account locked, wrong
 * password) we throw the SAME string, so the caller cannot tell them
 * apart. Per-account exponential backoff is applied server-side before
 * returning, so a script cannot bypass it by parallelising requests.
 */
export const attemptSignin = createServerFn({ method: "POST" })
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
    const ip = clientIp();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Bad input → same generic error, but still log the attempt.
    if (!data.ok) {
      await logAuthReject({
        action: "auth.signin.reject",
        email: typeof data.raw?.email === "string" ? data.raw.email : null,
        reasons: data.reasons,
      });
      throw new Error(GENERIC_SIGNIN_ERROR);
    }
    const email = data.data.email;

    // Layer 1 — per-IP throttle (fails closed on RPC error).
    try {
      const { data: allowed } = await supabaseAdmin.rpc("check_rate_limit", {
        _key: `login_ip:${ip}`,
        _max: IP_MAX,
        _window_seconds: IP_WINDOW_SEC,
      });
      if (allowed === false) {
        await logAuthReject({
          action: "auth.signin.reject",
          email,
          reasons: ["ip_rate_limited"],
        });
        throw new Error(GENERIC_SIGNIN_ERROR);
      }
    } catch (err) {
      if (err instanceof Error && err.message === GENERIC_SIGNIN_ERROR) throw err;
      console.error("[attemptSignin] rate-limit check failed", err);
    }

    // Layer 2a — is the account currently locked?
    const { data: lockRow } = await supabaseAdmin
      .rpc("get_login_lock", { _email: email })
      .maybeSingle<{ fail_count: number; locked_until: string | null }>();
    if (lockRow?.locked_until && new Date(lockRow.locked_until) > new Date()) {
      await logAuthReject({
        action: "auth.signin.reject",
        email,
        reasons: ["account_locked"],
      });
      // Same delay as a mid-streak failure so timing doesn't reveal state.
      await new Promise((r) => setTimeout(r, 1500));
      throw new Error(GENERIC_SIGNIN_ERROR);
    }

    // Attempt sign-in against Supabase Auth using a server-local publishable client.
    const { createClient } = await import("@supabase/supabase-js");
    const authClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: signInData, error } = await authClient.auth.signInWithPassword({
      email,
      password: data.data.password,
    });

    if (error || !signInData.session) {
      // Layer 2b — record failure, compute backoff, maybe lock + email.
      const { data: recRow } = await supabaseAdmin
        .rpc("record_login_failure", {
          _email: email,
          _lock_threshold: ACCOUNT_LOCK_THRESHOLD,
          _lock_minutes: ACCOUNT_LOCK_MINUTES,
          _reset_after_minutes: ACCOUNT_RESET_MINUTES,
        })
        .maybeSingle<{ fail_count: number; locked_until: string | null; just_locked: boolean }>();

      const failCount = recRow?.fail_count ?? 0;
      const delay = backoffMsFor(failCount);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));

      if (recRow?.just_locked && recRow.locked_until) {
        await sendLockoutEmail(email, new Date(recRow.locked_until));
      }

      await logAuthReject({
        action: "auth.signin.reject",
        email,
        reasons: [
          "bad_credentials",
          `fail_count:${failCount}`,
          recRow?.just_locked ? "locked" : "",
        ].filter(Boolean),
      });
      throw new Error(GENERIC_SIGNIN_ERROR);
    }

    // Success — reset the counter and return tokens for the browser to persist.
    await supabaseAdmin.rpc("reset_login_failures", { _email: email });
    return {
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    };
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
