-- Drop the definer views (linter ERROR 0010)
DROP VIEW IF EXISTS public.loads_marketplace;
DROP VIEW IF EXISTS public.truck_posts_marketplace;

-- Restore browse policies so signed-in users can list open loads / active trucks (non-contact columns only)
CREATE POLICY "Signed-in users browse open loads"
  ON public.loads FOR SELECT
  TO authenticated
  USING (
    status = ANY (ARRAY['open'::public.load_status, 'assigned'::public.load_status, 'in_transit'::public.load_status])
    OR auth.uid() = broker_id
    OR auth.uid() = assigned_owner_id
  );

CREATE POLICY "Signed-in users browse active trucks"
  ON public.truck_posts FOR SELECT
  TO authenticated
  USING (is_active = true OR auth.uid() = owner_id);

-- Column-level protection: contact fields are unreadable by any signed-in user via direct SELECT.
-- INSERT/UPDATE of these columns remains available (via row policies) so brokers/owners can post them.
REVOKE SELECT (contact_name, contact_phone) ON public.loads FROM authenticated;
REVOKE SELECT (contact_phone) ON public.truck_posts FROM authenticated;

-- Keep service_role able to read everything (admin server code, cron scanners)
GRANT SELECT (contact_name, contact_phone) ON public.loads TO service_role;
GRANT SELECT (contact_phone) ON public.truck_posts TO service_role;