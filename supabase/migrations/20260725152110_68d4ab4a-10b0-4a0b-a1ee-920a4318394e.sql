
CREATE OR REPLACE FUNCTION public.is_company_owner(_company uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.company_members
    WHERE company_id = _company AND user_id = auth.uid() AND role = 'owner'
  )
$$;

DROP POLICY IF EXISTS "Owners/managers add members" ON public.company_members;
CREATE POLICY "Owners/managers add members"
ON public.company_members
FOR INSERT
WITH CHECK (
  (
    (public.can_write_company(company_id) OR public.current_user_is_admin())
    AND (role <> 'owner' OR public.is_company_owner(company_id) OR public.current_user_is_admin())
  )
);

DROP POLICY IF EXISTS "Owners/managers update members" ON public.company_members;
CREATE POLICY "Owners/managers update members"
ON public.company_members
FOR UPDATE
USING (public.can_write_company(company_id) OR public.current_user_is_admin())
WITH CHECK (
  (public.can_write_company(company_id) OR public.current_user_is_admin())
  AND (role <> 'owner' OR public.is_company_owner(company_id) OR public.current_user_is_admin())
);
