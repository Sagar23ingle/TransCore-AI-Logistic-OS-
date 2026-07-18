import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Beta helper types: keep a local wrapper for the auth.oauth namespace.
type OAuthDetails = {
  client?: { name?: string; client_id?: string; redirect_uris?: string[] } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
  scopes?: string[] | string | null;
};
type OAuthResult = { data: { redirect_url?: string | null; redirect_to?: string | null } | null; error: { message: string } | null };
interface AuthOAuth {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
}
const authOAuth = (): AuthOAuth =>
  (supabase.auth as unknown as { oauth: AuthOAuth }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Session lives in localStorage; skip SSR so signed-in users aren't bounced.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await authOAuth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md p-8 text-sm text-destructive">
      Could not load this authorization request: {String((error as Error)?.message ?? error)}
    </div>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "an app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await authOAuth().approveAuthorization(authorization_id)
      : await authOAuth().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  const scopes: string[] = Array.isArray(details?.scopes)
    ? (details!.scopes as string[])
    : typeof details?.scopes === "string"
      ? details.scopes.split(/[\s,]+/).filter(Boolean)
      : [];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-10">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">TransCore AI</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Authorize connection</div>
          </div>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">Connect {clientName} to your fleet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {clientName} will be able to call TransCore AI tools while you are signed in.
              It will see only your own fleet data — vehicles, drivers, trips, and alerts your
              account already has access to. This does not bypass your account permissions.
            </p>
            {scopes.length > 0 && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                <div className="mb-1 font-medium">Requested access</div>
                <ul className="list-disc pl-4 text-muted-foreground">
                  {scopes.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button disabled={busy} onClick={() => decide(true)} className="flex-1">
                {busy ? "Working…" : `Allow ${clientName}`}
              </Button>
              <Button disabled={busy} variant="outline" onClick={() => decide(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}