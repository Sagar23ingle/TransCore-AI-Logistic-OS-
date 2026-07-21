import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Store, Plus, Package, Truck as TruckIcon, IndianRupee } from "lucide-react";
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
import {
  listOpenLoads, listMyLoads, upsertLoad, cancelLoad, placeBid,
} from "@/lib/marketplace.functions";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/marketplace/")({
  head: () => ({ meta: [{ title: "Load Marketplace — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: MarketplacePage,
});

type LoadValues = {
  title: string; origin: string; destination: string; goods_type: string; vehicle_type: string;
  weight_tons: string; pickup_at: string; delivery_by: string; budget_amount: string;
  contact_name: string; contact_phone: string; notes: string;
};

function MarketplacePage() {
  const openFn = useServerFn(listOpenLoads);
  const mineFn = useServerFn(listMyLoads);
  const upsertFn = useServerFn(upsertLoad);
  const cancelFn = useServerFn(cancelLoad);
  const bidFn = useServerFn(placeBid);
  const qc = useQueryClient();
  const { user } = useAuth();
  const [postOpen, setPostOpen] = useState(false);
  const [tab, setTab] = useState<"browse" | "mine">("browse");

  const open = useQuery(queryOptions({ queryKey: ["market-open"], queryFn: () => openFn() }));
  const mine = useQuery(queryOptions({ queryKey: ["market-mine"], queryFn: () => mineFn() }));

  const { register, handleSubmit, reset } = useForm<LoadValues>({
    defaultValues: {
      title: "", origin: "", destination: "", goods_type: "", vehicle_type: "truck",
      weight_tons: "", pickup_at: "", delivery_by: "", budget_amount: "",
      contact_name: "", contact_phone: "", notes: "",
    },
  });
  useEffect(() => { if (postOpen) reset(); }, [postOpen, reset]);

  const post = useMutation({
    mutationFn: (v: LoadValues) => upsertFn({ data: {
      title: v.title, origin: v.origin, destination: v.destination,
      goods_type: v.goods_type, vehicle_type: v.vehicle_type,
      weight_tons: Number(v.weight_tons), pickup_at: new Date(v.pickup_at).toISOString(),
      delivery_by: v.delivery_by ? new Date(v.delivery_by).toISOString() : null,
      budget_amount: Number(v.budget_amount || 0),
      contact_name: v.contact_name || null, contact_phone: v.contact_phone || null,
      notes: v.notes || null, status: "open",
    } }),
    onSuccess: () => {
      toast.success("Load posted");
      setPostOpen(false);
      qc.invalidateQueries({ queryKey: ["market-open"] });
      qc.invalidateQueries({ queryKey: ["market-mine"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Post failed"),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["market-open"] }); qc.invalidateQueries({ queryKey: ["market-mine"] }); },
  });

  const bid = useMutation({
    mutationFn: (v: { load_id: string; amount: number }) => bidFn({ data: { load_id: v.load_id, bid_amount: v.amount } }),
    onSuccess: () => toast.success("Bid placed"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Bid failed"),
  });

  function handleBid(loadId: string, suggested: number) {
    const raw = prompt("Your bid amount (₹):", String(suggested || ""));
    if (!raw) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Enter a valid amount");
    bid.mutate({ load_id: loadId, amount: n });
  }

  const currentList = tab === "browse" ? open.data ?? [] : mine.data ?? [];

  return (
    <AppShell title="Load Marketplace" description="Brokers post loads, truck owners bid. All updates realtime."
      action={
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/marketplace/trucks">Truck board</Link></Button>
          <Button onClick={() => setPostOpen(true)}><Plus className="mr-2 h-4 w-4" /> Post load</Button>
        </div>
      }>
      <div className="mb-4 flex gap-2">
        <Button variant={tab === "browse" ? "default" : "outline"} size="sm" onClick={() => setTab("browse")}>Browse open loads</Button>
        <Button variant={tab === "mine" ? "default" : "outline"} size="sm" onClick={() => setTab("mine")}>My posted loads</Button>
      </div>

      {open.isLoading || mine.isLoading ? <LoadingState /> :
       currentList.length === 0 ? (
        <EmptyState icon={<Store className="h-6 w-6" />} title={tab === "browse" ? "No open loads right now" : "You haven't posted any loads"}
          description={tab === "browse" ? "Check back soon or post your own." : "Post loads to reach truck owners across the network."}
          action={<Button onClick={() => setPostOpen(true)}><Plus className="mr-2 h-4 w-4" /> Post load</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {currentList.map((l) => {
            const mineOwned = user?.id === l.broker_id;
            return (
              <Card key={l.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{l.title}</CardTitle>
                    <Badge variant={l.status === "open" ? "default" : "secondary"}>{l.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Package className="h-3.5 w-3.5" /> {l.goods_type} · {formatNumber(Number(l.weight_tons), 1)}t · {l.vehicle_type}
                  </div>
                  <div>{l.origin} <span className="text-muted-foreground">→</span> {l.destination}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    Pickup {formatDate(l.pickup_at)} {l.delivery_by ? ` · deliver by ${formatDate(l.delivery_by)}` : ""}
                  </div>
                  <div className="flex items-center gap-1 num font-semibold"><IndianRupee className="h-3.5 w-3.5" />{formatNumber(Number(l.budget_amount || 0))}</div>
                  <div className="flex gap-2 pt-2">
                    {mineOwned && l.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => { if (confirm("Cancel this load?")) cancel.mutate(l.id); }}>Cancel</Button>
                    )}
                    {!mineOwned && l.status === "open" && (
                      <Button size="sm" onClick={() => handleBid(l.id, Number(l.budget_amount || 0))}>Place bid</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent className="max-w-lg max-h-[92dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Post a load</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((v) => post.mutate(v))} className="grid gap-3 sm:grid-cols-2">
            <F label="Title *" full><Input required {...register("title")} /></F>
            <F label="Origin *"><Input required {...register("origin")} /></F>
            <F label="Destination *"><Input required {...register("destination")} /></F>
            <F label="Goods type *"><Input required {...register("goods_type")} /></F>
            <F label="Vehicle type *"><Input required {...register("vehicle_type")} /></F>
            <F label="Weight (tons) *"><Input type="number" step="0.1" required {...register("weight_tons")} /></F>
            <F label="Budget (₹)"><Input type="number" step="1" {...register("budget_amount")} /></F>
            <F label="Pickup *"><Input type="datetime-local" required {...register("pickup_at")} /></F>
            <F label="Deliver by"><Input type="datetime-local" {...register("delivery_by")} /></F>
            <F label="Contact name"><Input {...register("contact_name")} /></F>
            <F label="Contact phone"><Input {...register("contact_phone")} /></F>
            <F label="Notes" full><Input {...register("notes")} /></F>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setPostOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={post.isPending}>{post.isPending ? "Posting..." : "Post load"}</Button>
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