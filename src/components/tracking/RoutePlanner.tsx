import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fuel, Leaf, Loader2, Route as RouteIcon, TicketX, Timer, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { GoogleMapView } from "@/components/tracking/GoogleMap";
import { planRoute } from "@/lib/routes.functions";
import { decodePolyline } from "@/lib/polyline";
import { formatINR } from "@/lib/format";

const COLORS = { fastest: "#22D3EE", fuel_efficient: "#E6FF2B" } as const;

export function RoutePlanner() {
  const planFn = useServerFn(planRoute);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [active, setActive] = useState<"fastest" | "fuel_efficient" | "both">("both");

  const plan = useMutation({
    mutationFn: (vars: { origin: string; destination: string; avoid_tolls: boolean }) =>
      planFn({ data: vars }),
  });

  const data = plan.data;

  const polylines = useMemo(() => {
    if (!data) return [];
    return data.routes
      .filter((r) => active === "both" || r.kind === active)
      .map((r) => ({
        path: decodePolyline(r.encoded_polyline),
        color: COLORS[r.kind],
        dashed: r.kind === "fuel_efficient",
        weight: 4,
      }));
  }, [data, active]);

  const markers = useMemo(() => {
    if (!data) return [];
    return [
      { id: "o", lat: data.origin.lat, lng: data.origin.lng, label: data.origin.address, status: "running" as const },
      { id: "d", lat: data.destination.lat, lng: data.destination.lng, label: data.destination.address, status: "idle" as const },
    ];
  }, [data]);

  const savings = useMemo(() => {
    if (!data) return null;
    const fast = data.routes.find((r) => r.kind === "fastest");
    const eco = data.routes.find((r) => r.kind === "fuel_efficient");
    if (!fast || !eco || fast.total_cost == null || eco.total_cost == null) return null;
    const diff = fast.total_cost - eco.total_cost;
    return diff > 0 ? diff : null;
  }, [data]);

  const submit = () => {
    if (origin.trim().length < 2 || destination.trim().length < 2) return;
    plan.mutate({ origin: origin.trim(), destination: destination.trim(), avoid_tolls: avoidTolls });
  };

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <RouteIcon className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">Smart route planner</div>
          <Badge variant="outline" className="ml-auto text-[10px]">Tolls · Fuel cost</Badge>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="rp-origin" className="text-xs">From</Label>
            <Input
              id="rp-origin" value={origin} onChange={(e) => setOrigin(e.target.value)}
              placeholder="Delhi" autoComplete="off" className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rp-dest" className="text-xs">To</Label>
            <Input
              id="rp-dest" value={destination} onChange={(e) => setDestination(e.target.value)}
              placeholder="Mumbai" autoComplete="off" className="h-10 rounded-xl"
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button" size="sm"
            variant={avoidTolls ? "default" : "outline"}
            className="tc-press h-9 rounded-full text-xs"
            onClick={() => setAvoidTolls((v) => !v)}
          >
            <TicketX className="mr-1.5 h-3.5 w-3.5" /> Avoid tolls
          </Button>
          <Button
            type="button" size="sm" className="tc-press ml-auto h-9 rounded-full px-4 text-xs"
            onClick={submit}
            disabled={plan.isPending || origin.trim().length < 2 || destination.trim().length < 2}
          >
            {plan.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Plan route
          </Button>
        </div>

        {plan.isError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {(plan.error as Error).message}
          </div>
        )}

        {data && (
          <>
            <div className="overflow-hidden rounded-xl border border-border/60">
              <GoogleMapView markers={markers} polylines={polylines} className="h-56 w-full sm:h-80" zoom={6} />
            </div>

            {savings != null && (
              <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 p-2.5 text-xs">
                <Leaf className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  The fuel-saving route costs <b>{formatINR(savings)}</b> less than the fastest route
                  (fuel + tolls) for this trip.
                </span>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {data.routes.map((r) => (
                <button
                  key={r.kind}
                  type="button"
                  onClick={() => setActive(active === r.kind ? "both" : r.kind)}
                  className={`tc-press rounded-xl border p-3 text-left transition ${
                    active === r.kind ? "border-primary ring-1 ring-primary/40" : "border-border/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[r.kind] }} />
                    <span className="text-sm font-semibold">
                      {r.kind === "fastest" ? "Fastest route" : "Fuel-saving route"}
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><RouteIcon className="h-3 w-3" />{r.distance_km} km</span>
                    <span className="flex items-center gap-1"><Timer className="h-3 w-3" />
                      {Math.floor(r.duration_min / 60)}h {r.duration_min % 60}m
                    </span>
                    <span className="flex items-center gap-1">
                      <Wallet className="h-3 w-3" />
                      {r.toll_amount != null
                        ? `Toll ${formatINR(r.toll_amount)}`
                        : r.has_tolls ? "Toll: price N/A" : "No toll gates"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Fuel className="h-3 w-3" />
                      {r.fuel_cost != null ? formatINR(r.fuel_cost) : "Fuel: add logs"}
                    </span>
                  </div>
                  {r.total_cost != null && (
                    <div className="mt-1.5 text-xs font-semibold">Est. total {formatINR(r.total_cost)}</div>
                  )}
                </button>
              ))}
            </div>

            <div className="text-[10px] text-muted-foreground">
              {data.basis.kmpl && data.basis.price_per_litre
                ? `Fuel cost from your own logs: ${data.basis.kmpl} km/l at ${formatINR(data.basis.price_per_litre)}/l.`
                : "Add full-tank fuel logs (at least 2) to get fuel-cost estimates from your real mileage."}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}