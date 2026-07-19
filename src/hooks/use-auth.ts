import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/rbac";

export interface AuthState {
  ready: boolean;
  session: Session | null;
  user: User | null;
  roles: AppRole[];
}

const AuthContext = createContext<AuthState | null>(null);

function useAuthInternal(): AuthState {
  const [state, setState] = useState<AuthState>({
    ready: false,
    session: null,
    user: null,
    roles: [],
  });

  useEffect(() => {
    let mounted = true;
    let lastRoleUserId: string | null = null;

    async function loadRoles(userId: string): Promise<AppRole[]> {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (error || !data) return [];
      return data.map((r) => r.role as AppRole);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState((s) => ({ ...s, session, user: session?.user ?? null }));
      const uid = session?.user?.id ?? null;
      // Only refetch roles when the user identity actually changes.
      // Otherwise TOKEN_REFRESHED / USER_UPDATED events spam the roles endpoint.
      if (uid && uid !== lastRoleUserId) {
        lastRoleUserId = uid;
        loadRoles(uid).then((roles) => {
          if (mounted) setState((s) => ({ ...s, roles }));
        });
      } else if (!uid) {
        lastRoleUserId = null;
        setState((s) => ({ ...s, roles: [] }));
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const session = data.session;
      const uid = session?.user?.id ?? null;
      const roles = uid ? await loadRoles(uid) : [];
      lastRoleUserId = uid;
      if (mounted) {
        setState({ ready: true, session, user: session?.user ?? null, roles });
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useAuthInternal();
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  // Fallback: standalone usage (e.g. outside provider during tests)
  return useAuthInternal();
}
