-- Rate limit primitive (fixed-window counter) used by AI + public webhooks
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role and SECURITY DEFINER functions may touch it.

CREATE INDEX IF NOT EXISTS rate_limits_window_start_idx ON public.rate_limits(window_start);

-- Atomic increment + check. Returns TRUE if the caller is within the budget, FALSE if over.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _key text,
  _max integer,
  _window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bucket timestamptz;
  _current integer;
BEGIN
  _bucket := date_trunc('second',
    to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds));

  INSERT INTO public.rate_limits(key, window_start, count)
  VALUES (_key, _bucket, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO _current;

  -- Best-effort cleanup of old buckets (cheap, indexed).
  DELETE FROM public.rate_limits
    WHERE window_start < now() - interval '1 day';

  RETURN _current <= _max;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO authenticated, service_role;
