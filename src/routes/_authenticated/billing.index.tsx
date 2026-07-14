import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, FileText } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { listPlans, listInvoices } from "@/lib/plans.functions";
import { formatDate, formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/billing/")({
  head: () => ({ meta: [{ title: "Billing — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: BillingPage,
});

function BillingPage() {
  const plansFn = useServerFn(listPlans);
  const invFn = useServerFn(listInvoices);
  const plans = useQuery(queryOptions({ queryKey: ["plans"], queryFn: () => plansFn() }));
  const invoices = useQuery(queryOptions({ queryKey: ["invoices"], queryFn: () => invFn() }));

  return (
    <AppShell title="Billing & Plans" description="Choose a plan that fits your fleet. Invoices are itemised with GST.">
      {plans.isLoading ? <LoadingState /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(plans.data ?? []).map((p) => {
            const features = Array.isArray(p.features) ? (p.features as string[]) : [];
            return (
              <Card key={p.id} className={p.id === "professional" ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    {p.id === "professional" && <Badge>Popular</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="num text-2xl font-semibold">
                    {p.price_inr === 0 ? "₹0" : formatINR(p.price_inr)}
                    <span className="text-xs font-normal text-muted-foreground"> / {p.interval}</span>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {features.map((f: string) => (
                      <li key={f} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-accent" /> {f}</li>
                    ))}
                  </ul>
                  <Button disabled className="w-full" variant={p.id === "professional" ? "default" : "outline"}>
                    {p.id === "free" ? "Current plan" : "Contact sales to activate"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Invoices</h2>
        {invoices.isLoading ? <LoadingState /> : !invoices.data || invoices.data.length === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title="No invoices yet"
            description="Invoices appear here after your first paid billing cycle." />
        ) : (
          <div className="grid gap-2">
            {invoices.data.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div>
                  <div className="font-mono">{i.invoice_number}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(i.issued_at ?? i.created_at)} · {i.status}</div>
                </div>
                <div className="num font-semibold">{formatINR(Number(i.total_amount))}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
