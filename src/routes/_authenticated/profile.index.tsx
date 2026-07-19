import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { motion } from "motion/react";
import { z } from "zod";
import {
  Camera, CheckCircle2, KeyRound, Loader2, Mail, Phone, ShieldCheck, Trash2,
  Upload, User as UserIcon, Building2, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS } from "@/lib/rbac";
import { useProfile, useInvalidateProfile, initialsFrom } from "@/hooks/use-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/profile/")({
  head: () => ({
    meta: [
      { title: "My Profile — TransCore AI" },
      { name: "description", content: "Manage your TransCore AI account, avatar, contact info, and password." },
    ],
  }),
  component: ProfilePage,
});

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const profileSchema = z.object({
  full_name: z.string().trim().min(3, "Name must be at least 3 characters").max(50, "Name too long"),
  phone: z.string().trim().refine((v) => v === "" || /^[+\d][\d\s-]{9,}$/.test(v), "Enter a valid phone number (10+ digits)"),
  company_name: z.string().trim().max(100).optional().or(z.literal("")),
});

const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[a-z]/, "Add a lowercase letter")
      .regex(/[A-Z]/, "Add an uppercase letter")
      .regex(/\d/, "Add a number"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function ProfilePage() {
  const { user, roles } = useAuth();
  const { profile, avatarUrl, isLoading } = useProfile();
  const invalidateProfile = useInvalidateProfile();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setCompanyName(profile.company_name ?? "");
    }
  }, [profile?.id, profile?.full_name, profile?.phone, profile?.company_name]);

  const provider = useMemo(() => {
    const p = user?.app_metadata?.provider ?? "email";
    return p === "email" ? "Email & Password" : p.charAt(0).toUpperCase() + p.slice(1);
  }, [user]);
  const isPasswordAccount = (user?.app_metadata?.provider ?? "email") === "email";
  const displayName = profile?.full_name?.trim() || user?.user_metadata?.full_name || user?.email || "";
  const initials = initialsFrom(displayName || user?.email);

  async function handleSave() {
    if (!user) return;
    const parsed = profileSchema.safeParse({ full_name: fullName, phone, company_name: companyName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your inputs");
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: parsed.data.full_name,
        phone: parsed.data.phone || null,
        company_name: parsed.data.company_name || null,
        updated_at: now,
      });
      if (error) throw error;
      await supabase.auth.updateUser({ data: { full_name: parsed.data.full_name } });
      invalidateProfile();
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  // Avatar upload
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFile(file: File) {
    if (!user) return;
    if (!IMAGE_TYPES.includes(file.type)) return toast.error("Use JPG, PNG, or WEBP");
    if (file.size > MAX_BYTES) return toast.error("Image must be under 5 MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
      if (upErr) throw upErr;

      // Remove any previous avatar objects for this user (best-effort).
      const { data: existing } = await supabase.storage.from("avatars").list(user.id, { limit: 100 });
      const stale = (existing ?? []).map((o) => `${user.id}/${o.name}`).filter((p) => p !== path);
      if (stale.length) await supabase.storage.from("avatars").remove(stale);

      const { error: dbErr } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: path, updated_at: new Date().toISOString() });
      if (dbErr) throw dbErr;
      invalidateProfile();
      toast.success("Profile photo updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    if (!user || !profile?.avatar_url) return;
    setUploading(true);
    try {
      await supabase.storage.from("avatars").remove([profile.avatar_url]);
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: null, updated_at: new Date().toISOString() });
      if (error) throw error;
      invalidateProfile();
      toast.success("Photo removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove photo");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void uploadFile(f);
  }
  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void uploadFile(f);
    e.target.value = "";
  }

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  async function handlePasswordChange() {
    const parsed = passwordSchema.safeParse({ newPassword, confirmPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Password invalid");
      return;
    }
    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword(""); setConfirmPassword("");
      toast.success("Password updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update password");
    } finally {
      setPwSaving(false);
    }
  }

  // Change email
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  async function handleEmailChange() {
    if (!/.+@.+\..+/.test(newEmail)) return toast.error("Enter a valid email");
    setEmailSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      toast.success("Confirmation email sent — check both inboxes to complete the change");
      setNewEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change email");
    } finally {
      setEmailSaving(false);
    }
  }

  const emailVerified = !!user?.email_confirmed_at;
  const lastLogin = user?.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
  const createdAt = user?.created_at ? new Date(user.created_at) : null;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted/30" />
        <div className="h-40 animate-pulse rounded-2xl bg-muted/30" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-primary/10 via-card to-card">
          <CardContent
            className={`flex flex-col items-start gap-5 p-5 sm:flex-row sm:items-center sm:p-6 ${dragOver ? "ring-2 ring-primary/50" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="relative">
              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border border-border/60 bg-gradient-to-br from-primary/25 to-primary/10 text-2xl font-semibold text-primary shadow-lg">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-border/70 bg-background text-primary shadow-md transition hover:scale-105 disabled:opacity-60"
                aria-label="Change profile photo"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                capture="user"
                onChange={onFileChange}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold">{displayName || "Complete your profile"}</h1>
                {emailVerified && (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Verified
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" /> <span className="truncate">{user?.email}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {roles.length
                  ? roles.map((r) => (
                      <Badge key={r} variant="secondary" className="text-[10px]">{ROLE_LABELS[r]}</Badge>
                    ))
                  : <Badge variant="outline" className="text-[10px]">No role assigned</Badge>}
              </div>
              <div className="mt-3 hidden text-xs text-muted-foreground sm:block">
                Drop an image here to change your photo — JPG, PNG or WEBP up to 5 MB
              </div>
            </div>
            <div className="flex gap-2 self-stretch sm:self-center">
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload
              </Button>
              {profile?.avatar_url && (
                <Button variant="ghost" size="sm" onClick={removePhoto} disabled={uploading}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Personal details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Personal details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name" className="text-xs font-medium text-muted-foreground">
              <UserIcon className="mr-1 inline h-3 w-3" /> Full name
            </Label>
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" maxLength={50} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground">
              <Phone className="mr-1 inline h-3 w-3" /> Phone number
            </Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Add phone number" inputMode="tel" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="company_name" className="text-xs font-medium text-muted-foreground">
              <Building2 className="mr-1 inline h-3 w-3" /> Company name
            </Label>
            <Input id="company_name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company (optional)" maxLength={100} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving</> : "Update profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change email */}
      <Card>
        <CardHeader><CardTitle className="text-base">Email address</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Current</div>
            <div className="mt-0.5 flex items-center gap-2 font-medium">
              {user?.email}
              {emailVerified ? (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">Verified</Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/40 text-amber-500">Unverified</Badge>
              )}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input type="email" placeholder="new@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <Button variant="outline" onClick={handleEmailChange} disabled={emailSaving || !newEmail}>
              {emailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change email"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">A confirmation link will be sent to both addresses to complete the change.</p>
        </CardContent>
      </Card>

      {/* Password */}
      {isPasswordAccount && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Change password</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new_pw" className="text-xs text-muted-foreground">New password</Label>
              <Input id="new_pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm_pw" className="text-xs text-muted-foreground">Confirm password</Label>
              <Input id="confirm_pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">Must be 8+ chars with an uppercase letter, a lowercase letter, and a number.</p>
            <div className="sm:col-span-2 flex justify-end">
              <Button onClick={handlePasswordChange} disabled={pwSaving || !newPassword}>
                {pwSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating</> : "Update password"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security & account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Account & security</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Sign-in method" value={provider} />
          <InfoRow label="Email verified" value={emailVerified ? "Yes" : "No"} />
          <InfoRow label="Account created" value={createdAt ? createdAt.toLocaleString() : "—"} />
          <InfoRow
            label="Last sign-in"
            value={lastLogin ? lastLogin.toLocaleString() : "—"}
            icon={<Clock className="h-3.5 w-3.5" />}
          />
        </CardContent>
        <Separator />
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">
            You can only edit your own profile. Row-level security enforces this at the database layer.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
        {icon}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}