
-- 1) New role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'fleet_manager';

-- 2) Company-scoped role enum
DO $$ BEGIN
  CREATE TYPE public.company_role AS ENUM ('owner','manager','driver','broker','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) companies
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gstin text,
  contact_email text,
  contact_phone text,
  address text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 4) company_members
CREATE TABLE IF NOT EXISTS public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.company_role NOT NULL DEFAULT 'viewer',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);
CREATE INDEX IF NOT EXISTS company_members_user_idx ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS company_members_company_idx ON public.company_members(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_companies_updated ON public.companies;
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_company_members_updated ON public.company_members;
CREATE TRIGGER trg_company_members_updated BEFORE UPDATE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Security-definer helpers
CREATE OR REPLACE FUNCTION public.is_company_member(_company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.company_members
    WHERE company_id = _company AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.company_role_of(_company uuid, _user uuid)
RETURNS public.company_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.company_members WHERE company_id = _company AND user_id = _user LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_write_company(_company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.company_members
    WHERE company_id = _company AND user_id = auth.uid()
      AND role IN ('owner','manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.default_company_for(_user uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.company_members
  WHERE user_id = _user
  ORDER BY (role = 'owner') DESC, (role = 'manager') DESC, created_at ASC
  LIMIT 1
$$;

-- 6) Policies for companies + company_members
DROP POLICY IF EXISTS "Members read their company" ON public.companies;
CREATE POLICY "Members read their company" ON public.companies FOR SELECT TO authenticated
  USING (public.is_company_member(id) OR public.current_user_is_admin());

DROP POLICY IF EXISTS "Anyone can create a company" ON public.companies;
CREATE POLICY "Anyone can create a company" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Owners/managers update company" ON public.companies;
CREATE POLICY "Owners/managers update company" ON public.companies FOR UPDATE TO authenticated
  USING (public.can_write_company(id) OR public.current_user_is_admin())
  WITH CHECK (public.can_write_company(id) OR public.current_user_is_admin());

DROP POLICY IF EXISTS "Owners delete company" ON public.companies;
CREATE POLICY "Owners delete company" ON public.companies FOR DELETE TO authenticated
  USING (public.company_role_of(id, auth.uid()) = 'owner' OR public.current_user_is_admin());

DROP POLICY IF EXISTS "Members read own memberships" ON public.company_members;
CREATE POLICY "Members read own memberships" ON public.company_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_company_member(company_id) OR public.current_user_is_admin());

DROP POLICY IF EXISTS "Owners/managers add members" ON public.company_members;
CREATE POLICY "Owners/managers add members" ON public.company_members FOR INSERT TO authenticated
  WITH CHECK (public.can_write_company(company_id) OR public.current_user_is_admin());

DROP POLICY IF EXISTS "Owners/managers update members" ON public.company_members;
CREATE POLICY "Owners/managers update members" ON public.company_members FOR UPDATE TO authenticated
  USING (public.can_write_company(company_id) OR public.current_user_is_admin())
  WITH CHECK (public.can_write_company(company_id) OR public.current_user_is_admin());

DROP POLICY IF EXISTS "Owners/managers remove members" ON public.company_members;
CREATE POLICY "Owners/managers remove members" ON public.company_members FOR DELETE TO authenticated
  USING (public.can_write_company(company_id) OR public.current_user_is_admin() OR user_id = auth.uid());

-- Allow the initial bootstrap: creator inserts themselves as owner right after company creation.
-- Handled by INSERT policy above (they will be owner because can_write_company checks membership).
-- To avoid chicken-and-egg, add a bootstrap policy: creator of company can self-insert as owner.
DROP POLICY IF EXISTS "Bootstrap creator as owner" ON public.company_members;
CREATE POLICY "Bootstrap creator as owner" ON public.company_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.created_by = auth.uid())
  );

-- 7) Add company_id to core tables
ALTER TABLE public.vehicles         ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.drivers          ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.trips            ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.expenses         ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.fuel_logs        ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.maintenance_logs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.documents        ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.alerts           ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.audit_log        ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.driver_scores    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.gps_pings        ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.geofences        ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.geofence_events  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.invoices         ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- 8) Backfill: create one company per owner that has any data, add owner as member, stamp all rows
DO $$
DECLARE
  r RECORD;
  new_company_id uuid;
  fallback_name text;
