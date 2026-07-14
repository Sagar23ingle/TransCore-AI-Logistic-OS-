import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DocumentMeta = z.object({
  id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid().nullish(),
  driver_id: z.string().uuid().nullish(),
  doc_type: z.enum(["rc", "insurance", "permit", "fitness", "puc", "driving_license", "vehicle_photo", "other"]),
  title: z.string().trim().min(1).max(200),
  storage_path: z.string().min(1),
  mime_type: z.string().max(100).nullish(),
  size_bytes: z.number().int().min(0).max(20 * 1024 * 1024).nullish(),
  issued_on: z.string().nullish(),
  expiry_date: z.string().nullish(),
  notes: z.string().max(1000).nullish(),
});

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_BYTES = 20 * 1024 * 1024;

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("documents")
      .select("*, vehicle:vehicles(id, registration_number), driver:drivers(id, full_name)")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return data ?? [];
  });

export const createDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => DocumentMeta.parse(raw))
  .handler(async ({ context, data }) => {
    // The client uploaded the file directly to Storage using the browser client's auth.
    // Validate the storage_path is scoped to this user's folder.
    if (!data.storage_path.startsWith(context.userId + "/")) {
      throw new Error("Invalid storage path");
    }
    if (data.mime_type && !ALLOWED_MIME.has(data.mime_type)) {
      throw new Error("Unsupported file type. Allowed: PDF, JPEG, PNG, WebP, HEIC.");
    }
    if (data.size_bytes != null && data.size_bytes > MAX_BYTES) {
      throw new Error("File too large. Max size is 20 MB.");
    }
    // Verify the object actually exists in storage under this user's folder,
    // preventing rows from pointing at other users' paths.
    const { data: objects, error: listErr } = await context.supabase.storage
      .from("documents")
      .list(context.userId, { search: data.storage_path.split("/").slice(1).join("/") });
    if (listErr) { console.error(listErr); throw new Error("Request failed. Please try again."); }
    const found = objects?.find((o) => `${context.userId}/${o.name}` === data.storage_path);
    if (!found) throw new Error("Upload not found");
    if (found.metadata?.size && found.metadata.size > MAX_BYTES) {
      await context.supabase.storage.from("documents").remove([data.storage_path]);
      throw new Error("File too large. Max size is 20 MB.");
    }
    if (found.metadata?.mimetype && !ALLOWED_MIME.has(found.metadata.mimetype)) {
      await context.supabase.storage.from("documents").remove([data.storage_path]);
      throw new Error("Unsupported file type. Allowed: PDF, JPEG, PNG, WebP, HEIC.");
    }
    const payload = { ...data, owner_id: context.userId };
    const { data: row, error } = await context.supabase
      .from("documents")
      .upsert(payload as never, { onConflict: "id" })
      .select("*")
      .single();
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return row;
  });

export const signDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { data: row } = await context.supabase
      .from("documents").select("storage_path").eq("id", data.id).eq("owner_id", context.userId).maybeSingle();
    if (!row) throw new Error("Document not found");
    const { data: signed, error } = await context.supabase.storage
      .from("documents")
      .createSignedUrl(row.storage_path, 60 * 10);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return { url: signed.signedUrl };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { data: row } = await context.supabase
      .from("documents").select("storage_path").eq("id", data.id).eq("owner_id", context.userId).maybeSingle();
    if (row) await context.supabase.storage.from("documents").remove([row.storage_path]);
    const { error } = await context.supabase
      .from("documents").delete().eq("id", data.id).eq("owner_id", context.userId);
    if (error) { console.error(error); throw new Error("Request failed. Please try again."); }
    return { ok: true };
  });
