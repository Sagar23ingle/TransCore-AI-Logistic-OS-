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

// Roles change extremely rarely. Caching them in localStorage lets the app
// render the correct RBAC surface on cold load without waiting on a network
// round-trip; a background refresh keeps them in sync.
const ROLE_CACHE_PREFIX = "tc:roles:";
function readCachedRoles(userId: string): AppRole[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ROLE_CACHE_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AppRole[]) : null;
  } catch { return null; }
}
function writeCachedRoles(userId: string, roles: AppRole[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(ROLE_CACHE_PREFIX + userId, JSON.stringify(roles)); } catch { /* quota */ }
}

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
      const roles = data.map((r) => r.role as AppRole);
      writeCachedRoles(userId, roles);
      return roles;
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

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data.session;
      const uid = session?.user?.id ?? null;
      lastRoleUserId = uid;
      // Render immediately with cached roles (empty if none) — then refresh
      // in the background. Avoids blocking first paint on the roles query.
      const cached = uid ? readCachedRoles(uid) ?? [] : [];
      setState({ ready: true, session, user: session?.user ?? null, roles: cached });
      if (uid) {
        loadRoles(uid).then((roles) => {
          if (!mounted) return;
          // Only update state if roles actually changed, to avoid re-renders.
          const same = roles.length === cached.length && roles.every((r, i) => r === cached[i]);
          if (!same) setState((s) => ({ ...s, roles }));
        });
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
