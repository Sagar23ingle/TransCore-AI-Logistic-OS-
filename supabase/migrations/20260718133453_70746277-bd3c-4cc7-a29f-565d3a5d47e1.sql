
CREATE TABLE public.live_locations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  speed_kmh double precision,
  heading double precision,
  accuracy_m double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_locations TO authenticated;
GRANT ALL ON public.live_locations TO service_role;

ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can view live positions (fleet dashboard).
CREATE POLICY "Authenticated can view live locations"
  ON public.live_locations FOR SELECT
  TO authenticated USING (true);

-- A driver can only upsert their own row.
CREATE POLICY "Driver can insert own live location"
  ON public.live_locations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Driver can update own live location"
  ON public.live_locations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Driver can delete own live location"
  ON public.live_locations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX live_locations_updated_at_idx ON public.live_locations (updated_at DESC);

-- Realtime: stream INSERT/UPDATE/DELETE to subscribed clients.
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_locations;
ALTER TABLE public.live_locations REPLICA IDENTITY FULL;
