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
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add vehicle
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((v) => (
            <Card key={v.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-semibold tracking-tight">{v.registration_number}</div>
                    <div className="text-sm text-muted-foreground">
                      {[v.make, v.model, v.year].filter(Boolean).join(" · ") || "—"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{v.vehicle_type}</Badge>
                      <Badge variant={v.status === "active" ? "default" : v.status === "maintenance" ? "outline" : "destructive"}>
                        {v.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(v); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove this vehicle?")) del.mutate(v.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <dt>Insurance</dt><dd className="text-right text-foreground">{formatDate(v.insurance_expiry)}</dd>
                  <dt>Permit</dt><dd className="text-right text-foreground">{formatDate(v.permit_expiry)}</dd>
                  <dt>Fitness</dt><dd className="text-right text-foreground">{formatDate(v.fitness_expiry)}</dd>
                  <dt>PUC</dt><dd className="text-right text-foreground">{formatDate(v.puc_expiry)}</dd>
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
