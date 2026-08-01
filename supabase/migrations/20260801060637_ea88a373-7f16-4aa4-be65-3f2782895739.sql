-- 1) Drivers: restrict company-wide read of driver PII to owner/manager roles.
DROP POLICY IF EXISTS "Company members access" ON public.drivers;

CREATE POLICY "Managers read company drivers"
  ON public.drivers FOR SELECT TO authenticated
  USING (company_id IS NOT NULL AND public.can_write_company(company_id));

CREATE POLICY "Managers insert company drivers"
  ON public.drivers FOR INSERT TO authenticated
  WITH CHECK (company_id IS NOT NULL AND public.can_write_company(company_id));

CREATE POLICY "Managers update company drivers"
  ON public.drivers FOR UPDATE TO authenticated
  USING (company_id IS NOT NULL AND public.can_write_company(company_id))
  WITH CHECK (company_id IS NOT NULL AND public.can_write_company(company_id));

CREATE POLICY "Managers delete company drivers"
  ON public.drivers FOR DELETE TO authenticated
  USING (company_id IS NOT NULL AND public.can_write_company(company_id));

-- 2) Companies: hide sensitive contact columns from plain members via column privileges.
REVOKE SELECT (gstin, contact_email, contact_phone, address) ON public.companies FROM authenticated;
REVOKE SELECT (gstin, contact_email, contact_phone, address) ON public.companies FROM anon;

CREATE OR REPLACE FUNCTION public.company_contact(_company uuid)
RETURNS TABLE(id uuid, gstin text, contact_email text, contact_phone text, address text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.gstin, c.contact_email, c.contact_phone, c.address
  FROM public.companies c
  WHERE c.id = _company
    AND (public.can_write_company(c.id) OR public.current_user_is_admin())
$$;

REVOKE ALL ON FUNCTION public.company_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_contact(uuid) TO authenticated;