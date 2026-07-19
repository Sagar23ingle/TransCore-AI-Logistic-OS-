import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, Users, Phone } from "lucide-react";
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
      action={<Button size="sm" className="h-10 rounded-full px-4" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-1.5 h-4 w-4" /> Add</Button>}
    >
      {q.isLoading ? <LoadingState /> : !q.data || q.data.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No drivers yet"
          description="Add drivers to assign them to trips and track their licenses."
          action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add driver</Button>}
        />
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((d) => {
            const initials = d.full_name.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();
            return (
              <Card key={d.id} className="list-perf rounded-2xl">
                <CardContent className="p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/25 to-primary/10 text-sm font-semibold text-primary">
                      {initials || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-[15px] font-semibold">{d.full_name}</div>
                        <Badge variant={d.status === "active" ? "default" : "secondary"} className="h-5 px-1.5 text-[10px]">{d.status}</Badge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{d.phone || "No phone"} · Lic {d.license_number || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">Expires {formatDate(d.license_expiry) ?? "—"}</div>
                    </div>
                    <div className="flex shrink-0 -mr-1">
                      {d.phone && (
                        <a href={`tel:${d.phone}`} className="grid h-9 w-9 place-items-center rounded-full text-primary hover:bg-primary/10" aria-label="Call driver">
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => { setEditing(d); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => { if (confirm("Remove this driver?")) del.mutate(d.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DriverFormDialog open={open} onOpenChange={setOpen} initial={editing ?? undefined} onSaved={() => qc.invalidateQueries({ queryKey: ["drivers"] })} />
    </AppShell>
  );
}
