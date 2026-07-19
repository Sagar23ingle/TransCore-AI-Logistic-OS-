import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LiveLocation = {
  user_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  heading: number | null;
  accuracy_m: number | null;
  updated_at: string;
};

// Consider a driver "live" if seen in the last 2 minutes.
const STALE_MS = 2 * 60 * 1000;

/**
 * Subscribes to the `live_locations` table via Supabase Realtime and returns
 * the current map of user_id -> latest position. No polling; the map updates
 * itself as INSERT/UPDATE events arrive.
 */
export function useLiveLocations() {
  const [byUser, setByUser] = useState<Record<string, LiveLocation>>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Initial hydrate.
    supabase
      .from("live_locations")
      .select("*")
      .gte("updated_at", new Date(Date.now() - STALE_MS).toISOString())
      .then(({ data }) => {
        if (!mounted || !data) return;
        const map: Record<string, LiveLocation> = {};
        for (const row of data as LiveLocation[]) map[row.user_id] = row;
        setByUser(map);
      });

    const channel = supabase
      .channel("live-locations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_locations" },
        (payload) => {
          if (!mounted) return;
          setByUser((prev) => {
            const next = { ...prev };
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as Partial<LiveLocation>;
              if (oldRow.user_id) delete next[oldRow.user_id];
              return next;
            }
            const row = payload.new as LiveLocation;
            if (row?.user_id) next[row.user_id] = row;
            return next;
          });
        },
      )
      .subscribe((status) => {
        if (mounted) setConnected(status === "SUBSCRIBED");
      });

    // Drop stale rows every 30s so offline drivers vanish from the map.
    const gc = window.setInterval(() => {
      if (!mounted) return;
      const cutoff = Date.now() - STALE_MS;
      setByUser((prev) => {
        let changed = false;
        const next: Record<string, LiveLocation> = {};
        for (const [id, row] of Object.entries(prev)) {
          if (new Date(row.updated_at).getTime() >= cutoff) next[id] = row;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 30_000);

    return () => {
      mounted = false;
      window.clearInterval(gc);
      supabase.removeChannel(channel);
    };
  }, []);

  return { locations: Object.values(byUser), connected };
}

type BroadcastState = {
  active: boolean;
  lastSentAt: number | null;
  error: string | null;
};

/**
 * Streams the current user's GPS position into `live_locations` every ~30s
 * while `active` is true. Requires the browser Geolocation permission.
 */
export function useBroadcastLocation() {
  const [state, setState] = useState<BroadcastState>({ active: false, lastSentAt: null, error: null });
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastFixRef = useRef<GeolocationPosition | null>(null);
  const userIdRef = useRef<string | null>(null);

  async function pushFix(pos: GeolocationPosition) {
    // Cache user id — session is in localStorage, no need to hit /auth/v1/user every 30s.
    let uid = userIdRef.current;
    if (!uid) {
      const { data } = await supabase.auth.getSession();
      uid = data.session?.user?.id ?? null;
      if (!uid) {
        setState((s) => ({ ...s, error: "You must be signed in to broadcast location." }));
        return;
      }
      userIdRef.current = uid;
    }
    const payload = {
      user_id: uid,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      speed_kmh: pos.coords.speed != null ? Math.max(0, pos.coords.speed * 3.6) : null,
      heading: pos.coords.heading ?? null,
      accuracy_m: pos.coords.accuracy ?? null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("live_locations").upsert(payload, { onConflict: "user_id" });
    if (error) {
      setState((s) => ({ ...s, error: "Could not send location. Please retry." }));
    } else {
      setState((s) => ({ ...s, error: null, lastSentAt: Date.now() }));
    }
  }

  function stop() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState({ active: false, lastSentAt: null, error: null });
  }

  function start() {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setState((s) => ({ ...s, error: "Geolocation not supported on this device." }));
      return;
    }
    if (watchIdRef.current != null) return;
    setState({ active: true, lastSentAt: null, error: null });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastFixRef.current = pos;
      },
      (err) => {
        setState((s) => ({ ...s, error: err.message || "Location permission denied." }));
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 25_000 },
    );

    // Kick an immediate one-shot fix so the first ping isn't delayed by 30s.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastFixRef.current = pos;
        void pushFix(pos);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10_000 },
    );

    intervalRef.current = window.setInterval(() => {
      const fix = lastFixRef.current;
      if (fix) void pushFix(fix);
    }, 30_000);
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
    };
  }, []);

  return { ...state, start, stop };
}