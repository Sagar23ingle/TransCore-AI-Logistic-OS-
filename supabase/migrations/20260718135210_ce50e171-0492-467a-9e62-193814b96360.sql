DROP POLICY IF EXISTS "Authenticated can view live locations" ON public.live_locations;

CREATE POLICY "Company members can view live locations"
ON public.live_locations
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.current_user_is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.company_members cm_self
    JOIN public.company_members cm_target
      ON cm_target.company_id = cm_self.company_id
    WHERE cm_self.user_id = auth.uid()
      AND cm_target.user_id = public.live_locations.user_id
  )
);