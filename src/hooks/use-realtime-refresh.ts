import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Tables whose changes should refresh dashboard/analytics reads. */
const WATCHED = [
  "vehicles",
  "drivers",
  "trips",
  "fuel_logs",
  "expenses",
  "maintenance_logs",
  "documents",
  "invoices",
  "alerts",
] as const;

/**
 * Subscribes to Postgres changes on the fleet tables and invalidates the
 * given query keys so every KPI, chart and list recomputes from real data
 * the moment anything changes (in this tab or another device).
 */
export function useRealtimeRefresh(keys: string[]) {
  const qc = useQueryClient();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const invalidate = () => {
      // Debounce bursts (e.g. a trip + its expenses inserted together).
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        for (const key of keys) qc.invalidateQueries({ queryKey: [key] });
      }, 400);
    };

    const channel = supabase.channel("tc-realtime-refresh");
    for (const table of WATCHED) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, invalidate);
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // keys is a stable literal list at each call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, keys.join("|")]);
}
