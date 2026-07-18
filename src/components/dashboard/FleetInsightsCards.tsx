import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Info, Lightbulb, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateFleetInsights, type FleetInsight } from "@/lib/fleet-insights.functions";

function toneFor(sev: FleetInsight["severity"]) {
  switch (sev) {
    case "critical":
      return { icon: <AlertTriangle className="h-4 w-4" />, cls: "text-destructive border-destructive/40" };
    case "warning":
      return { icon: <AlertTriangle className="h-4 w-4" />, cls: "text-amber-500 border-amber-500/40" };
    case "opportunity":
      return { icon: <TrendingUp className="h-4 w-4" />, cls: "text-emerald-500 border-emerald-500/40" };
    default:
      return { icon: <Info className="h-4 w-4" />, cls: "text-primary border-primary/40" };
  }
}

export function FleetInsightsCards() {
  const runFn = useServerFn(generateFleetInsights);
  const qc = useQueryClient();

  const q = useQuery(
    queryOptions({
      queryKey: ["fleet-insights"],
      queryFn: () => runFn({ data: {} }),
      staleTime: 30 * 60 * 1000, // 30 min client-side cache mirrors server TTL
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
    }),
  );

  const refresh = useMutation({
    mutationFn: () => runFn({ data: { force: true } }),
    onSuccess: (data) => qc.setQueryData(["fleet-insights"], data),
  });

  const generatedLabel = useMemo(() => {
    if (!q.data?.ok) return null;
    try {
      return new Date(q.data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return null;
    }
  }, [q.data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Fleet Insights
          {generatedLabel && (
            <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
              Updated {generatedLabel}
              {q.data?.ok && q.data.cached ? " · cached" : ""}
            </span>
          )}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending || q.isLoading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? "animate-spin" : ""}`} />
          <span className="ml-1.5 text-xs">Refresh</span>
        </Button>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg border border-border/60 bg-muted/20" />
            ))}
          </div>
        ) : !q.data?.ok ? (
          <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
            <Lightbulb className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="flex-1 text-muted-foreground">
              {q.data?.error ?? q.error?.message ?? "Insights unavailable right now."}
            </div>
            <Button size="sm" variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {q.data.insights.map((ins, i) => {
              const tone = toneFor(ins.severity);
              return (
                <div key={i} className={`rounded-lg border bg-card p-3 ${tone.cls.split(" ").filter((c) => c.startsWith("border")).join(" ")}`}>
                  <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider ${tone.cls.split(" ").filter((c) => c.startsWith("text")).join(" ")}`}>
                    {tone.icon}
                    <span>{ins.severity}</span>
                    <Badge variant="outline" className="ml-auto text-[10px] capitalize">
                      {ins.category}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm font-semibold leading-snug">{ins.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{ins.detail}</div>
                  <div className="mt-2 border-t border-border/50 pt-2 text-xs">
                    <span className="font-medium text-foreground">Action:</span>{" "}
                    <span className="text-muted-foreground">{ins.action}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}