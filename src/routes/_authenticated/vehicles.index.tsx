import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { VehicleFormDialog } from "@/components/vehicles/VehicleFormDialog";
import { deleteVehicle, listVehicles } from "@/lib/vehicles.functions";
import { formatDate } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/vehicles/")({
  head: () => ({ meta: [{ title: "Vehicles — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: VehiclesPage,
});

type Vehicle = Tables<"vehicles">;

function VehiclesPage() {
  const listFn = useServerFn(listVehicles);
  const delFn = useServerFn(deleteVehicle);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [open, setOpen] = useState(false);

  const q = useQuery(queryOptions({ queryKey: ["vehicles"], queryFn: () => listFn() }));
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Vehicle removed");
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  return (
    <AppShell
      title="Vehicles"
      description="Trucks, trailers and other assets registered to your fleet."
      action={
        <Button size="sm" className="h-10 rounded-full px-4" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Add
        </Button>
      }
    >
      {q.isLoading ? (
        <LoadingState />
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-6 w-6" />}
          title="No vehicles yet"
          description="Add your first vehicle to start tracking trips, expenses and documents."
          action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add vehicle</Button>}
        />
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((v) => (
            <Card key={v.id} className="rounded-2xl">
              <CardContent className="p-3.5">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-[15px] font-semibold tracking-tight">{v.registration_number}</div>
                      <Badge variant={v.status === "active" ? "default" : v.status === "maintenance" ? "outline" : "destructive"} className="h-5 px-1.5 text-[10px]">
                        {v.status}
                      </Badge>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[v.vehicle_type, v.make, v.model, v.year].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="flex shrink-0 -mr-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(v); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { if (confirm("Remove this vehicle?")) del.mutate(v.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                  {[
                    ["Insurance", v.insurance_expiry],
                    ["Permit", v.permit_expiry],
                    ["Fitness", v.fitness_expiry],
                    ["PUC", v.puc_expiry],
                  ].map(([k, val]) => (
                    <div key={k as string} className="rounded-lg bg-muted/40 px-2 py-1.5">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="mt-0.5 truncate font-medium text-foreground">{formatDate(val as string | null) ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <VehicleFormDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing ?? undefined}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["vehicles"] });
          qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        }}
      />
    </AppShell>
  );
}
