import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Radio } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GoogleMapView } from "@/components/tracking/GoogleMap";
import { getFleetLive } from "@/lib/gps.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tracking/")({
  head: () => ({ meta: [{ title: "Live Tracking — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: TrackingPage,
});

function TrackingPage() {
  const fleetFn = useServerFn(getFleetLive);
  const qc = useQueryClient();
  const q = useQuery(queryOptions({
    queryKey: ["fleet-live"],
    queryFn: () => fleetFn(),
    refetchInterval: 30_000,
  }));
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("gps-pings-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gps_pings" }, () => {
        qc.invalidateQueries({ queryKey: ["fleet-live"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const vehicles = q.data ?? [];
  const markers = useMemo(
    () => vehicles.filter((v) => v.last).map((v) => ({
      id: v.id,
      lat: v.last!.lat,
      lng: v.last!.lng,
      label: v.registration_number as string,
      status: v.liveStatus,
      onClick: () => setSelected(v.id),
    })),
    [vehicles],
  );

  const withPing = vehicles.filter((v) => v.last);
  const noData = !q.isLoading && withPing.length === 0;

  return (
    <AppShell title="Live Tracking" description="Live vehicle positions via Google Maps. Powered by real GPS pings from your driver app or hardware trackers.">
      {q.isLoading ? <LoadingState /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {noData ? (
                <EmptyState
                  icon={<MapPin className="h-6 w-6" />}
                  title="No live positions yet"
                  description="Point your GPS device or the driver PWA at /api/public/gps/ingest (HMAC-signed) or start a trip from the driver's phone to see vehicles here in real time."
                />
              ) : (
                <GoogleMapView markers={markers} className="h-[560px] w-full" zoom={5} />
              )}
            </CardContent>
          </Card>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Radio className="h-3.5 w-3.5" /> {withPing.length} of {vehicles.length} vehicles reporting
            </div>
            {vehicles.map((v) => (
              <Card key={v.id} className={selected === v.id ? "ring-1 ring-primary" : ""}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm">{v.registration_number}</div>
                    <Badge variant={v.liveStatus === "running" ? "default" : v.liveStatus === "idle" ? "secondary" : "outline"}>
                      {v.liveStatus}
                    </Badge>
                  </div>
                  {v.last ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {v.last.speed_kmh != null ? `${Math.round(v.last.speed_kmh)} km/h · ` : ""}
                      {formatDateTime(v.last.recorded_at)} · {v.last.source}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-muted-foreground">No signal yet</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
