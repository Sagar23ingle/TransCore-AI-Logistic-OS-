-- Defense-in-depth: revoke SELECT on contact PII columns from anon/authenticated.
-- Server functions already use explicit column allowlists that exclude these,
-- but revoking at the DB level prevents any direct Data API select from leaking
-- broker/owner contact info to browsing users.
REVOKE SELECT (contact_name, contact_phone) ON public.loads FROM anon, authenticated;
REVOKE SELECT (contact_phone) ON public.truck_posts FROM anon, authenticated;

-- Keep service_role able to read everything for admin/maintenance jobs.
GRANT SELECT (contact_name, contact_phone) ON public.loads TO service_role;
GRANT SELECT (contact_phone) ON public.truck_posts TO service_role;