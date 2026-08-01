/**
 * Synchronous, best-effort check for a persisted Supabase session in
 * localStorage. Used to decide *before first paint* whether to show the splash
 * instead of the Login / landing page. The real validation still happens via
 * supabase.auth.getSession() / onAuthStateChange.
 */
export function hasStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
    if (projectId) {
      const raw = window.localStorage.getItem(`sb-${projectId}-auth-token`);
      if (raw) return true;
    }
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) return true;
    }
    return false;
  } catch {
    return false;
  }
}
