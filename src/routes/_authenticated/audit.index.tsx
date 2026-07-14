import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ScrollText, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { listAudit, listAuditFilterOptions } from "@/lib/audit.functions";
import { useCompanies } from "@/hooks/use-company";

export const Route = createFileRoute("/_authenticated/audit/")({
  head: () => ({ meta: [{ title: "Audit log — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: AuditPage,
});

function AuditPage() {
  const { activeCompanyId } = useCompanies();
  const listFn = useServerFn(listAudit);
  const optsFn = useServerFn(listAuditFilterOptions);
  const [q, setQ] = useState("");
  const [action, setAction] = useState<string>("all");
  const [entity, setEntity] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);

  const opts = useQuery({
    queryKey: ["audit-opts", activeCompanyId],
    queryFn: () => optsFn({ data: { company_id: activeCompanyId ?? null } }),
    enabled: !!activeCompanyId,
  });

  const query = useQuery({
    queryKey: ["audit", activeCompanyId, q, action, entity, from, to, offset],
    queryFn: () => listFn({ data: {
      company_id: activeCompanyId ?? null,
      q: q || null,
      action: action === "all" ? null : action,
      entity: entity === "all" ? null : entity,
      from: from ? new Date(from).toISOString() : null,
      to: to ? new Date(to + "T23:59:59").toISOString() : null,
      limit: 100,
      offset,
    } }),
    enabled: !!activeCompanyId,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, typeof query.data>();
    for (const row of query.data ?? []) {
      const key = new Date(row.occurred_at as string).toLocaleDateString();
      const arr = map.get(key) ?? [];
      arr.push(row);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [query.data]);

  return (
    <AppShell title="Audit log" description="Every meaningful action across your company — searchable and filterable.">
      <Card className="mb-4">
        <CardContent className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search action, entity, id, IP" value={q} onChange={(e) => { setOffset(0); setQ(e.target.value); }} className="pl-8" />
          </div>
          <Select value={action} onValueChange={(v) => { setOffset(0); setAction(v); }}>
            <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {(opts.data?.actions ?? []).map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={entity} onValueChange={(v) => { setOffset(0); setEntity(v); }}>
            <SelectTrigger><SelectValue placeholder="Entity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {(opts.data?.entities ?? []).map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => { setOffset(0); setFrom(e.target.value); }} />
          <Input type="date" value={to} onChange={(e) => { setOffset(0); setTo(e.target.value); }} />
        </CardContent>
      </Card>

      {query.isLoading ? <LoadingState /> : (query.data?.length ?? 0) === 0 ? (
        <EmptyState icon={<ScrollText className="h-6 w-6" />} title="No activity found" description="Actions across your fleet will appear here as they happen." />
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, rows]) => (
            <div key={day}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{day}</div>
              <div className="space-y-1.5">
                {(rows ?? []).map((r) => {
                  const actor = r.actor_name || "System";
                  return (
                    <Card key={r.id as unknown as string}>
                      <CardContent className="flex flex-wrap items-center gap-3 py-3 text-sm">
                        <div className="w-20 text-xs text-muted-foreground">
                          {new Date(r.occurred_at as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <Badge variant="outline">{r.action}</Badge>
                        {r.entity && <span className="text-xs text-muted-foreground">{r.entity}{r.entity_id ? ` · ${(r.entity_id as string).slice(0, 8)}` : ""}</span>}
                        <span className="ml-auto text-xs text-muted-foreground">{actor}{r.ip ? ` · ${r.ip}` : ""}</span>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex justify-between">
            <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}>Previous</Button>
            <Button variant="outline" disabled={(query.data?.length ?? 0) < 100} onClick={() => setOffset(offset + 100)}>Next</Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}