import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { deleteExpense, listExpenses, upsertExpense } from "@/lib/expenses.functions";
import { listVehicles } from "@/lib/vehicles.functions";
import { listTrips } from "@/lib/trips.functions";
import { formatDate, formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/expenses/")({
  head: () => ({ meta: [{ title: "Expenses — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: ExpensesPage,
});

const CATEGORIES = ["fuel", "toll", "maintenance", "driver_allowance", "loading", "unloading", "other"] as const;
type Category = (typeof CATEGORIES)[number];
type Values = { category: Category; amount: string; incurred_on: string; vehicle_id: string; trip_id: string; description: string };

function ExpensesPage() {
  const listFn = useServerFn(listExpenses);
  const upsertFn = useServerFn(upsertExpense);
  const delFn = useServerFn(deleteExpense);
  const vehiclesFn = useServerFn(listVehicles);
  const tripsFn = useServerFn(listTrips);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const q = useQuery(queryOptions({ queryKey: ["expenses"], queryFn: () => listFn() }));
  const vehiclesQ = useQuery(queryOptions({ queryKey: ["vehicles"], queryFn: () => vehiclesFn(), enabled: open }));
  const tripsQ = useQuery(queryOptions({ queryKey: ["trips"], queryFn: () => tripsFn(), enabled: open }));

  const { register, handleSubmit, reset, setValue, watch } = useForm<Values>({
    defaultValues: { category: "fuel", amount: "", incurred_on: new Date().toISOString().slice(0, 10), vehicle_id: "", trip_id: "", description: "" },
  });
  useEffect(() => { if (open) reset({ category: "fuel", amount: "", incurred_on: new Date().toISOString().slice(0, 10), vehicle_id: "", trip_id: "", description: "" }); }, [open, reset]);

  const mut = useMutation({
    mutationFn: (v: Values) => upsertFn({
      data: {
        category: v.category, amount: Number(v.amount), incurred_on: v.incurred_on,
        vehicle_id: v.vehicle_id || null, trip_id: v.trip_id || null,
        description: v.description || null,
      },
    }),
    onSuccess: () => { toast.success("Expense recorded"); setOpen(false); qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); qc.invalidateQueries({ queryKey: ["dashboard-expense-breakdown"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); },
  });

  return (
    <AppShell title="Expenses" description="Fuel, tolls, maintenance and more. All money out."
      action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add expense</Button>}>
      {q.isLoading ? <LoadingState /> : !q.data || q.data.length === 0 ? (
        <EmptyState icon={<Receipt className="h-6 w-6" />} title="No expenses yet"
          description="Log fuel, tolls, and maintenance to see spend broken down on your dashboard."
          action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add expense</Button>} />
      ) : (
        <div className="grid gap-2">
          {q.data.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{e.category}</Badge>
                    <div className="num font-semibold">{formatINR(Number(e.amount))}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDate(e.incurred_on)}
                    {e.vehicle && <> · {e.vehicle.registration_number}</>}
                    {e.trip && <> · {e.trip.origin} → {e.trip.destination}</>}
                  </div>
                  {e.description && <div className="mt-1 text-sm">{e.description}</div>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove?")) del.mutate(e.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add expense</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="grid gap-3 sm:grid-cols-2">
            <F label="Category">
              <Select value={watch("category")} onValueChange={(v) => setValue("category", v as Category)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
              </Select>
            </F>
            <F label="Amount (₹) *"><Input type="number" step="0.01" required {...register("amount")} /></F>
            <F label="Date *"><Input type="date" required {...register("incurred_on")} /></F>
            <F label="Vehicle">
              <Select value={watch("vehicle_id")} onValueChange={(v) => setValue("vehicle_id", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {(vehiclesQ.data ?? []).map((v) => (<SelectItem key={v.id} value={v.id}>{v.registration_number}</SelectItem>))}
                </SelectContent>
              </Select>
            </F>
            <F label="Trip" full>
              <Select value={watch("trip_id")} onValueChange={(v) => setValue("trip_id", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {(tripsQ.data ?? []).map((t) => (<SelectItem key={t.id} value={t.id}>{t.origin} → {t.destination}</SelectItem>))}
                </SelectContent>
              </Select>
            </F>
            <F label="Description" full><Input {...register("description")} /></F>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "Saving..." : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (<div className={full ? "sm:col-span-2 space-y-1" : "space-y-1"}><Label className="text-xs">{label}</Label>{children}</div>);
}
