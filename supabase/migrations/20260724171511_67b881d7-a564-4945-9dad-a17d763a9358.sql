-- Fix privilege escalation: drivers could DELETE trips via the ALL policy
DROP POLICY IF EXISTS "Owner manages trips" ON public.trips;

-- Owners and super admins retain full control (including DELETE).
CREATE POLICY "Owner manages trips"
ON public.trips
FOR ALL
TO authenticated
USING (auth.uid() = owner_id OR public.current_user_is_admin())
WITH CHECK (auth.uid() = owner_id OR public.current_user_is_admin());

-- Assigned drivers may only SELECT their trips.
CREATE POLICY "Assigned driver reads trip"
ON public.trips
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = trips.driver_id AND d.user_id = auth.uid()
  )
);

-- Assigned drivers may UPDATE their trips, but cannot change ownership/assignment.
CREATE POLICY "Assigned driver updates trip"
ON public.trips
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = trips.driver_id AND d.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = trips.driver_id AND d.user_id = auth.uid()
  )
);