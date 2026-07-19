import { useMemo } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Fuel, AlertTriangle, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { getVehicleFuelLevels, type VehicleFuelLevel } from "@/lib/fuel-level.functions";

function stopsFor(pct: number) {
  // Smooth green → yellow → orange → red gradient anchored on the current pct.
  if (pct >= 75) return { from: "#22c55e", to: "#16a34a", ring: "text-emerald-500", tone: "healthy" as const };
  if (pct >= 50) return { from: "#84cc16", to: "#eab308", ring: "text-lime-500", tone: "healthy" as const };
  if (pct >= 30) return { from: "#facc15", to: "#f59e0b", ring: "text-amber-500", tone: "warn" as const };
  if (pct > 20)  return { from: "#fb923c", to: "#f97316", ring: "text-orange-500", tone: "warn" as const };
  if (pct > 10)  return { from: "#f97316", to: "#ef4444", ring: "text-orange-600", tone: "low" as const };
  return { from: "#ef4444", to: "#b91c1c", ring: "text-red-600", tone: "critical" as const };
}

function Gauge({ v }: { v: VehicleFuelLevel }) {
  const pct = Math.max(0, Math.min(100, v.pct));
  const stops = stopsFor(pct);
  const size = 128;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const gid = `fg-${v.vehicle_id}`;
  const flashing = v.reason === "computed" && pct <= 10;
  const insufficient = v.reason === "insufficient_data";

  return (
    <Card
      className={`relative h-full overflow-hidden rounded-2xl border-border/60 ${
        flashing ? "animate-pulse ring-2 ring-red-500/60" : ""
      }`}
    >
      <CardContent className="flex flex-col items-center gap-2 p-3 sm:p-4">
        <div className="flex w-full items-center justify-between">
          <span className="truncate text-[11px] font-semibold tracking-wide text-foreground/90">
            {v.registration_number}
          </span>
          {v.severity === "critical" && !insufficient && (
            <Badge variant="destructive" className="h-4 px-1.5 py-0 text-[9px]">
              <AlertTriangle className="mr-0.5 h-2.5 w-2.5" /> CRITICAL
            </Badge>
          )}
          {v.severity === "low" && !insufficient && (
            <Badge className="h-4 border-transparent bg-orange-500/15 px-1.5 py-0 text-[9px] text-orange-600 dark:text-orange-400">
              LOW
            </Badge>
          )}
        </div>

        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={stops.from} />
                <stop offset="100%" stopColor={stops.to} />
              </linearGradient>
            </defs>
            <circle
              cx={size / 2} cy={size / 2} r={r}
              stroke="currentColor"
              className="text-muted-foreground/15"
              strokeWidth={stroke}
              fill="none"
            />
            <motion.circle
              cx={size / 2} cy={size / 2} r={r}
              stroke={`url(#${gid})`}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={c}
              initial={{ strokeDashoffset: c }}
              animate={{ strokeDashoffset: c - dash }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <Fuel className={`h-3 w-3 ${stops.ring}`} />
            {insufficient ? (
              <>
                <div className="num text-[15px] font-bold leading-tight tracking-tight text-muted-foreground">—</div>
                <div className="text-[8px] uppercase tracking-wider text-muted-foreground">no data</div>
              </>
            ) : (
              <>
                <div className={`num text-[22px] font-bold leading-tight tracking-tight ${stops.ring}`}>
                  {pct}%
                </div>
                <div className="text-[8px] uppercase tracking-wider text-muted-foreground">fuel level</div>
              </>
            )}
          </div>
        </div>

        <div className="w-full text-center">
          {insufficient ? (
            <Button asChild size="sm" variant="outline" className="h-7 w-full text-[10px]">
              <Link to="/fuel"><Plus className="mr-1 h-3 w-3" /> Log Fuel</Link>
            </Button>
          ) : (
            <>
              <div className="num text-[12px] font-semibold text-foreground/90">
                {v.litres_remaining.toFixed(0)} L · {v.range_km.toLocaleString("en-IN")} km
              </div>
              <div className="text-[10px] text-muted-foreground">
                Tank {v.tank_litres}L · {v.kmpl > 0 ? `${v.kmpl} km/L` : "—"}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function FuelLevelGauges() {
  const fn = useServerFn(getVehicleFuelLevels);
  const q = useQuery(
    queryOptions({
      queryKey: ["vehicle-fuel-levels"],
      queryFn: () => fn(),
      staleTime: 60_000,
      refetchInterval: 5 * 60_000,
    }),
  );

  const items = useMemo(() => {
    const arr = q.data ?? [];
    // Surface critical → low → the rest first so the important cards lead.
    return [...arr].sort((a, b) => {
      const rank = (s: string) => (s === "critical" ? 0 : s === "low" ? 1 : 2);
      return rank(a.severity) - rank(b.severity);
    });
  }, [q.data]);

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 sm:p-6 sm:pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Fuel className="h-4 w-4 text-primary" /> Fuel Level
          </CardTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
            Live per-vehicle tank level from fuel logs &amp; odometer
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">Real-time</Badge>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
        {q.isLoading ? (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 py-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-40 shrink-0 rounded-2xl sm:h-56 sm:w-auto" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
            Add a vehicle to start tracking fuel level.
          </div>
        ) : items.every((v) => v.reason === "insufficient_data") ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 p-6 text-center">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
              <Fuel className="h-5 w-5" />
            </div>
            <div className="max-w-sm text-xs text-muted-foreground">
              Record one <span className="font-medium text-foreground">Full Tank</span> fuel entry and complete at least one trip to calculate fuel level.
            </div>
            <Button asChild size="sm" className="h-8">
              <Link to="/fuel"><Plus className="mr-1 h-3.5 w-3.5" /> Log Fuel</Link>
            </Button>
          </div>
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 sm:py-0 lg:grid-cols-4">
            {items.map((v) => (
              <div key={v.vehicle_id} className="w-40 shrink-0 snap-start sm:w-auto">
                <Gauge v={v} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}