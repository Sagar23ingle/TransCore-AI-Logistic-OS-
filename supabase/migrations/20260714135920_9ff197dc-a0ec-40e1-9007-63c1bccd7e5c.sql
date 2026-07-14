-- =========================================================================
-- WAVE 1: Real platform schema for TransCore AI
-- =========================================================================

-- ---- Enums --------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.load_status AS ENUM ('open', 'assigned', 'in_transit', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.match_status AS ENUM ('suggested', 'offered', 'accepted', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'paid', 'void', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.geofence_event_type AS ENUM ('enter', 'exit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Trip: cached position + odometer readings --------------------------
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS current_lat numeric(10,7),
  ADD COLUMN IF NOT EXISTS current_lng numeric(10,7),
  ADD COLUMN IF NOT EXISTS last_ping_at timestamptz,
  ADD COLUMN IF NOT EXISTS start_odometer_km numeric(12,2),
  ADD COLUMN IF NOT EXISTS end_odometer_km numeric(12,2);

-- ---- Geofences ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geofences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  center_lat numeric(10,7) NOT NULL,
  center_lng numeric(10,7) NOT NULL,
  radius_m integer NOT NULL CHECK (radius_m > 0 AND radius_m <= 100000),
  color text NOT NULL DEFAULT '#22D3EE',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geofences_owner_idx ON public.geofences(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geofences TO authenticated;
GRANT ALL ON public.geofences TO service_role;
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages geofences" ON public.geofences FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.current_user_is_admin());
CREATE TRIGGER trg_geofences_updated BEFORE UPDATE ON public.geofences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.geofence_events (
  id bigserial PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  geofence_id uuid NOT NULL REFERENCES public.geofences(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  event_type public.geofence_event_type NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geofence_events_owner_idx ON public.geofence_events(owner_id, recorded_at DESC);
GRANT SELECT, INSERT ON public.geofence_events TO authenticated;
GRANT ALL ON public.geofence_events TO service_role;
ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads geofence events" ON public.geofence_events FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.current_user_is_admin());
CREATE POLICY "Owner inserts geofence events" ON public.geofence_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- ---- Fuel logs ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fuel_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  filled_on date NOT NULL DEFAULT CURRENT_DATE,
  odometer_km numeric(12,2) NOT NULL CHECK (odometer_km >= 0),
  litres numeric(10,3) NOT NULL CHECK (litres > 0),
  price_per_litre numeric(10,2) NOT NULL CHECK (price_per_litre > 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  station text,
  is_full_tank boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fuel_logs_owner_idx ON public.fuel_logs(owner_id, filled_on DESC);
CREATE INDEX IF NOT EXISTS fuel_logs_vehicle_idx ON public.fuel_logs(vehicle_id, filled_on DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_logs TO authenticated;
GRANT ALL ON public.fuel_logs TO service_role;
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages fuel_logs" ON public.fuel_logs FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.current_user_is_admin());
CREATE TRIGGER trg_fuel_logs_updated BEFORE UPDATE ON public.fuel_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- Maintenance logs ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  serviced_on date NOT NULL DEFAULT CURRENT_DATE,
  service_type text NOT NULL,
  odometer_km numeric(12,2),
  cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  vendor text,
  next_service_due_on date,
  next_service_due_km numeric(12,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maintenance_logs_owner_idx ON public.maintenance_logs(owner_id, serviced_on DESC);
CREATE INDEX IF NOT EXISTS maintenance_logs_vehicle_idx ON public.maintenance_logs(vehicle_id, serviced_on DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_logs TO authenticated;
GRANT ALL ON public.maintenance_logs TO service_role;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages maintenance_logs" ON public.maintenance_logs FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.current_user_is_admin());
CREATE TRIGGER trg_maintenance_logs_updated BEFORE UPDATE ON public.maintenance_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- Driver scores ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  trips_completed integer NOT NULL DEFAULT 0,
  trips_delayed integer NOT NULL DEFAULT 0,
  avg_speed_kmh numeric(6,2),
  max_speed_kmh numeric(6,2),
  speed_violations integer NOT NULL DEFAULT 0,
  fuel_efficiency_kmpl numeric(6,2),
  distance_km numeric(12,2) NOT NULL DEFAULT 0,
  safety_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (safety_score BETWEEN 0 AND 100),
  performance_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (performance_score BETWEEN 0 AND 100),
  overall_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS driver_scores_owner_idx ON public.driver_scores(owner_id, computed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_scores TO authenticated;
GRANT ALL ON public.driver_scores TO service_role;
ALTER TABLE public.driver_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages driver_scores" ON public.driver_scores FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.current_user_is_admin());

-- ---- Marketplace: loads -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  origin text NOT NULL,
  origin_lat numeric(10,7),
  origin_lng numeric(10,7),
  destination text NOT NULL,
  destination_lat numeric(10,7),
  destination_lng numeric(10,7),
  distance_km numeric(12,2),
  goods_type text NOT NULL,
  weight_tons numeric(10,2) NOT NULL CHECK (weight_tons > 0),
  vehicle_type text NOT NULL,
  pickup_at timestamptz NOT NULL,
  delivery_by timestamptz,
  budget_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (budget_amount >= 0),
  contact_name text,
  contact_phone text,
  notes text,
  status public.load_status NOT NULL DEFAULT 'open',
  assigned_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loads_broker_idx ON public.loads(broker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS loads_status_idx ON public.loads(status, pickup_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loads TO authenticated;
GRANT ALL ON public.loads TO service_role;
ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Broker manages own loads" ON public.loads FOR ALL TO authenticated
  USING (auth.uid() = broker_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = broker_id OR public.current_user_is_admin());
CREATE POLICY "Signed-in users browse open loads" ON public.loads FOR SELECT TO authenticated
  USING (status IN ('open','assigned','in_transit') OR auth.uid() = broker_id OR auth.uid() = assigned_owner_id);
CREATE POLICY "Assigned owner reads accepted load" ON public.loads FOR SELECT TO authenticated
  USING (auth.uid() = assigned_owner_id);
CREATE TRIGGER trg_loads_updated BEFORE UPDATE ON public.loads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- Marketplace: truck_posts ------------------------------------------
CREATE TABLE IF NOT EXISTS public.truck_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  from_location text NOT NULL,
  from_lat numeric(10,7),
  from_lng numeric(10,7),
  to_location text,
  to_lat numeric(10,7),
  to_lng numeric(10,7),
  vehicle_type text NOT NULL,
  capacity_tons numeric(10,2) NOT NULL CHECK (capacity_tons > 0),
  available_from timestamptz NOT NULL,
  expected_rate numeric(12,2),
  contact_phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS truck_posts_owner_idx ON public.truck_posts(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS truck_posts_active_idx ON public.truck_posts(is_active, available_from);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.truck_posts TO authenticated;
GRANT ALL ON public.truck_posts TO service_role;
ALTER TABLE public.truck_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages truck_posts" ON public.truck_posts FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.current_user_is_admin());
CREATE POLICY "Signed-in users browse active trucks" ON public.truck_posts FOR SELECT TO authenticated
  USING (is_active = true OR auth.uid() = owner_id);
CREATE TRIGGER trg_truck_posts_updated BEFORE UPDATE ON public.truck_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- Marketplace: bids + matches ---------------------------------------
CREATE TABLE IF NOT EXISTS public.load_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  bidder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bid_amount numeric(12,2) NOT NULL CHECK (bid_amount > 0),
  message text,
  status public.match_status NOT NULL DEFAULT 'offered',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (load_id, bidder_id)
);
CREATE INDEX IF NOT EXISTS load_bids_load_idx ON public.load_bids(load_id);
CREATE INDEX IF NOT EXISTS load_bids_bidder_idx ON public.load_bids(bidder_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.load_bids TO authenticated;
GRANT ALL ON public.load_bids TO service_role;
ALTER TABLE public.load_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bidder manages own bid" ON public.load_bids FOR ALL TO authenticated
  USING (auth.uid() = bidder_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = bidder_id);
CREATE POLICY "Broker reads bids on own loads" ON public.load_bids FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loads l WHERE l.id = load_bids.load_id AND l.broker_id = auth.uid()));
CREATE POLICY "Broker updates bids on own loads" ON public.load_bids FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loads l WHERE l.id = load_bids.load_id AND l.broker_id = auth.uid()));
CREATE TRIGGER trg_load_bids_updated BEFORE UPDATE ON public.load_bids FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- Plans / Invoices / Transactions -----------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_inr integer NOT NULL DEFAULT 0,
  interval text NOT NULL DEFAULT 'month',
  vehicle_limit integer NOT NULL DEFAULT 2,
  ai_monthly_limit integer NOT NULL DEFAULT 20,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans readable to signed-in users" ON public.plans FOR SELECT TO authenticated USING (true);

INSERT INTO public.plans (id, name, price_inr, interval, vehicle_limit, ai_monthly_limit, features, sort_order) VALUES
  ('free',        'Free',         0,     'month', 2,   20,  '["Up to 2 vehicles","Document vault (100 MB)","Basic alerts"]'::jsonb, 1),
  ('starter',     'Starter',      499,   'month', 10,  200, '["Up to 10 vehicles","Live tracking","AI insights (200/mo)","Marketplace access"]'::jsonb, 2),
  ('professional','Professional', 1499,  'month', 50,  2000,'["Up to 50 vehicles","Unlimited live tracking","Advanced analytics","Priority support"]'::jsonb, 3),
  ('enterprise',  'Enterprise',   4999,  'month', 999, 999999, '["Unlimited vehicles","Custom integrations","Dedicated success","SLA"]'::jsonb, 4)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, price_inr = EXCLUDED.price_inr, vehicle_limit = EXCLUDED.vehicle_limit,
  ai_monthly_limit = EXCLUDED.ai_monthly_limit, features = EXCLUDED.features;

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  plan_id text REFERENCES public.plans(id),
  amount_inr numeric(12,2) NOT NULL CHECK (amount_inr >= 0),
  gst_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  status public.invoice_status NOT NULL DEFAULT 'draft',
  issued_at timestamptz,
  paid_at timestamptz,
  period_start date,
  period_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_owner_idx ON public.invoices(owner_id, created_at DESC);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads invoices" ON public.invoices FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.current_user_is_admin());
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'razorpay',
  provider_payment_id text,
  provider_order_id text,
  amount_inr numeric(12,2) NOT NULL CHECK (amount_inr >= 0),
  status text NOT NULL,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pt_owner_idx ON public.payment_transactions(owner_id, created_at DESC);
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads transactions" ON public.payment_transactions FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.current_user_is_admin());

-- ---- Audit log ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  entity_id text,
  metadata jsonb,
  ip text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON public.audit_log(actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON public.audit_log(action, occurred_at DESC);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Actor reads own audit rows" ON public.audit_log FOR SELECT TO authenticated
  USING (auth.uid() = actor_id OR public.current_user_is_admin());

-- ---- Push subscriptions -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subs_user_idx ON public.push_subscriptions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User manages own push subs" ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---- Alert prefs --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alert_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  document_expiry boolean NOT NULL DEFAULT true,
  emi_reminders boolean NOT NULL DEFAULT true,
  maintenance boolean NOT NULL DEFAULT true,
  trip_updates boolean NOT NULL DEFAULT true,
  marketplace_matches boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_prefs TO authenticated;
GRANT ALL ON public.alert_prefs TO service_role;
ALTER TABLE public.alert_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User manages own alert_prefs" ON public.alert_prefs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---- Realtime -----------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.gps_pings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.loads;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Helper: haversine (km) --------------------------------------------
CREATE OR REPLACE FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision
LANGUAGE sql IMMUTABLE
AS $$
  SELECT 6371 * 2 * asin(sqrt(
    power(sin(radians((lat2 - lat1) / 2)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians((lng2 - lng1) / 2)), 2)
  ));
$$;
