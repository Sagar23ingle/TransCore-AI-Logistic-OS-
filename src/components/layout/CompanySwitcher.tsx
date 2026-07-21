import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompanies } from "@/hooks/use-company";
import { createCompany } from "@/lib/companies.functions";
import { COMPANY_ROLE_LABELS } from "@/lib/rbac";

export function CompanySwitcher() {
  const { companies, active, setActiveCompany, refetch } = useCompanies();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const createFn = useServerFn(createCompany);

  const create = useMutation({
    mutationFn: () => createFn({ data: { name, gstin: gstin || null, contact_email: email || null, contact_phone: phone || null } }),
    onSuccess: async (row) => {
      toast.success("Company created");
      setOpen(false); setName(""); setGstin(""); setPhone(""); setEmail("");
      await refetch();
      setActiveCompany(row.id);
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create company"),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 max-w-[240px]">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{active?.name ?? "Select company"}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Your companies</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {companies.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No companies yet</div>
          ) : (
            companies.map((c) => (
              <DropdownMenuItem
                key={c.company_id}
                onClick={() => {
                  setActiveCompany(c.company_id);
                  qc.invalidateQueries();
                }}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{c.name}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {COMPANY_ROLE_LABELS[c.role]}
                    </div>
                  </div>
                  {active?.company_id === c.company_id && <Check className="h-4 w-4 shrink-0" />}
                </div>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create company
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>New company</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cname">Company name *</Label>
              <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cgst">GSTIN</Label>
              <Input id="cgst" value={gstin} onChange={(e) => setGstin(e.target.value)} maxLength={20} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cph">Phone</Label>
                <Input id="cph" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cem">Contact email</Label>
                <Input id="cem" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || name.trim().length < 2}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}