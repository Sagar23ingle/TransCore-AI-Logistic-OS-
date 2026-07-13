import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { DriverFormDialog } from "@/components/drivers/DriverFormDialog";
import { deleteDriver, listDrivers } from "@/lib/drivers.functions";
import { formatDate } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/drivers/")({
  head: () => ({ meta: [{ title: "Drivers — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: DriversPage,
});

type Driver = Tables<"drivers">;

function DriversPage() {
  const listFn = useServerFn(listDrivers);
  const delFn = useServerFn(deleteDriver);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Driver | null>(null);
  const [open, setOpen] = useState(false);

  const q = useQuery(queryOptions({ queryKey: ["drivers"], queryFn: () => listFn() }));
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Driver removed"); qc.invalidateQueries({ queryKey: ["drivers"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  return (
    <AppShell
      title="Drivers"
      description="People behind the wheel — licenses, contacts and status."
      action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add driver</Button>}
    >
      {q.isLoading ? <LoadingState /> : !q.data || q.data.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No drivers yet"
          description="Add drivers to assign them to trips and track their licenses."
          action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add driver</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((d) => (
            <Card key={d.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold">{d.full_name}</div>
                    <div className="text-sm text-muted-foreground">{d.phone || "—"}</div>
                    <div className="mt-2"><Badge variant={d.status === "active" ? "default" : "secondary"}>{d.status}</Badge></div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(d); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove this driver?")) del.mutate(d.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
                  <dt>License</dt><dd className="text-right text-foreground">{d.license_number || "—"}</dd>
                  <dt>License expiry</dt><dd className="text-right text-foreground">{formatDate(d.license_expiry)}</dd>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DriverFormDialog open={open} onOpenChange={setOpen} initial={editing ?? undefined} onSaved={() => qc.invalidateQueries({ queryKey: ["drivers"] })} />
    </AppShell>
  );
}
