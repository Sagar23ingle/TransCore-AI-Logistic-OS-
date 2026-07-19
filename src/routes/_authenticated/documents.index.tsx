import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, FileText, ExternalLink, FileCheck2, ShieldCheck, ScrollText, Stamp, Leaf, IdCard, Camera, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectCards, SearchableDropdown } from "@/components/ui/smart-select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { supabase } from "@/integrations/supabase/client";
import { createDocument, deleteDocument, listDocuments, signDocumentUrl } from "@/lib/documents.functions";
import { listVehicles } from "@/lib/vehicles.functions";
import { listDrivers } from "@/lib/drivers.functions";
import { formatDate, daysUntil } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/documents/")({
  head: () => ({ meta: [{ title: "Document Vault — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: DocumentsPage,
});

const DOC_TYPES = ["rc", "insurance", "permit", "fitness", "puc", "driving_license", "vehicle_photo", "other"] as const;
type DocType = (typeof DOC_TYPES)[number];
const DOC_TYPE_OPTIONS = [
  { value: "rc" as const, label: "RC", icon: FileCheck2 },
  { value: "insurance" as const, label: "Insurance", icon: ShieldCheck },
  { value: "permit" as const, label: "Permit", icon: ScrollText },
  { value: "fitness" as const, label: "Fitness", icon: Stamp },
  { value: "puc" as const, label: "PUC", icon: Leaf },
  { value: "driving_license" as const, label: "License", icon: IdCard },
  { value: "vehicle_photo" as const, label: "Photo", icon: Camera },
  { value: "other" as const, label: "Other", icon: MoreHorizontal },
];
type Values = { doc_type: DocType; title: string; vehicle_id: string; driver_id: string; expiry_date: string; issued_on: string; file: FileList };

function DocumentsPage() {
  const listFn = useServerFn(listDocuments);
  const createFn = useServerFn(createDocument);
  const delFn = useServerFn(deleteDocument);
  const signFn = useServerFn(signDocumentUrl);
  const vehiclesFn = useServerFn(listVehicles);
  const driversFn = useServerFn(listDrivers);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const q = useQuery(queryOptions({ queryKey: ["documents"], queryFn: () => listFn() }));
  const vehiclesQ = useQuery(queryOptions({ queryKey: ["vehicles"], queryFn: () => vehiclesFn(), enabled: open }));
  const driversQ = useQuery(queryOptions({ queryKey: ["drivers"], queryFn: () => driversFn(), enabled: open }));

  const { register, handleSubmit, reset, setValue, watch } = useForm<Values>({
    defaultValues: { doc_type: "insurance", title: "", vehicle_id: "", driver_id: "", expiry_date: "", issued_on: "" },
  });

  async function onSubmit(v: Values) {
    const file = v.file?.[0];
    if (!file) { toast.error("Choose a file"); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("Max file size is 20 MB"); return; }
    const allowed = ["application/pdf","image/jpeg","image/png","image/webp","image/heic","image/heif"];
    if (file.type && !allowed.includes(file.type)) {
      toast.error("Unsupported file type. Allowed: PDF, JPEG, PNG, WebP, HEIC.");
      return;
    }
    setUploading(true);
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const userId = sessionRes.session?.user?.id;
      if (!userId) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "bin";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const upl = await supabase.storage.from("documents").upload(path, file, { contentType: file.type, upsert: false });
      if (upl.error) throw upl.error;
      await createFn({
        data: {
          doc_type: v.doc_type,
          title: v.title || file.name,
          vehicle_id: v.vehicle_id || null, driver_id: v.driver_id || null,
          storage_path: path, mime_type: file.type, size_bytes: file.size,
          issued_on: v.issued_on || null, expiry_date: v.expiry_date || null,
        },
      });
      toast.success("Document uploaded");
      setOpen(false); reset();
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  async function openDoc(id: string) {
    try {
      const { url } = await signFn({ data: { id } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open document");
    }
  }

  return (
    <AppShell title="Documents" description="RC, insurance, permits, fitness, PUC — securely stored per fleet."
      action={<Button size="sm" className="h-10 rounded-full px-4" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Upload</Button>}>
      {q.isLoading ? <LoadingState /> : !q.data || q.data.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="No documents yet"
          description="Upload the first document — we'll track expiry automatically." />
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((d) => {
            const days = daysUntil(d.expiry_date);
            const tone = days == null ? "" : days < 0 ? "text-destructive" : days <= 15 ? "text-warning" : "text-muted-foreground";
            const opt = DOC_TYPE_OPTIONS.find((o) => o.value === d.doc_type);
            const Icon = opt?.icon ?? FileText;
            return (
              <Card key={d.id} className="list-perf rounded-2xl">
                <CardContent className="p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold">{d.title}</div>
                        {days != null && (
                          <Badge variant={days < 0 ? "destructive" : days <= 15 ? "outline" : "secondary"} className="h-5 shrink-0 px-1.5 text-[10px]">
                            {days < 0 ? "expired" : `${days}d`}
                          </Badge>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {opt?.label ?? d.doc_type}
                        {d.vehicle && <> · {d.vehicle.registration_number}</>}
                        {d.driver && <> · {d.driver.full_name}</>}
                      </div>
                      <div className={`truncate text-[11px] ${tone}`}>Expiry {formatDate(d.expiry_date) ?? "—"}</div>
                    </div>
                    <div className="flex shrink-0 -mr-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openDoc(d.id)}><ExternalLink className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { if (confirm("Delete this document?")) del.mutate(d.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Upload document</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2">
            <F label="Document type" full>
              <SelectCards
                columns={4} ariaLabel="Document type"
                value={watch("doc_type")}
                onChange={(v) => setValue("doc_type", v)}
                options={DOC_TYPE_OPTIONS}
              />
            </F>
            <F label="Title"><Input {...register("title")} placeholder="Insurance – MH12AB1234" /></F>
            <F label="Vehicle">
              <SearchableDropdown
                clearable placeholder="—" ariaLabel="Vehicle"
                value={watch("vehicle_id")}
                onChange={(v) => setValue("vehicle_id", v)}
                options={(vehiclesQ.data ?? []).map((v) => ({ value: v.id, label: v.registration_number }))}
              />
            </F>
            <F label="Driver">
              <SearchableDropdown
                clearable placeholder="—" ariaLabel="Driver"
                value={watch("driver_id")}
                onChange={(v) => setValue("driver_id", v)}
                options={(driversQ.data ?? []).map((d) => ({ value: d.id, label: d.full_name }))}
              />
            </F>
            <F label="Issued on"><Input type="date" {...register("issued_on")} /></F>
            <F label="Expiry"><Input type="date" {...register("expiry_date")} /></F>
            <F label="File (PDF or image, max 20 MB) *" full>
              <Input type="file" accept="application/pdf,image/*" required {...register("file")} />
            </F>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={uploading}>{uploading ? "Uploading..." : "Upload"}</Button>
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
