import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Severity = "critical" | "warning" | "info" | "success" | string;

const MAP: Record<string, { icon: React.ComponentType<{ className?: string }>; cls: string; label: string }> = {
  critical: {
    icon: ShieldAlert,
    cls: "bg-red-500/10 text-red-600 ring-red-500/25 dark:bg-red-500/15 dark:text-red-400 dark:ring-red-500/30",
    label: "Critical",
  },
  warning: {
    icon: AlertTriangle,
    cls: "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
    label: "Warning",
  },
  info: {
    icon: Info,
    cls: "bg-blue-500/10 text-blue-600 ring-blue-500/25 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30",
    label: "Info",
  },
  success: {
    icon: CheckCircle2,
    cls: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
    label: "Success",
  },
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const key = String(severity ?? "info").toLowerCase();
  const cfg = MAP[key] ?? MAP.info;
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset",
        cfg.cls,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}