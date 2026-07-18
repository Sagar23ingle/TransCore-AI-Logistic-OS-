
CREATE TABLE public.fleet_insights_cache (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  insights jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fleet_insights_cache TO authenticated;
GRANT ALL ON public.fleet_insights_cache TO service_role;
ALTER TABLE public.fleet_insights_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own insights cache" ON public.fleet_insights_cache
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
