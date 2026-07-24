import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Premium neomorphic skeleton with a smooth left-to-right shimmer.
 * Colors, gradient, and shimmer highlight come from theme tokens defined
 * in styles.css (.tc-skeleton), so it automatically matches light/dark mode.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("tc-skeleton rounded-xl", className)}
      {...props}
    />
  );
}

/* -------- Primitive shapes -------- */

function SkeletonText({
  lines = 3,
  className,
  lastWidth = "60%",
}: {
  lines?: number;
  className?: string;
  lastWidth?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={i === lines - 1 ? { width: lastWidth } : undefined}
        />
      ))}
    </div>
  );
}

function SkeletonCircle({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Skeleton
      className={cn("rounded-full", className)}
      style={{ width: size, height: size }}
    />
  );
}

function SkeletonButton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-10 w-24 rounded-full", className)} />;
}

function SkeletonImage({ className }: { className?: string }) {
  return <Skeleton className={cn("aspect-video w-full rounded-2xl", className)} />;
}

/* -------- Composite blocks -------- */

function SkeletonRow({ withAvatar = true }: { withAvatar?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/50 p-3 shadow-[var(--shadow-neo-sm)]">
      {withAvatar && <SkeletonCircle size={40} />}
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      <Skeleton className="h-6 w-14 rounded-full" />
    </div>
  );
}

function SkeletonList({ rows = 5, withAvatar = true, className }: { rows?: number; withAvatar?: boolean; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} withAvatar={withAvatar} />
      ))}
    </div>
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-2xl border border-border/50 bg-card/50 p-4 shadow-[var(--shadow-neo-sm)]", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <SkeletonCircle size={32} className="rounded-xl" />
      </div>
      <Skeleton className="h-7 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

function SkeletonCardGrid({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

function SkeletonChart({ className, height = 240 }: { className?: string; height?: number }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-4 shadow-[var(--shadow-neo-sm)]",
        className,
      )}
      style={{ height }}
    >
      {/* Y-axis */}
      <div className="absolute inset-y-6 left-3 flex flex-col justify-between">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-2 w-6" />
        ))}
      </div>
      {/* Fake curve area */}
      <div className="absolute inset-6 left-12 rounded-lg overflow-hidden">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id="tc-skel-curve" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,30 C15,18 25,28 40,20 C55,12 65,26 80,18 L100,22 L100,40 L0,40 Z"
            fill="url(#tc-skel-curve)"
            className="text-muted-foreground"
          />
          <path
            d="M0,30 C15,18 25,28 40,20 C55,12 65,26 80,18 L100,22"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="0.8"
            className="text-muted-foreground tc-skeleton-stroke"
          />
        </svg>
      </div>
      {/* X-axis */}
      <div className="absolute bottom-2 left-12 right-4 flex justify-between">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-2 w-6" />
        ))}
      </div>
    </div>
  );
}

function SkeletonTable({ rows = 6, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border/50 bg-card/50 shadow-[var(--shadow-neo-sm)]", className)}>
      <div className="grid gap-3 border-b border-border/50 p-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-3/4" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3 border-b border-border/40 p-3 last:border-b-0" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-4" style={{ width: `${60 + ((r + c) * 7) % 35}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SkeletonForm({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <SkeletonButton />
        <SkeletonButton className="w-32" />
      </div>
    </div>
  );
}

export {
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  SkeletonButton,
  SkeletonImage,
  SkeletonRow,
  SkeletonList,
  SkeletonCard,
  SkeletonCardGrid,
  SkeletonChart,
  SkeletonTable,
  SkeletonForm,
};
