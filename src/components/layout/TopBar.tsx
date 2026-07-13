import { useNavigate } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS } from "@/lib/rbac";

export function TopBar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, roles } = useAuth();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const email = user?.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-3 border-b border-border bg-background/70 px-4 backdrop-blur sm:px-6 lg:px-8">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
              {initials || <User className="h-4 w-4" />}
            </span>
            <span className="hidden max-w-[140px] truncate text-sm sm:inline">{email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="text-sm font-medium">{email}</div>
            <div className="text-xs text-muted-foreground">
              {roles.length ? roles.map((r) => ROLE_LABELS[r]).join(", ") : "No role"}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
