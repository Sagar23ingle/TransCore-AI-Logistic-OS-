import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/rbac";

export interface AuthState {
  ready: boolean;
  session: Session | null;
  user: User | null;
  roles: AppRole[];
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    ready: false,
    session: null,
    user: null,
    roles: [],
  });

  useEffect(() => {
    let mounted = true;

    async function loadRoles(userId: string): Promise<AppRole[]> {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (error || !data) return [];
      return data.map((r) => r.role as AppRole);
    }

    // Subscribe first, then hydrate
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState((s) => ({ ...s, session, user: session?.user ?? null }));
      if (session?.user) {
        loadRoles(session.user.id).then((roles) => {
          if (mounted) setState((s) => ({ ...s, roles }));
        });
      } else {
        setState((s) => ({ ...s, roles: [] }));
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const session = data.session;
      const roles = session?.user ? await loadRoles(session.user.id) : [];
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
