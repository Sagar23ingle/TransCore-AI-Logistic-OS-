import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy, RefreshCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { listDriverScores, recomputeDriverScores } from "@/lib/driver-scores.functions";
import { formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/drivers-scoreboard/")({
  head: () => ({ meta: [{ title: "Driver Scores — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: ScoreboardPage,
});

function ScoreboardPage() {
  const listFn = useServerFn(listDriverScores);
  const recomputeFn = useServerFn(recomputeDriverScores);
  const qc = useQueryClient();
  const q = useQuery(queryOptions({ queryKey: ["driver-scores"], queryFn: () => listFn() }));

  useEffect(() => {
    recomputeFn().then(() => qc.invalidateQueries({ queryKey: ["driver-scores"] })).catch(() => {});
  }, [recomputeFn, qc]);

  function color(s: number) { return s >= 80 ? "text-accent" : s >= 60 ? "text-yellow-500" : "text-destructive"; }

  return (
    <AppShell title="Driver Scoreboard" description="Safety + performance score for every driver over the last 90 days — computed from real trips and GPS telemetry."
      action={<Button variant="outline" size="sm" onClick={() => recomputeFn().then(() => qc.invalidateQueries({ queryKey: ["driver-scores"] }))}><RefreshCcw className="mr-2 h-3.5 w-3.5" /> Recompute</Button>}>
      {q.isLoading ? <LoadingState /> : !q.data || q.data.length === 0 ? (
        <EmptyState icon={<Trophy className="h-6 w-6" />} title="No driver scores yet"
          description="Add drivers, assign trips, and complete them to build up scoring data." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((s, i) => (
            <Card key={s.id}>
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">#{i + 1}</span>
                    <span className="font-semibold">{s.driver?.full_name ?? "—"}</span>
                  </div>
                  <span className={`num text-2xl font-semibold ${color(Number(s.overall_score))}`}>{Math.round(Number(s.overall_score))}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div><div className="text-[10px] uppercase">Safety</div><span className={`num text-sm ${color(Number(s.safety_score))}`}>{Math.round(Number(s.safety_score))}</span></div>
                  <div><div className="text-[10px] uppercase">Performance</div><span className={`num text-sm ${color(Number(s.performance_score))}`}>{Math.round(Number(s.performance_score))}</span></div>
                  <div><div className="text-[10px] uppercase">Trips</div><span className="num text-sm text-foreground">{s.trips_completed}</span></div>
                </div>
                <div className="flex flex-wrap gap-1 pt-2 text-[10px]">
                  <Badge variant="outline">{formatNumber(Number(s.distance_km))} km</Badge>
                  {s.speed_violations > 0 && <Badge variant="outline">{s.speed_violations} speed alerts</Badge>}
                  {s.trips_delayed > 0 && <Badge variant="outline">{s.trips_delayed} delayed</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}