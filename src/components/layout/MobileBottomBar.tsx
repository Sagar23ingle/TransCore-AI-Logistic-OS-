import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Truck, Map, Bell, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";

type DockItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  featured?: boolean;
};

const ITEMS: DockItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/vehicles", label: "Fleet", icon: Truck },
  { to: "/ai", label: "AI", icon: Sparkles, featured: true },
  { to: "/trips", label: "Trips", icon: Map },
  { to: "/alerts", label: "Alerts", icon: Bell },
];

const BASE = 44;
const MAX = 68;
const RANGE = 130;

function useIsTouch() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setTouch(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return touch;
}

function DockIcon({
  item,
  active,
  mouseX,
  isTouch,
  pressed,
  onPressStart,
  onPressEnd,
  reduced,
}: {
  item: DockItem;
  active: boolean;
  mouseX: MotionValue<number>;
  isTouch: boolean;
  pressed: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
  reduced: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);

  const distance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: BASE };
    return val - rect.x - rect.width / 2;
  });
  const sizeTarget = useTransform(distance, [-RANGE, 0, RANGE], [BASE, MAX, BASE]);
  const size = useSpring(sizeTarget, { mass: 0.1, stiffness: 170, damping: 14 });

  const [showLabel, setShowLabel] = useState(false);
  useEffect(() => {
    if (isTouch) return;
    const unsub = size.on("change", (v) => setShowLabel(v > BASE + 8));
    return () => unsub();
  }, [size, isTouch]);

  const finalSize = reduced ? BASE : isTouch ? (pressed ? MAX : BASE) : undefined;
  const style = finalSize != null ? { width: finalSize, height: finalSize } : { width: size, height: size };
  const labelVisible = isTouch ? pressed : showLabel;

  const Icon = item.icon;
  const aiActive = active && item.featured;

  const handlePointerDown = () => {
    if (!isTouch) return;
    onPressStart();
    if ("vibrate" in navigator) {
      try { navigator.vibrate?.(8); } catch { /* noop */ }
    }
  };

  return (
    <li ref={ref} className="relative flex items-end justify-center">
      <motion.div
        className="pointer-events-none absolute -top-9 select-none rounded-full border border-border/60 bg-card/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-[var(--shadow-neo)] backdrop-blur"
        initial={false}
        animate={{
          opacity: labelVisible ? 1 : 0,
          y: labelVisible ? 0 : 6,
          scale: labelVisible ? 1 : 0.9,
        }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
      >
        {item.label}
      </motion.div>
      <Link
        to={item.to}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        onPointerDown={handlePointerDown}
        onPointerUp={onPressEnd}
        onPointerLeave={onPressEnd}
        onPointerCancel={onPressEnd}
        onContextMenu={(e) => { if (isTouch) e.preventDefault(); }}
        onFocus={() => setShowLabel(true)}
        onBlur={() => setShowLabel(false)}
        className="grid place-items-center outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
        style={{ willChange: "transform" }}
      >
        <motion.span
          style={{ ...style, translateZ: 0 }}
          className={cn(
            "relative grid place-items-center rounded-full transition-colors",
            "min-h-[48px] min-w-[48px]",
            item.featured
              ? "bg-gradient-primary text-primary-foreground shadow-[var(--glow-primary)]"
              : active
                ? "bg-primary/15 text-primary shadow-[0_0_16px_-2px_var(--color-primary)]"
                : "text-muted-foreground",
          )}
        >
          {item.featured && (
            <>
              <span className="pointer-events-none absolute inset-0 rounded-full bg-primary/25 opacity-70 [animation:tc-breathe_2.4s_ease-in-out_infinite]" />
              <span className="pointer-events-none absolute inset-0 rounded-full bg-primary/20 opacity-60 [animation:tc-breathe_2.4s_ease-in-out_infinite] [animation-delay:0.9s]" />
            </>
          )}
          <Icon
            className={cn(item.featured ? "h-6 w-6" : "h-[22px] w-[22px]", "relative")}
            strokeWidth={active || item.featured ? 2.25 : 1.75}
          />
          {aiActive && <span className="sr-only">Active</span>}
        </motion.span>
      </Link>
    </li>
  );
}

export function MobileBottomBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);
  const isTouch = useIsTouch();
  const reduced = useReducedMotion() ?? false;
  const [pressedTo, setPressedTo] = useState<string | null>(null);

  // Hide the bottom dashbar on the AI Assistant screen so the chat surface
  // owns the full viewport and the composer sits flush to the bottom.
  if (pathname === "/ai" || pathname.startsWith("/ai/")) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 lg:hidden"
    >
      <motion.ul
        role="toolbar"
        onMouseMove={(e) => { if (!isTouch) mouseX.set(e.clientX); }}
        onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
        animate={{ paddingLeft: isTouch && pressedTo ? 14 : 10, paddingRight: isTouch && pressedTo ? 14 : 10 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative mx-auto flex h-[76px] w-fit max-w-[95vw] items-end justify-center gap-2 rounded-[24px] border border-border/60 bg-card/70 px-2.5 pb-2 pt-2 shadow-[var(--shadow-neo)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/60"
        style={{ willChange: "transform" }}
      >
        {ITEMS.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <DockIcon
              key={item.to}
              item={item}
              active={active}
              mouseX={mouseX}
              isTouch={isTouch}
              reduced={reduced}
              pressed={pressedTo === item.to}
              onPressStart={() => setPressedTo(item.to)}
              onPressEnd={() => setPressedTo((p) => (p === item.to ? null : p))}
            />
          );
        })}
      </motion.ul>
      <style>{`
        @keyframes tc-breathe { 0%,100% { transform: scale(1); opacity: 0.55 } 50% { transform: scale(1.28); opacity: 0 } }
      `}</style>
    </nav>
  );
}