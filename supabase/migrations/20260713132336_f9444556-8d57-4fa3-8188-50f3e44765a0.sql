
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('super_admin','fleet_owner','driver','broker');
CREATE TYPE public.vehicle_type AS ENUM ('truck','trailer','tanker','container','pickup','other');
CREATE TYPE public.vehicle_status AS ENUM ('active','maintenance','inactive');
CREATE TYPE public.driver_status AS ENUM ('active','on_leave','inactive');
CREATE TYPE public.trip_status AS ENUM ('planned','in_progress','completed','cancelled');
CREATE TYPE public.document_type AS ENUM ('rc','insurance','permit','fitness','puc','driving_license','vehicle_photo','other');
CREATE TYPE public.expense_category AS ENUM ('fuel','toll','maintenance','driver_allowance','loading','unloading','other');
CREATE TYPE public.alert_severity AS ENUM ('info','warning','critical');
CREATE TYPE public.subscription_plan AS ENUM ('free','starter','professional','enterprise');
CREATE TYPE public.subscription_status AS ENUM ('active','cancelled','past_due','trialing');

-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  company_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================
-- USER ROLES (separate table — critical for security)
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'super_admin'::public.app_role) $$;

-- Profiles policies (after has_role exists)
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.current_user_is_admin());
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.current_user_is_admin());
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin());

-- =========================
-- Auto-provision profile + default role on signup
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'fleet_owner'::public.app_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- Generic updated_at trigger
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================
-- VEHICLES
-- =========================
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registration_number TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INT,
  vehicle_type public.vehicle_type NOT NULL DEFAULT 'truck',
  status public.vehicle_status NOT NULL DEFAULT 'active',
  capacity_tons NUMERIC(10,2),
  odometer_km NUMERIC(12,2) DEFAULT 0,
  fuel_type TEXT,
  insurance_expiry DATE,
  permit_expiry DATE,
  fitness_expiry DATE,
  puc_expiry DATE,
  emi_next_due DATE,
  maintenance_next_due DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, registration_number)
);
CREATE INDEX ON public.vehicles(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages vehicles" ON public.vehicles FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.current_user_is_admin());
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- DRIVERS
-- =========================
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  license_number TEXT,
  license_expiry DATE,
  address TEXT,
  status public.driver_status NOT NULL DEFAULT 'active',
  monthly_salary NUMERIC(12,2),
  joined_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.drivers(owner_id);
CREATE INDEX ON public.drivers(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages drivers" ON public.drivers FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = user_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.current_user_is_admin());
CREATE TRIGGER trg_drivers_updated BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- TRIPS
-- =========================
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  origin_lat NUMERIC(10,7),
  origin_lng NUMERIC(10,7),
  destination_lat NUMERIC(10,7),
  destination_lng NUMERIC(10,7),
  status public.trip_status NOT NULL DEFAULT 'planned',
  scheduled_start TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  distance_km NUMERIC(12,2),
  freight_amount NUMERIC(12,2) DEFAULT 0,
  advance_paid NUMERIC(12,2) DEFAULT 0,
  goods_description TEXT,
  client_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.trips(owner_id);
CREATE INDEX ON public.trips(vehicle_id);
CREATE INDEX ON public.trips(driver_id);
CREATE INDEX ON public.trips(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages trips" ON public.trips FOR ALL TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.current_user_is_admin()
    OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = trips.driver_id AND d.user_id = auth.uid())
  )
  WITH CHECK (auth.uid() = owner_id OR public.current_user_is_admin());
CREATE TRIGGER trg_trips_updated BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- EXPENSES
-- =========================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  category public.expense_category NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  incurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  receipt_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.expenses(owner_id);
CREATE INDEX ON public.expenses(trip_id);
CREATE INDEX ON public.expenses(vehicle_id);
CREATE INDEX ON public.expenses(incurred_on);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages expenses" ON public.expenses FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.current_user_is_admin());
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- DOCUMENTS
-- =========================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
  doc_type public.document_type NOT NULL,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  issued_on DATE,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.documents(owner_id);
CREATE INDEX ON public.documents(vehicle_id);
CREATE INDEX ON public.documents(driver_id);
CREATE INDEX ON public.documents(expiry_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages documents" ON public.documents FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.current_user_is_admin());
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- GPS PINGS
-- =========================
CREATE TABLE public.gps_pings (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  speed_kmh NUMERIC(6,2),
  heading NUMERIC(5,2),
  accuracy_m NUMERIC(8,2),
  source TEXT NOT NULL DEFAULT 'browser',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.gps_pings(vehicle_id, recorded_at DESC);
CREATE INDEX ON public.gps_pings(owner_id, recorded_at DESC);
GRANT SELECT, INSERT ON public.gps_pings TO authenticated;
GRANT ALL ON public.gps_pings TO service_role;
ALTER TABLE public.gps_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads gps" ON public.gps_pings FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.current_user_is_admin());
CREATE POLICY "Owner or driver inserts gps" ON public.gps_pings FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.owner_id = gps_pings.owner_id)
  );

-- =========================
-- ALERTS
-- =========================
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,               -- e.g. insurance_expiry, permit_expiry, license_expiry, emi_due, maintenance_due
  severity public.alert_severity NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  due_date DATE,
  days_remaining INT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  dedup_key TEXT NOT NULL,          -- unique per (owner, kind, target, bucket) to prevent duplicates
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, dedup_key)
);
CREATE INDEX ON public.alerts(owner_id, is_dismissed, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages alerts" ON public.alerts FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.current_user_is_admin());

-- =========================
-- SUBSCRIPTIONS
-- =========================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL DEFAULT 'free',
  status public.subscription_status NOT NULL DEFAULT 'active',
  razorpay_subscription_id TEXT,
  razorpay_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads subscription" ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.current_user_is_admin());
CREATE POLICY "Admins manage subscriptions" ON public.subscriptions FOR ALL TO authenticated
  USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin());
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- AI REQUESTS (audit + usage tracking)
-- =========================
CREATE TABLE public.ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  prompt TEXT,
  response TEXT,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  error TEXT,
  tokens_in INT,
  tokens_out INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.ai_requests(owner_id, created_at DESC);
GRANT SELECT ON public.ai_requests TO authenticated;
GRANT ALL ON public.ai_requests TO service_role;
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads ai requests" ON public.ai_requests FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.current_user_is_admin());

-- =========================
-- ANALYTICS EVENTS + ERROR REPORTS
-- =========================
CREATE TABLE public.analytics_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.analytics_events(event, created_at DESC);
GRANT INSERT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own events" ON public.analytics_events FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Admins read events" ON public.analytics_events FOR SELECT TO authenticated
  USING (public.current_user_is_admin());

CREATE TABLE public.error_reports (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.error_reports TO authenticated;
GRANT ALL ON public.error_reports TO service_role;
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own errors" ON public.error_reports FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Admins read errors" ON public.error_reports FOR SELECT TO authenticated
  USING (public.current_user_is_admin());
