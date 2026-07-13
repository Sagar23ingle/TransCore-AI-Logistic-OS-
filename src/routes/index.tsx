import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Truck,
  MapPin,
  Sparkles,
  ShieldCheck,
  FileText,
  Bell,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TransCore AI — AI-Powered Fleet Management for Truck Owners" },
      {
        name: "description",
        content:
          "Run your entire trucking business from one dashboard: vehicles, drivers, trips, live GPS tracking, document vault, expense analytics, smart expiry alerts and Gemini-powered AI insights.",
      },
      { property: "og:title", content: "TransCore AI — AI-Powered Fleet Management" },
      {
        property: "og:description",
        content:
          "The logistics OS for real truck owners. Live tracking, smart alerts, AI insights, document vault, expense analytics.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Truck, title: "Fleet Management", body: "Vehicles, drivers, and trips in one place. Always up to date." },
  { icon: MapPin, title: "Live GPS Tracking", body: "Traccar, Teltonika, MapMyIndia ready. Real coordinates, no simulation." },
  { icon: FileText, title: "Document Vault", body: "RC, insurance, permits, fitness, PUC — securely stored per fleet." },
  { icon: Bell, title: "Smart Alerts", body: "Automatic expiry, EMI and maintenance reminders at 30/15/7/3/0 days." },
  { icon: Sparkles, title: "AI Insights", body: "Gemini-powered trip and expense analysis. Never fake, never guessed." },
  { icon: ShieldCheck, title: "Bank-grade Security", body: "Row-level security, per-user isolation, encrypted document storage." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">TransCore AI</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Fleet OS</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1000px_500px_at_50%_-100px,oklch(0.80_0.16_200/0.18),transparent)]" />
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-16 text-center sm:pt-24">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Powered by Gemini and Lovable AI
          </div>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            The AI-native <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">operating system</span> for truck fleets.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            Manage vehicles, drivers, trips, documents, and money — with live GPS tracking and Gemini AI built in. Built for real Indian truck owners, brokers and small fleets.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Start free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline">Sign in</Button>
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-accent" /> No credit card required</div>
            <div className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-accent" /> No fake data. Ever.</div>
            <div className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-accent" /> Cancel anytime</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="glass rounded-xl p-5">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-medium">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} TransCore AI · Built for logistics
      </footer>
    </div>
  );
}