BEGIN
  FOR r IN
    SELECT DISTINCT owner_id
    FROM (
      SELECT owner_id FROM public.vehicles
      UNION SELECT owner_id FROM public.drivers
      UNION SELECT owner_id FROM public.trips
      UNION SELECT owner_id FROM public.expenses
      UNION SELECT owner_id FROM public.fuel_logs
      UNION SELECT owner_id FROM public.maintenance_logs
      UNION SELECT owner_id FROM public.documents
      UNION SELECT owner_id FROM public.alerts
    ) s
    WHERE owner_id IS NOT NULL
  LOOP
    -- skip if this user already has a company as owner via prior run
    SELECT cm.company_id INTO new_company_id
    FROM public.company_members cm
    WHERE cm.user_id = r.owner_id AND cm.role = 'owner'
    ORDER BY cm.created_at ASC LIMIT 1;

    IF new_company_id IS NULL THEN
      SELECT COALESCE(p.full_name, split_part(u.email, '@', 1), 'My Fleet') INTO fallback_name
      FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = r.owner_id;

      INSERT INTO public.companies (name, created_by)
      VALUES (COALESCE(fallback_name, 'My Fleet') || '''s Fleet', r.owner_id)
      RETURNING id INTO new_company_id;

      INSERT INTO public.company_members (company_id, user_id, role)
      VALUES (new_company_id, r.owner_id, 'owner');
    END IF;

    UPDATE public.vehicles         SET company_id = new_company_id WHERE owner_id = r.owner_id AND company_id IS NULL;
    UPDATE public.drivers          SET company_id = new_company_id WHERE owner_id = r.owner_id AND company_id IS NULL;
    UPDATE public.trips            SET company_id = new_company_id WHERE owner_id = r.owner_id AND company_id IS NULL;
    UPDATE public.expenses         SET company_id = new_company_id WHERE owner_id = r.owner_id AND company_id IS NULL;
    UPDATE public.fuel_logs        SET company_id = new_company_id WHERE owner_id = r.owner_id AND company_id IS NULL;
    UPDATE public.maintenance_logs SET company_id = new_company_id WHERE owner_id = r.owner_id AND company_id IS NULL;
    UPDATE public.documents        SET company_id = new_company_id WHERE owner_id = r.owner_id AND company_id IS NULL;
    UPDATE public.alerts           SET company_id = new_company_id WHERE owner_id = r.owner_id AND company_id IS NULL;
    UPDATE public.driver_scores    SET company_id = new_company_id WHERE owner_id = r.owner_id AND company_id IS NULL;
    UPDATE public.gps_pings        SET company_id = new_company_id WHERE owner_id = r.owner_id AND company_id IS NULL;
    UPDATE public.geofences        SET company_id = new_company_id WHERE owner_id = r.owner_id AND company_id IS NULL;
    UPDATE public.geofence_events  SET company_id = new_company_id WHERE owner_id = r.owner_id AND company_id IS NULL;
    UPDATE public.invoices         SET company_id = new_company_id WHERE owner_id = r.owner_id AND company_id IS NULL;
    UPDATE public.audit_log        SET company_id = new_company_id WHERE actor_id = r.owner_id AND company_id IS NULL;
  END LOOP;
END $$;

-- 9) Auto-stamp company_id on insert if omitted (from owner's default company)
CREATE OR REPLACE FUNCTION public.autoset_company_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    NEW.company_id := public.default_company_for(NEW.owner_id);
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vehicles','drivers','trips','expenses','fuel_logs','maintenance_logs','documents','alerts','driver_scores','gps_pings','geofences','geofence_events','invoices']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_autoset_company ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_autoset_company BEFORE INSERT ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.autoset_company_id()', t);
  END LOOP;
END $$;

-- audit_log uses actor_id, not owner_id
CREATE OR REPLACE FUNCTION public.autoset_audit_company_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.actor_id IS NOT NULL THEN
    NEW.company_id := public.default_company_for(NEW.actor_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_audit_log_autoset_company ON public.audit_log;
CREATE TRIGGER trg_audit_log_autoset_company BEFORE INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.autoset_audit_company_id();

-- 10) Additive RLS: company members can access company-scoped rows
-- (existing owner_id policies remain in force — policies OR together)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vehicles','drivers','trips','expenses','fuel_logs','maintenance_logs','documents','alerts','driver_scores','gps_pings','geofences','geofence_events','invoices']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Company members access" ON public.%1$s', t);
    EXECUTE format(
      'CREATE POLICY "Company members access" ON public.%1$s FOR ALL TO authenticated
        USING (company_id IS NOT NULL AND public.is_company_member(company_id))
        WITH CHECK (company_id IS NOT NULL AND public.can_write_company(company_id))',
      t);
  END LOOP;
END $$;

-- audit_log: company owners/managers can read the whole trail
DROP POLICY IF EXISTS "Company managers read audit" ON public.audit_log;
CREATE POLICY "Company managers read audit" ON public.audit_log FOR SELECT TO authenticated
  USING (company_id IS NOT NULL AND public.can_write_company(company_id));

-- audit_log inserts (system inserts from server functions using service role — but if authenticated inserts happen, allow when actor is self)
DROP POLICY IF EXISTS "Authenticated may insert own audit" ON public.audit_log;
CREATE POLICY "Authenticated may insert own audit" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- 11) Indexes on company_id for performance
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vehicles','drivers','trips','expenses','fuel_logs','maintenance_logs','documents','alerts','audit_log','driver_scores','gps_pings','geofences','geofence_events','invoices']
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %1$s_company_id_idx ON public.%1$s(company_id)', t);
  END LOOP;
END $$;
