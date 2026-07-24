
-- Lock down SECURITY DEFINER helpers that should never be callable directly by API roles.
-- Trigger functions: only the trigger fires them
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.autoset_company_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.autoset_audit_company_id() FROM PUBLIC, anon, authenticated;

-- Login-attempt + rate-limit helpers: called only from server-side code via service_role
REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_login_failure(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_login_failures(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_login_lock(text) FROM PUBLIC, anon, authenticated;

-- Ensure service_role retains access
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_login_failure(text, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_login_failures(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_login_lock(text) TO service_role;

-- Deny-all RLS policies on server-only tables so linter is satisfied and no client can read/write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='login_attempts') THEN
    EXECUTE 'CREATE POLICY "no client access" ON public.login_attempts FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rate_limits') THEN
    EXECUTE 'CREATE POLICY "no client access" ON public.rate_limits FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)';
  END IF;
END $$;

-- Belt-and-braces: revoke direct table privileges from client roles
REVOKE ALL ON TABLE public.login_attempts FROM anon, authenticated;
REVOKE ALL ON TABLE public.rate_limits FROM anon, authenticated;
GRANT ALL ON TABLE public.login_attempts TO service_role;
GRANT ALL ON TABLE public.rate_limits TO service_role;
