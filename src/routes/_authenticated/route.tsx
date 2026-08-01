import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthSplash } from "@/components/common/AuthSplash";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() reads the persisted session from localStorage (and silently
    // refreshes an expired access token), so a returning user is restored
    // without a network round-trip and without seeing the login page.
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      throw redirect({
        to: "/auth",
        search: { next: typeof window !== "undefined" ? window.location.pathname : undefined },
      });
    }
    return { user: data.session.user };
  },
  // Full-screen splash while the persisted session is being restored — never a
  // flash of the login page.
  pendingComponent: () => <AuthSplash />,
  pendingMs: 0,
  component: () => <Outlet />,
});
