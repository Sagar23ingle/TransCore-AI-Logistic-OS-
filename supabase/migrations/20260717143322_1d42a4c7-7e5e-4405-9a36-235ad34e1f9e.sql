
REVOKE EXECUTE ON FUNCTION public.current_user_is_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_write_company(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.company_role_of(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.default_company_for(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.haversine_km(double precision, double precision, double precision, double precision) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.autoset_company_id() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.autoset_audit_company_id() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, public, authenticated;

GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_role_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_company_for(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.haversine_km(double precision, double precision, double precision, double precision) TO authenticated;
