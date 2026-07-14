import { useEffect, useRef, useState } from "react";

type MarkerData = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  status?: "running" | "idle" | "offline";
  onClick?: () => void;
};

type Polyline = { path: Array<{ lat: number; lng: number }>; color?: string };
type Circle = { center: { lat: number; lng: number }; radius: number; color?: string };

interface Props {
  markers?: MarkerData[];
  polylines?: Polyline[];
  circles?: Circle[];
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
}

declare global {
  interface Window {
    google?: typeof google;
    __transcoreMapReady?: boolean;
    __transcoreMapCallbacks?: Array<() => void>;
  }
}

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.__transcoreMapReady) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.__transcoreMapCallbacks = window.__transcoreMapCallbacks ?? [];
    window.__transcoreMapCallbacks.push(resolve);
    if (document.querySelector('script[data-transcore-gmaps]')) return;
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) return reject(new Error("Google Maps key not configured"));
    (window as unknown as { __transcoreInitMap: () => void }).__transcoreInitMap = () => {
      window.__transcoreMapReady = true;
      (window.__transcoreMapCallbacks ?? []).forEach((cb) => cb());
      window.__transcoreMapCallbacks = [];
    };
    const s = document.createElement("script");
    s.dataset.transcoreGmaps = "1";
    s.async = true; s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=__transcoreInitMap${channel ? `&channel=${encodeURIComponent(channel)}` : ""}`;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
}

const STATUS_COLOR: Record<NonNullable<MarkerData["status"]>, string> = {
  running: "#10B981",
  idle: "#F59E0B",
  offline: "#6B7280",
};

export function GoogleMapView({ markers = [], polylines = [], circles = [], center, zoom = 5, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<Array<google.maps.Marker | google.maps.Polyline | google.maps.Circle>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        const initialCenter = center ?? (markers[0] ? { lat: markers[0].lat, lng: markers[0].lng } : { lat: 20.5937, lng: 78.9629 });
        mapRef.current = new window.google.maps.Map(containerRef.current, {
          center: initialCenter,
          zoom,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#111827" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#111827" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#9CA3AF" }] },
            { featureType: "water", stylers: [{ color: "#0B1220" }] },
            { featureType: "road", stylers: [{ color: "#1F2937" }] },
            { featureType: "poi", stylers: [{ visibility: "off" }] },
          ],
        });
      })
      .catch((e: Error) => setError(e.message));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    for (const o of overlaysRef.current) o.setMap(null);
    overlaysRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    let hasBounds = false;

    for (const m of markers) {
      const marker = new window.google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map,
        title: m.label,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: m.status ? STATUS_COLOR[m.status] : "#22D3EE",
          fillOpacity: 1, strokeColor: "#0B1220", strokeWeight: 2, scale: 8,
        },
      });
      if (m.onClick) marker.addListener("click", m.onClick);
      overlaysRef.current.push(marker);
      bounds.extend({ lat: m.lat, lng: m.lng }); hasBounds = true;
    }
    for (const p of polylines) {
      if (p.path.length < 2) continue;
      const line = new window.google.maps.Polyline({
        path: p.path, map, geodesic: true,
        strokeColor: p.color ?? "#22D3EE", strokeOpacity: 0.9, strokeWeight: 3,
      });
      overlaysRef.current.push(line);
      for (const pt of p.path) { bounds.extend(pt); hasBounds = true; }
    }
    for (const c of circles) {
      const circle = new window.google.maps.Circle({
        map, center: c.center, radius: c.radius,
        strokeColor: c.color ?? "#22D3EE", strokeOpacity: 0.6, strokeWeight: 2,
        fillColor: c.color ?? "#22D3EE", fillOpacity: 0.15,
      });
      overlaysRef.current.push(circle);
      const cb = circle.getBounds();
      if (cb) { bounds.union(cb); hasBounds = true; }
    }
    if (hasBounds && (markers.length + polylines.length + circles.length) > 1) map.fitBounds(bounds, 60);
  }, [markers, polylines, circles]);

  if (error) {
    return <div className={className}><div className="flex h-full items-center justify-center text-sm text-destructive">{error}</div></div>;
  }
  return <div ref={containerRef} className={className} style={{ minHeight: 400 }} />;
}