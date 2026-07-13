import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Check } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/billing/")({
  head: () => ({ meta: [{ title: "Billing — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: BillingPage,
});

const PLANS = [
  { key: "free", name: "Free", price: "₹0", features: ["Up to 2 vehicles", "Document vault (100 MB)", "Basic alerts"] },
  { key: "starter", name: "Starter", price: "₹499 / mo", features: ["Up to 10 vehicles", "Live tracking", "AI insights (100 / mo)"] },
  { key: "professional", name: "Professional", price: "₹1,499 / mo", features: ["Up to 50 vehicles", "Unlimited AI", "Priority support"] },
  { key: "enterprise", name: "Enterprise", price: "Contact us", features: ["Unlimited vehicles", "Custom integrations", "Dedicated success"] },
];

function BillingPage() {
  return (
    <AppShell title="Billing & Plans" description="Upgrade to unlock live tracking, unlimited AI and priority support.">
      <div className="mb-6 flex items-center gap-2 rounded-md border border-border bg-secondary/50 p-3 text-sm text-muted-foreground">
        <CreditCard className="h-4 w-4" />
        Razorpay integration activates in the next phase. All plan gates run against real subscription state — no fake trials.
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => (
          <Card key={p.key}>
            <CardHeader><CardTitle className="text-base">{p.name}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="num text-2xl font-semibold">{p.price}</div>
              <ul className="space-y-1 text-sm">
                {p.features.map((f) => (<li key={f} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-accent" /> {f}</li>))}
              </ul>
              <Button disabled className="w-full" variant={p.key === "professional" ? "default" : "outline"}>Coming soon</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
