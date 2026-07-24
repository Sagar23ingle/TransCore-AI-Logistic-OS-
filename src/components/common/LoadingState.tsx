import {
  SkeletonList,
  SkeletonCardGrid,
  SkeletonChart,
  SkeletonTable,
  SkeletonForm,
  Skeleton,
} from "@/components/ui/skeleton";

export type LoadingVariant = "list" | "cards" | "chart" | "table" | "form" | "page";

/**
 * Premium neomorphic skeleton loader. Replaces the previous spinner-style
 * indicator so every screen shows a shape-matched placeholder while data
 * is fetching.
 *
 *   <LoadingState />                    // default list skeleton
 *   <LoadingState variant="cards" />    // KPI/card grid
 *   <LoadingState variant="chart" />    // chart placeholder
 *   <LoadingState variant="table" />    // tabular data
 *   <LoadingState variant="form" />     // form fields
 */
export function LoadingState({
  variant = "list",
  rows,
  className,
  // Legacy prop kept for source-compat; not rendered any more.
  label: _label,
}: {
  variant?: LoadingVariant;
  rows?: number;
  className?: string;
  label?: string;
}) {
  const wrap = "tc-fade-in " + (className ?? "");
  switch (variant) {
    case "cards":
      return <SkeletonCardGrid count={rows ?? 4} className={wrap} />;
    case "chart":
      return <SkeletonChart className={wrap} />;
    case "table":
      return <SkeletonTable rows={rows ?? 6} className={wrap} />;
    case "form":
      return <SkeletonForm fields={rows ?? 4} className={wrap} />;
    case "page":
      return (
        <div className={"space-y-4 " + wrap}>
          <Skeleton className="h-24 w-full rounded-2xl" />
          <SkeletonCardGrid count={4} />
          <SkeletonChart />
          <SkeletonList rows={rows ?? 4} />
        </div>
      );
    case "list":
    default:
      return <SkeletonList rows={rows ?? 5} className={wrap} />;
  }
}
