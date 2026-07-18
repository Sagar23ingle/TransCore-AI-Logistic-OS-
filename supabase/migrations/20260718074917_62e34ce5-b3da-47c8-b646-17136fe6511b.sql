DROP POLICY IF EXISTS "Signed-in users browse open loads" ON public.loads;
DROP POLICY IF EXISTS "Signed-in users browse active trucks" ON public.truck_posts;

CREATE OR REPLACE VIEW public.loads_marketplace
WITH (security_invoker=off) AS
SELECT
  id, broker_id, assigned_owner_id, assigned_vehicle_id, title,
  origin, origin_lat, origin_lng,
  destination, destination_lat, destination_lng,
  distance_km, goods_type, weight_tons, vehicle_type,
  pickup_at, delivery_by, budget_amount, notes, status,
  created_at, updated_at
FROM public.loads
WHERE status IN ('open'::public.load_status, 'assigned'::public.load_status, 'in_transit'::public.load_status);

CREATE OR REPLACE VIEW public.truck_posts_marketplace
WITH (security_invoker=off) AS
SELECT
  id, owner_id, vehicle_id,
  from_location, from_lat, from_lng,
  to_location, to_lat, to_lng,
  vehicle_type, capacity_tons, available_from,
  expected_rate, notes, is_active,
  created_at, updated_at
FROM public.truck_posts
WHERE is_active = true;

REVOKE ALL ON public.loads_marketplace FROM PUBLIC, anon;
REVOKE ALL ON public.truck_posts_marketplace FROM PUBLIC, anon;
GRANT SELECT ON public.loads_marketplace TO authenticated;
GRANT SELECT ON public.truck_posts_marketplace TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.autoset_company_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.autoset_audit_company_id() FROM PUBLIC, anon, authenticated;