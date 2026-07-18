import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { useAuth } from "@/hooks/use-auth";
import { isAdmin } from "@/lib/rbac";
import { getAdminOverview } from "@/lib/admin.functions";
import { formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { roles, ready } = useAuth();
  const admin = isAdmin(roles);

  const stats = useQuery(queryOptions({
    queryKey: ["admin-stats"],
    // Admin gate is enforced server-side inside getAdminOverview (has_role check).
    // The client `enabled: admin` is UX-only, not the authorization boundary.
    queryFn: () => getAdminOverview(),
    enabled: admin,
  }));

  if (!ready) return <AppShell title="Admin"><LoadingState /></AppShell>;
  if (!admin) {
    return (
      <AppShell title="Admin">
        <EmptyState icon={<ShieldAlert className="h-6 w-6" />} title="Access denied"
          description="Only super admins can view this panel." />
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin Panel" description="Cross-fleet overview. Visible only to super admins.">
      {stats.isLoading ? <LoadingState /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Users" value={stats.data?.users ?? 0} />
          <StatCard label="Vehicles" value={stats.data?.vehicles ?? 0} />
          <StatCard label="Trips" value={stats.data?.trips ?? 0} />
          <StatCard label="AI requests" value={stats.data?.ai ?? 0} />
        </div>
      )}
    </AppShell>
  );
}
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><div className="num text-2xl font-semibold">{formatNumber(value)}</div></CardContent>
    </Card>
  );
}
