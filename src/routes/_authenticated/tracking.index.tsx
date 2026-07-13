import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/common/EmptyState";

export const Route = createFileRoute("/_authenticated/tracking/")({
  head: () => ({ meta: [{ title: "Live Tracking — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: TrackingPage,
});

function TrackingPage() {
  return (
    <AppShell title="Live Tracking" description="Real-time vehicle positions from browser GPS, Traccar, Teltonika or MapMyIndia feeds.">
      <EmptyState
        icon={<MapPin className="h-6 w-6" />}
        title="Live map — activating soon"
        description="Real GPS ingestion (Traccar / Teltonika / MapMyIndia) and browser Geolocation for driver phones ship in the next phase. Only real coordinates will ever appear here — never simulated movement."
      />
    </AppShell>
  );
}
