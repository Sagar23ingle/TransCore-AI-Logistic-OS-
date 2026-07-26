import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import {
  Truck,
  Users,
  Map as MapIcon,
  Fuel,
  Receipt,
  FileText,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Action = { label: string; href: string; icon: LucideIcon };

const ACTIONS: Action[] = [
  { label: "Add Vehicle", href: "/vehicles", icon: Truck },
  { label: "Add Driver", href: "/drivers", icon: Users },
  { label: "Log Trip", href: "/trips", icon: MapIcon },
  { label: "Fuel Entry", href: "/fuel", icon: Fuel },
  { label: "Expenses", href: "/expenses", icon: Receipt },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "AI Chat", href: "/ai", icon: MessageSquare },
];

function GlassTile({ action, index }: { action: Action; index: number }) {
  const Icon = action.icon;
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.05,
        type: "spring",
        stiffness: 320,
        damping: 22,
      }}
      whileHover={reduce ? undefined : { y: -4, scale: 1.03 }}
      whileTap={reduce ? undefined : { scale: 0.95 }}
      className="group relative"
    >
      <Link
        to={action.href}
        aria-label={action.label}
        className="relative flex min-h-[88px] flex-col items-center justify-center gap-2 overflow-hidden rounded-[20px] border border-white/10 bg-white/5 p-3 text-center backdrop-blur-xl transition-[box-shadow,border-color] duration-300 hover:border-[color:var(--tc-blue,#3B82F6)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tc-blue,#3B82F6)]/60 sm:min-h-[96px] sm:p-4"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px -12px rgba(0,0,0,0.6)",
        }}
      >
        {/* Inner light reflection */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[20px] bg-gradient-to-b from-white/10 to-transparent opacity-70"
        />
        {/* Animated shine */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full group-active:translate-x-full"
        />
        {/* Blue/Cyan glow on hover */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-[20px] opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-70 group-active:opacity-70"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, rgba(59,130,246,0.45), rgba(6,182,212,0.25) 60%, transparent 80%)",
          }}
        />

        {/* Icon puck */}
        <motion.span
          aria-hidden
          whileHover={reduce ? undefined : { scale: 1.15, rotate: 5 }}
          whileTap={reduce ? undefined : { scale: 1.08 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="relative grid h-10 w-10 place-items-center rounded-2xl sm:h-11 sm:w-11"
          style={{
            background:
              "linear-gradient(135deg, rgba(59,130,246,0.35), rgba(6,182,212,0.35))",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -6px 12px rgba(0,0,0,0.25), 0 6px 16px -6px rgba(59,130,246,0.55)",
          }}
        >
          <Icon className="relative h-[18px] w-[18px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] sm:h-5 sm:w-5" />
        </motion.span>

        <span className="relative text-[11px] font-medium leading-tight text-foreground/90 sm:text-xs">
          {action.label}
        </span>
      </Link>
    </motion.div>
  );
}

function GlassQuickActionsImpl() {
  return (
    <Card className="border-border/60">
      <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-3">
        <CardTitle className="text-sm sm:text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 p-3 pt-0 sm:grid-cols-3 sm:gap-3 sm:p-6 sm:pt-0 lg:grid-cols-4">
        {ACTIONS.map((a, i) => (
          <GlassTile key={a.label} action={a} index={i} />
        ))}
      </CardContent>
    </Card>
  );
}

export const GlassQuickActions = memo(GlassQuickActionsImpl);
export default GlassQuickActions;