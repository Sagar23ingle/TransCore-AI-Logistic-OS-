import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { ChevronRight, TrendingUp } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GoogleMapView } from "@/components/tracking/GoogleMap";
import { getFleetLive } from "@/lib/gps.functions";
import { useTheme } from "@/hooks/use-theme";
import { formatINR } from "@/lib/format";
import type { DailyOps } from "@/lib/daily-ops.functions";

function EmptyChart({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/10 text-center">
      <div className="text-sm font-medium text-foreground">{message}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function FleetOverview({ daily, loading }: { daily?: DailyOps; loading: boolean }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const axis = isDark ? "hsl(215 20% 65%)" : "hsl(220 9% 46%)";
  const grid = isDark ? "hsl(215 27% 32% / 0.35)" : "hsl(220 13% 91%)";
  const revColor = isDark ? "#60a5fa" : "#2563eb";
  const fuelColor = isDark ? "#f59e0b" : "#d97706";
  const data = useMemo(
    () => (daily?.trend ?? []).map((r) => ({ ...r, label: r.date.slice(5) })),
    [daily],
  );
  const hasData = data.some((d) => d.revenue > 0 || d.fuel > 0 || d.trips > 0);
  const fleetLiveFn = useServerFn(getFleetLive);
  const live = useQuery(queryOptions({
    queryKey: ["fleet-live-dashboard"],
    queryFn: () => fleetLiveFn(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  }));
  const markers = useMemo(
    () => (live.data ?? [])
      .filter((v) => v.last)
      .map((v) => ({
        id: v.id,
        lat: v.last!.lat,
        lng: v.last!.lng,
        label: v.registration_number as string,
        status: v.liveStatus,
      })),
    [live.data],
  );
  const reporting = markers.length;
  const totalV = live.data?.length ?? 0;

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 sm:p-6 sm:pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> Fleet Overview
          </CardTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Revenue &amp; fuel trend · live vehicle map</p>
        </div>
        <Badge variant="outline" className="text-[10px]">30D</Badge>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
        <Tabs defaultValue="trend" className="w-full">
          <TabsList className="h-8 w-full grid-cols-2 sm:w-auto sm:inline-grid">
            <TabsTrigger value="trend" className="text-xs">Trend</TabsTrigger>
            <TabsTrigger value="map" className="text-xs">
              Live Map
              {totalV > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                  {reporting}/{totalV}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trend" className="mt-2 h-36 sm:h-72">
            {loading ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : !hasData ? (
              <EmptyChart message="No Data Available" hint="Log trips and fuel to see trends here." />
            ) : (
              <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 via-background to-background p-1 pb-2 shadow-inner">
                <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 14, right: 14, left: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id="ov-rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={revColor} stopOpacity={0.55} />
                        <stop offset="100%" stopColor={revColor} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="ov-fuel" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={fuelColor} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={fuelColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke={grid} vertical={false} />
                    <XAxis
                      dataKey="label" stroke={axis} fontSize={11}
                      interval={Math.max(0, Math.floor(data.length / 6) - 1)}
                      tickLine={false} axisLine={false} tickMargin={8}
                    />
                    <YAxis
                      stroke={axis} fontSize={11} tickLine={false} axisLine={false} width={40}
                      tickFormatter={(v: number) => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v/1000)}k` : String(v)}
                    />
                    <Tooltip
                      cursor={{ stroke: revColor, strokeOpacity: 0.35, strokeWidth: 1, strokeDasharray: "3 3" }}
                      contentStyle={{
                        background: isDark ? "rgba(15,15,20,0.92)" : "rgba(255,255,255,0.98)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 12,
                        padding: "8px 10px",
                        boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.08)",
                      }}
                      labelStyle={{ color: axis, fontSize: 11, marginBottom: 4, fontWeight: 500 }}
                      formatter={(v: number, name: string) => [name === "trips" ? v : formatINR(v), name === "revenue" ? "Revenue" : name === "fuel" ? "Fuel" : name]}
                    />
                    <Area
                      type="monotone" dataKey="revenue" stroke={revColor} strokeWidth={2.5}
                      fill="url(#ov-rev)" fillOpacity={1}
                      dot={{ r: 2.5, fill: revColor, stroke: isDark ? "#0b0b0f" : "#fff", strokeWidth: 1.5 }}
                      activeDot={{ r: 5, fill: revColor, stroke: isDark ? "#0b0b0f" : "#fff", strokeWidth: 2 }}
                      animationDuration={800}
                    />
                    <Area
                      type="monotone" dataKey="fuel" stroke={fuelColor} strokeWidth={2.5}
                      fill="url(#ov-fuel)" fillOpacity={1}
                      dot={{ r: 2.5, fill: fuelColor, stroke: isDark ? "#0b0b0f" : "#fff", strokeWidth: 1.5 }}
                      activeDot={{ r: 5, fill: fuelColor, stroke: isDark ? "#0b0b0f" : "#fff", strokeWidth: 2 }}
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                </div>
                <div className="mt-1.5 flex items-center justify-center gap-6 px-2 pb-1 text-[11px] font-medium text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full ring-2 ring-background" style={{ background: revColor }} /> Revenue</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full ring-2 ring-background" style={{ background: fuelColor }} /> Fuel</span>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="map" className="mt-2">
            {live.isLoading ? (
              <Skeleton className="h-36 w-full rounded-lg sm:h-72" />
            ) : markers.length === 0 ? (
              <div className="h-36 sm:h-72">
                <EmptyChart
                  message="No live vehicle positions"
                  hint="Start the driver GPS broadcast from Live Tracking to see vehicles here."
                />
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border/60">
                <GoogleMapView markers={markers} className="h-36 w-full sm:h-72" zoom={5} />
              </div>
            )}
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{reporting} of {totalV} vehicle{totalV === 1 ? "" : "s"} reporting</span>
              <Link to="/tracking" className="font-medium text-primary hover:underline">
                Open live tracking <ChevronRight className="ml-0.5 inline h-3 w-3" />
              </Link>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default FleetOverview;