import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { attemptSignin, validateSignup } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TransCore AI" },
      { name: "description", content: "Sign in to your TransCore AI fleet dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthPage,
});

// Only allow same-origin relative paths so `next` cannot open-redirect off-site.
function safeNext(next: string | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const safe = safeNext(next);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    let cancelled = false;
    function goPostAuth() {
      if (safe) {
        // Full navigation so route-based query parsing picks up `authorization_id`.
        window.location.replace(safe);
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) goPostAuth();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) goPostAuth();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate, safe]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // All brute-force protection (per-IP throttle, per-account lockout,
      // exponential backoff, lockout email) runs server-side. The response
      // is deliberately identical for every failure mode.
      const tokens = await attemptSignin({ data: { email, password } });
      const { error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (error) throw new Error("Incorrect email or password");
      toast.success("Welcome back");
      // onAuthStateChange handles navigation once the session is persisted,
      // which avoids the _authenticated guard racing an unpersisted session.
    } catch (err) {
      // Never surface the underlying reason — the server already normalised
      // it to a single generic string.
      toast.error("Incorrect email or password");
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Server-side re-validation returns sanitised values; we then hand
      // ONLY those to Supabase Auth so nothing free-typed by the browser
      // slips through into auth metadata or the profile trigger.
      const clean = await validateSignup({
        data: { email, password, full_name: fullName },
      });
      const { error } = await supabase.auth.signUp({
        email: clean.email,
        password,
        options: {
          emailRedirectTo: window.location.origin + (safe ?? "/dashboard"),
          data: { full_name: clean.full_name },
        },
      });
      // Never confirm or deny whether the email is already registered.
      // Swallow provider errors (e.g. "User already registered") behind the
      // same generic message so signup cannot be used to enumerate accounts.
      if (error) console.error("[signup]", error);
      toast.success("If this email isn't already in use, we've sent a confirmation link.");
    } catch (err) {
      // Only validation errors from our own server fn surface here; those are
      // already generic ("Invalid submission.").
      toast.error(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (loading) return;
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        // Same-origin public URL. We re-apply `next` after the session hydrates
        // (goPostAuth in useEffect) — never send Google to a protected/consent URL.
        redirect_uri: window.location.origin + "/auth" + (safe ? `?next=${encodeURIComponent(safe)}` : ""),
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      if (safe) window.location.replace(safe);
      else navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-4 py-10">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">TransCore AI</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Fleet OS</div>
          </div>
        </Link>

        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Access your fleet</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4 pt-4">
                <form onSubmit={handleSignIn} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
                <Separator />
                <Button type="button" variant="outline" onClick={handleGoogle} disabled={loading} className="w-full">
                  Continue with Google
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 pt-4">
                <form onSubmit={handleSignUp} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email2">Email</Label>
                    <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password2">Password</Label>
                    <Input id="password2" type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
                    <p className="text-xs text-muted-foreground">
                      12+ characters with upper &amp; lower case, a number, and a symbol.
                      Leaked passwords are blocked.
                    </p>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Creating..." : "Create account"}
                  </Button>
                </form>
                <Separator />
                <Button type="button" variant="outline" onClick={handleGoogle} disabled={loading} className="w-full">
                  Continue with Google
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to fair use and per-user data isolation.
        </p>
      </div>
    </div>
  );
}

function Separator() {
  return (
    <div className="relative py-2 text-center">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-border" />
      <span className="relative bg-card px-2 text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
    </div>
  );
}
