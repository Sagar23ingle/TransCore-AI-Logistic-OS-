-- Restrict company_members write policies to authenticated role
DROP POLICY IF EXISTS "Owners/managers add members" ON public.company_members;
DROP POLICY IF EXISTS "Owners/managers update members" ON public.company_members;

CREATE POLICY "Owners/managers add members"
ON public.company_members
FOR INSERT
TO authenticated
WITH CHECK (
  (can_write_company(company_id) OR current_user_is_admin())
  AND ((role <> 'owner'::company_role) OR is_company_owner(company_id) OR current_user_is_admin())
);

CREATE POLICY "Owners/managers update members"
ON public.company_members
FOR UPDATE
TO authenticated
USING (can_write_company(company_id) OR current_user_is_admin())
WITH CHECK (
  (can_write_company(company_id) OR current_user_is_admin())
  AND ((role <> 'owner'::company_role) OR is_company_owner(company_id) OR current_user_is_admin())
);

-- Tighten live_locations SELECT: only self, admins, or owners/managers of a shared company
DROP POLICY IF EXISTS "Company members can view live locations" ON public.live_locations;

CREATE POLICY "Owners and managers view live locations"
ON public.live_locations
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR current_user_is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.company_members cm_self
    JOIN public.company_members cm_target
      ON cm_target.company_id = cm_self.company_id
    WHERE cm_self.user_id = auth.uid()
      AND cm_self.role IN ('owner','manager')
      AND cm_target.user_id = live_locations.user_id
  )
);