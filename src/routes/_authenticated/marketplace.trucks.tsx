import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Truck, Plus, IndianRupee, MapPin } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { listAvailableTrucks, listMyTruckPosts, upsertTruckPost, deactivateTruckPost } from "@/lib/marketplace.functions";
import { formatDate, formatNumber } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/marketplace/trucks")({
  head: () => ({ meta: [{ title: "Truck Board — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: TrucksPage,
});

type Values = {
  from_location: string; to_location: string; vehicle_type: string;
  capacity_tons: string; available_from: string; expected_rate: string; contact_phone: string; notes: string;
};

function TrucksPage() {
  const availFn = useServerFn(listAvailableTrucks);
  const mineFn = useServerFn(listMyTruckPosts);
  const upFn = useServerFn(upsertTruckPost);
  const offFn = useServerFn(deactivateTruckPost);
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [open, setOpen] = useState(false);

  const avail = useQuery(queryOptions({ queryKey: ["trucks-avail"], queryFn: () => availFn() }));
  const mine = useQuery(queryOptions({ queryKey: ["trucks-mine"], queryFn: () => mineFn() }));

  const { register, handleSubmit, reset } = useForm<Values>({
    defaultValues: { from_location: "", to_location: "", vehicle_type: "truck", capacity_tons: "", available_from: "", expected_rate: "", contact_phone: "", notes: "" },
  });
  useEffect(() => { if (open) reset(); }, [open, reset]);

  const post = useMutation({
    mutationFn: (v: Values) => upFn({ data: {
      from_location: v.from_location, to_location: v.to_location || null,
      vehicle_type: v.vehicle_type, capacity_tons: Number(v.capacity_tons),
      available_from: new Date(v.available_from).toISOString(),
      expected_rate: v.expected_rate ? Number(v.expected_rate) : null,
      contact_phone: v.contact_phone || null, notes: v.notes || null, is_active: true,
    } }),
    onSuccess: () => {
      toast.success("Truck posted"); setOpen(false);
      qc.invalidateQueries({ queryKey: ["trucks-avail"] });
      qc.invalidateQueries({ queryKey: ["trucks-mine"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Post failed"),
  });
  const off = useMutation({
    mutationFn: (id: string) => offFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trucks-avail"] }); qc.invalidateQueries({ queryKey: ["trucks-mine"] }); },
  });

  const list = tab === "browse" ? avail.data ?? [] : mine.data ?? [];

  return (
    <AppShell title="Truck Board" description="Truck owners post availability, brokers browse and match."
      action={
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/marketplace">Load board</Link></Button>
          <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Post truck</Button>
        </div>
      }>
      <div className="mb-4 flex gap-2">
        <Button variant={tab === "browse" ? "default" : "outline"} size="sm" onClick={() => setTab("browse")}>Browse available</Button>
        <Button variant={tab === "mine" ? "default" : "outline"} size="sm" onClick={() => setTab("mine")}>My posts</Button>
      </div>
      {avail.isLoading || mine.isLoading ? <LoadingState /> :
       list.length === 0 ? (
        <EmptyState icon={<Truck className="h-6 w-6" />} title="Nothing here yet"
          description={tab === "browse" ? "No trucks currently available on the board." : "Post your available trucks to get discovered by brokers."} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => {
            const mineOwned = user?.id === t.owner_id;
            return (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" /> {t.vehicle_type}</CardTitle>
                    <Badge variant={t.is_active ? "default" : "secondary"}>{t.is_active ? "active" : "off"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {t.from_location}{t.to_location ? ` → ${t.to_location}` : ""}</div>
                  <div>Capacity: <span className="num">{formatNumber(Number(t.capacity_tons), 1)}t</span></div>
                  <div className="text-xs text-muted-foreground">Available {formatDate(t.available_from)}</div>
                  {t.expected_rate != null && (
                    <div className="flex items-center gap-1 num text-sm font-semibold"><IndianRupee className="h-3.5 w-3.5" />{formatNumber(Number(t.expected_rate))}</div>
                  )}
                  {mineOwned && t.is_active && (
                    <div className="pt-2"><Button size="sm" variant="outline" onClick={() => off.mutate(t.id)}>Deactivate</Button></div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[92dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Post available truck</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((v) => post.mutate(v))} className="grid gap-3 sm:grid-cols-2">
            <F label="From *"><Input required {...register("from_location")} /></F>
            <F label="To (optional)"><Input {...register("to_location")} /></F>
            <F label="Vehicle type *"><Input required {...register("vehicle_type")} /></F>
            <F label="Capacity (tons) *"><Input type="number" step="0.1" required {...register("capacity_tons")} /></F>
            <F label="Available from *"><Input type="datetime-local" required {...register("available_from")} /></F>
            <F label="Expected rate (₹)"><Input type="number" step="1" {...register("expected_rate")} /></F>
            <F label="Contact phone"><Input {...register("contact_phone")} /></F>
            <F label="Notes" full><Input {...register("notes")} /></F>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={post.isPending}>{post.isPending ? "Posting..." : "Post truck"}</Button>
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