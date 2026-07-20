import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Client-side guard for user-facing actions.
 * - single-flight: while a call is in flight, further clicks are ignored
 * - cooldownMs: minimum interval between successful invocations
 * - dedupeKey (optional): also blocks duplicate submissions cross-component
 *   for `cooldownMs` using localStorage
 *
 * Server-side limits (Postgres check_rate_limit / requireSupabaseAuth) remain
 * the source of truth — this only prevents accidental spam and 429 storms.
 */
export function useRateLimitedAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  opts: { cooldownMs?: number; dedupeKey?: string; message?: string } = {},
) {
  const cooldownMs = opts.cooldownMs ?? 0;
  const inFlight = useRef(false);
  const lastRunAt = useRef(0);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((c) => (c <= 1000 ? 0 : c - 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (inFlight.current) return undefined;
      const now = Date.now();
      let last = lastRunAt.current;
      if (opts.dedupeKey && typeof window !== "undefined") {
        const stored = Number(localStorage.getItem(`rl:${opts.dedupeKey}`) ?? 0);
        if (stored > last) last = stored;
      }
      const wait = last + cooldownMs - now;
      if (wait > 0) {
        setCooldown(wait);
        toast.message(opts.message ?? `Please wait ${Math.ceil(wait / 1000)}s before trying again.`);
        return undefined;
      }
      inFlight.current = true;
      setPending(true);
      try {
        const result = await fn(...args);
        lastRunAt.current = Date.now();
        if (opts.dedupeKey && typeof window !== "undefined") {
          localStorage.setItem(`rl:${opts.dedupeKey}`, String(lastRunAt.current));
        }
        if (cooldownMs > 0) setCooldown(cooldownMs);
        return result;
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [fn, cooldownMs, opts.dedupeKey, opts.message],
  );

  return { run, pending, cooldown, disabled: pending || cooldown > 0 };
}