import { useEffect, useRef, useState } from "react";

/**
 * CountUp — animates the numeric portion of a value string.
 * Preserves prefix/suffix (₹, %, commas, "Trips", etc.) by re-formatting
 * with the target's own separators. Triggers once when it enters the viewport.
 *
 * Pure display component — no side effects, no business logic.
 */
export function CountUp({
  value,
  duration = 1200,
  className,
}: {
  value: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState<string>(value);
  const playedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Parse the numeric portion of the target value.
    const match = value.match(/-?[\d.,]+/);
    if (!match) {
      setDisplay(value);
      return;
    }
    const raw = match[0];
    const target = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(target)) {
      setDisplay(value);
      return;
    }
    const prefix = value.slice(0, match.index);
    const suffix = value.slice((match.index ?? 0) + raw.length);
    const useGrouping = raw.includes(",");
    const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;

    // Prefers-reduced-motion → skip animation.
    const rm =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (rm) {
      setDisplay(value);
      return;
    }

    const run = () => {
      if (playedRef.current) return;
      playedRef.current = true;
      const start = performance.now();
      const ease = (t: number) => 1 - Math.pow(2, -10 * t); // easeOutExpo
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const v = target * ease(p);
        const n = v.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
          useGrouping,
        });
        setDisplay(`${prefix}${n}${suffix}`);
        if (p < 1) rafRef.current = requestAnimationFrame(tick);
        else setDisplay(value);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) { run(); io.disconnect(); }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // Re-run when the target value changes.
  }, [value, duration]);

  // Reset "played once" when the semantic value changes.
  useEffect(() => {
    playedRef.current = false;
  }, [value]);

  return (
    <span ref={ref} className={className} suppressHydrationWarning>
      {display}
    </span>
  );
}