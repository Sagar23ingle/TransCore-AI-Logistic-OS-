import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({ meta: [{ title: "Settings — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, phone, company_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setFullName(data.full_name ?? "");
        setPhone(data.phone ?? "");
        setCompany(data.company_name ?? "");
      }
    });
  }, [user]);

  async function save() {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id, full_name: fullName || null, phone: phone || null, company_name: company || null,
    });
    setLoading(false);
    if (error) toast.error(error.message); else toast.success("Profile updated");
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-out failed");
      setSigningOut(false);
    }
  }

  return (
    <AppShell title="Settings" description="Your account and organisation details.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={user?.email ?? ""} disabled /></div>
            <div className="space-y-1"><Label className="text-xs">Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Company / fleet name</Label><Input value={company} onChange={(e) => setCompany(e.target.value)} /></div>
            <Button onClick={save} disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Roles</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Your account has the following role(s):</p>
            <ul className="mt-2 space-y-1 text-sm">
              {roles.length === 0 ? <li className="text-muted-foreground">No roles assigned</li> :
                roles.map((r) => (<li key={r} className="rounded-md bg-secondary px-2 py-1 text-xs">{ROLE_LABELS[r]}</li>))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Roles control what you can access. Contact the fleet owner or a super admin to change roles.
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4 border-destructive/40">
        <CardHeader><CardTitle className="text-base text-destructive">Account</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Sign out of TransCore AI on this device.</p>
          <Button variant="destructive" onClick={handleSignOut} disabled={signingOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            {signingOut ? "Signing out..." : "Sign out"}
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
