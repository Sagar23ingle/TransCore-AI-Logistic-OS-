import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, User, Mail, Shield, BadgeCheck, Sun, Moon, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, initialsFrom } from "@/hooks/use-profile";
import { ROLE_LABELS } from "@/lib/rbac";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({ meta: [{ title: "Settings — TransCore AI" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { profile, avatarUrl } = useProfile();
  const [signingOut, setSigningOut] = useState(false);

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

  const displayName = profile?.full_name?.trim() || user?.email || "";
  const initials = initialsFrom(displayName || user?.email);

  return (
    <AppShell title="Settings" description="Your account, workspace and preferences.">
      {/* Identity hero */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7"
      >
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/60 text-2xl font-black text-primary-foreground shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.6)] ring-4 ring-background">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (initials || <User className="h-8 w-8" />)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
              {displayName || "Your profile"}
            </h2>
            <p className="mt-0.5 flex items-center justify-center gap-1.5 truncate text-sm text-muted-foreground sm:justify-start">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{user?.email}</span>
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {roles.length === 0 ? (
                <span className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  No role
                </span>
              ) : (
                roles.map((r) => (
                  <span
                    key={r}
                    className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium text-primary"
                  >
                    <BadgeCheck className="h-3 w-3" />
                    {ROLE_LABELS[r]}
                  </span>
                ))
              )}
            </div>
            <Link
              to="/profile"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
            >
              <User className="h-3.5 w-3.5" /> Manage profile
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </motion.section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {/* Appearance */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="rounded-3xl border border-border/60 bg-card p-5"
          >
            <SectionHeader icon={theme === "dark" ? Moon : Sun} title="Appearance" hint="Choose your theme." />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["light", "dark"] as const).map((t) => {
                const active = theme === t;
                const Icon = t === "dark" ? Moon : Sun;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={cn(
                      "group relative flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all",
                      active
                        ? "border-primary bg-primary/5 shadow-[0_4px_16px_-6px_hsl(var(--primary)/0.35)]"
                        : "border-border bg-background hover:border-primary/40"
                    )}
                  >
                    <div
                      className={cn(
                        "grid h-10 w-10 place-items-center rounded-xl transition-colors",
                        active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-semibold capitalize">{t}</span>
                  </button>
                );
              })}
            </div>
          </motion.section>

          {/* Roles info */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="rounded-3xl border border-border/60 bg-card p-5"
          >
            <SectionHeader icon={Shield} title="Access & roles" />
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Roles control what you can access across TransCore. Contact the fleet owner or a super admin to change them.
            </p>
          </motion.section>
      </div>

      {/* Danger zone */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="mt-5 overflow-hidden rounded-3xl border border-destructive/30 bg-gradient-to-br from-destructive/5 to-transparent"
      >
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-destructive/10 disabled:opacity-60"
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-destructive/15 text-destructive">
            <LogOut className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-destructive">
              {signingOut ? "Signing out..." : "Sign out"}
            </div>
            <div className="text-xs text-muted-foreground">End your session on this device.</div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-destructive/70" />
        </button>
      </motion.section>
    </AppShell>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
