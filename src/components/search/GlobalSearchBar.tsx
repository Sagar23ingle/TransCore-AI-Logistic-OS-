import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Search, Mic, MicOff, Truck, Users, Map as MapIcon, X, CornerDownLeft } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type Hit = {
  id: string;
  kind: "vehicle" | "driver" | "trip";
  title: string;
  subtitle?: string;
  to: string;
};

const KIND_META: Record<Hit["kind"], { label: string; Icon: typeof Truck }> = {
  vehicle: { label: "Vehicle", Icon: Truck },
  driver: { label: "Driver", Icon: Users },
  trip: { label: "Trip", Icon: MapIcon },
};

function useDebounced<T>(value: T, delay = 180) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function GlobalSearchBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuth();
  const reduced = useReducedMotion() ?? false;

  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 200);
  const [focused, setFocused] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [listening, setListening] = useState(false);
  const [supportsVoice, setSupportsVoice] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recogRef = useRef<any>(null);

  // Hide on AI screen and unauthenticated
  const hidden =
    !user ||
    pathname === "/ai" ||
    pathname.startsWith("/ai/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/");

  // Voice support detection
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupportsVoice(!!SR);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + K to focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        setFocused(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click-outside dismiss
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Fetch
  useEffect(() => {
    let cancelled = false;
    if (!debounced || !user) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const q = `%${debounced}%`;
      const [v, d, t] = await Promise.all([
        supabase
          .from("vehicles")
          .select("id, registration_number, make, model")
          .ilike("registration_number", q)
          .limit(5),
        supabase.from("drivers").select("id, full_name, phone").ilike("full_name", q).limit(5),
        supabase
          .from("trips")
          .select("id, origin, destination, status")
          .or(`origin.ilike.${q},destination.ilike.${q}`)
          .limit(5),
      ]);
      if (cancelled) return;
      const next: Hit[] = [
        ...(v.data ?? []).map((r: any) => ({
          id: r.id,
          kind: "vehicle" as const,
          title: r.registration_number,
          subtitle: [r.make, r.model].filter(Boolean).join(" "),
          to: "/vehicles",
        })),
        ...(d.data ?? []).map((r: any) => ({
          id: r.id,
          kind: "driver" as const,
          title: r.full_name,
          subtitle: r.phone ?? undefined,
          to: "/drivers",
        })),
        ...(t.data ?? []).map((r: any) => ({
          id: r.id,
          kind: "trip" as const,
          title: `${r.origin} → ${r.destination}`,
          subtitle: r.status,
          to: "/trips",
        })),
      ];
      setHits(next);
      setActive(0);
      setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setHits([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, user]);

  const go = useCallback(
    (hit: Hit) => {
      setFocused(false);
      setQuery("");
      navigate({ to: hit.to });
    },
    [navigate],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (hits[active]) {
        e.preventDefault();
        go(hits[active]);
      }
    }
  }

  function toggleVoice() {
    const SR =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) return;
    if (listening) {
      recogRef.current?.stop?.();
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (ev: any) => {
      let text = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) text += ev.results[i][0].transcript;
      setQuery(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recogRef.current = rec;
    setListening(true);
    setFocused(true);
    inputRef.current?.focus();
    try {
      rec.start();
      if ("vibrate" in navigator) navigator.vibrate?.(6);
    } catch {
      setListening(false);
    }
  }

  const showResults = focused && (query.trim().length > 0);

  const borderStyle = useMemo(
    () =>
      reduced
        ? { background: "linear-gradient(135deg, rgba(56,189,248,0.55), rgba(255,255,255,0.15), rgba(14,165,233,0.55))" }
        : {
            background:
              "conic-gradient(from var(--tc-search-angle,0deg), rgba(56,189,248,0.85), rgba(255,255,255,0.9), rgba(14,165,233,0.85), rgba(56,189,248,0.85))",
            animation: "tc-search-rotate 6s linear infinite",
          },
    [reduced],
  );

  if (hidden) return null;

  return (
    <div
      aria-label="Global search"
      className={cn(
        // fixed above dock; the dock height ~76px + pb -> ~104px reserved
        "pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3 sm:px-4",
        // desktop above dock area (~85px), mobile above the dock (~104px) + safe area
        "bottom-[calc(env(safe-area-inset-bottom,0px)+104px)] lg:bottom-[85px]",
      )}
    >
      <div
        ref={wrapRef}
        className="pointer-events-auto relative w-full max-w-[520px] sm:w-[94%]"
        onMouseMove={(e) => {
          const r = wrapRef.current?.getBoundingClientRect();
          if (!r) return;
          setPointer({ x: e.clientX - r.left, y: e.clientY - r.top });
        }}
        onMouseLeave={() => setPointer(null)}
      >
        {/* Results */}
        <AnimatePresence>
          {showResults && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12, scale: 0.98, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 8, scale: 0.98, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="absolute bottom-[calc(100%+10px)] left-0 right-0 overflow-hidden rounded-[22px] border border-white/10 bg-card/80 backdrop-blur-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.55)]"
              role="listbox"
            >
              <div className="max-h-[52vh] overflow-y-auto tc-scroll">
                {loading && (
                  <div className="px-4 py-3 text-sm text-muted-foreground">Searching…</div>
                )}
                {!loading && hits.length === 0 && (
                  <div className="px-4 py-4 text-sm text-muted-foreground">
                    No matches for “{query.trim()}”.
                  </div>
                )}
                {!loading &&
                  hits.map((h, i) => {
                    const { Icon, label } = KIND_META[h.kind];
                    const isActive = i === active;
                    return (
                      <button
                        key={`${h.kind}-${h.id}`}
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(h)}
                        className={cn(
                          "group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          isActive
                            ? "bg-primary/12 text-foreground"
                            : "text-foreground/90 hover:bg-white/5",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5",
                            isActive && "border-primary/40 bg-primary/15",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{h.title}</span>
                          {h.subtitle && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {h.subtitle}
                            </span>
                          )}
                        </span>
                        <span className="hidden sm:inline text-[10px] uppercase tracking-wide text-muted-foreground">
                          {label}
                        </span>
                        {isActive && (
                          <CornerDownLeft className="h-3.5 w-3.5 text-primary" aria-hidden />
                        )}
                      </button>
                    );
                  })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Animated conic border wrapper */}
        <div
          className="tc-search-border relative rounded-[22px] p-[1.25px]"
          style={borderStyle}
        >
          <div
            className={cn(
              "relative flex h-12 items-center gap-2 rounded-[21px] px-2 sm:h-[52px]",
              "bg-card/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-card/55",
              "shadow-[0_18px_50px_-24px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)]",
              "transition-[box-shadow,background] duration-300",
              focused &&
                "shadow-[0_24px_60px_-24px_rgba(56,189,248,0.55),inset_0_1px_0_rgba(255,255,255,0.10)]",
            )}
          >
            {/* Cursor highlight */}
            {pointer && !reduced && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[21px]"
                style={{
                  background: `radial-gradient(140px 90px at ${pointer.x}px ${pointer.y}px, rgba(125,211,252,0.16), transparent 65%)`,
                }}
              />
            )}

            {/* Left icon */}
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-all duration-300",
                focused && "text-sky-300",
              )}
            >
              <Search
                className={cn(
                  "h-[18px] w-[18px] transition-transform duration-300",
                  focused && "scale-110 rotate-[-6deg] drop-shadow-[0_0_8px_rgba(56,189,248,0.55)]",
                )}
                strokeWidth={2.2}
              />
            </span>

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search trucks, drivers, trips, invoices, AI insights"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onKeyDown={onKeyDown}
              placeholder="Search trucks, drivers, trips, invoices…"
              className={cn(
                "min-w-0 flex-1 bg-transparent text-[15px] font-medium text-foreground",
                "placeholder:text-muted-foreground/70 placeholder:font-normal",
                "outline-none border-0 focus:ring-0 caret-sky-400",
              )}
            />

            {/* Clear */}
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 tc-press"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Voice */}
            {supportsVoice && (
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={listening ? "Stop voice input" : "Start voice input"}
                aria-pressed={listening}
                className={cn(
                  "relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-foreground/80 tc-press",
                  "bg-white/5 backdrop-blur transition-all duration-300",
                  listening
                    ? "tc-mic-listening text-sky-300 border-sky-400/40 bg-sky-400/10"
                    : "hover:text-sky-300 hover:border-sky-400/30 hover:bg-sky-400/10",
                )}
                style={
                  listening
                    ? ({ animation: "tc-mic-ring 1.4s ease-out infinite" } as React.CSSProperties)
                    : undefined
                }
              >
                {listening ? <MicOff className="h-[16px] w-[16px]" /> : <Mic className="h-[16px] w-[16px]" />}
              </button>
            )}

            {/* ⌘K hint */}
            <kbd className="mr-1 hidden select-none items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline-flex">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
