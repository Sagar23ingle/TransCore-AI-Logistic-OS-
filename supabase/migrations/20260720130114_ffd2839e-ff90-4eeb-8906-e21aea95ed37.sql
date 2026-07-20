
CREATE TABLE public.login_attempts (
  email text PRIMARY KEY,
  fail_count integer NOT NULL DEFAULT 0,
  last_failure_at timestamptz,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No grants to anon/authenticated: only service_role (server functions) touches this.
GRANT ALL ON public.login_attempts TO service_role;

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- No policies = fully locked to end users; service_role bypasses RLS.

CREATE INDEX idx_login_attempts_locked_until ON public.login_attempts(locked_until)
  WHERE locked_until IS NOT NULL;

-- Returns { fail_count, locked_until } for a given email, or defaults.
CREATE OR REPLACE FUNCTION public.get_login_lock(_email text)
RETURNS TABLE(fail_count integer, locked_until timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(la.fail_count, 0), la.locked_until
  FROM (SELECT 1) x
  LEFT JOIN public.login_attempts la ON la.email = lower(trim(_email))
$$;

-- Atomically record a failed attempt. Auto-locks for _lock_minutes after
-- _lock_threshold consecutive failures. Also resets the counter if the
-- previous failure is older than _reset_after_minutes (stale streak).
-- Returns the new fail_count and locked_until (if any).
CREATE OR REPLACE FUNCTION public.record_login_failure(
  _email text,
  _lock_threshold integer DEFAULT 10,
  _lock_minutes integer DEFAULT 15,
  _reset_after_minutes integer DEFAULT 60
) RETURNS TABLE(fail_count integer, locked_until timestamptz, just_locked boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key text := lower(trim(_email));
  _new_count integer;
  _prev_last timestamptz;
  _prev_locked timestamptz;
  _lock timestamptz := NULL;
  _just_locked boolean := false;
BEGIN
  SELECT la.last_failure_at, la.locked_until
    INTO _prev_last, _prev_locked
    FROM public.login_attempts la WHERE la.email = _key;

  -- Reset streak if the last failure is old enough.
  IF _prev_last IS NOT NULL AND _prev_last < now() - make_interval(mins => _reset_after_minutes) THEN
    UPDATE public.login_attempts SET fail_count = 0 WHERE email = _key;
  END IF;

  INSERT INTO public.login_attempts(email, fail_count, last_failure_at, updated_at)
  VALUES (_key, 1, now(), now())
  ON CONFLICT (email) DO UPDATE
    SET fail_count = public.login_attempts.fail_count + 1,
        last_failure_at = now(),
        updated_at = now()
  RETURNING public.login_attempts.fail_count INTO _new_count;

  IF _new_count >= _lock_threshold THEN
    _lock := now() + make_interval(mins => _lock_minutes);
    UPDATE public.login_attempts
       SET locked_until = _lock,
           fail_count = 0,   -- reset streak once locked so unlock is clean
           updated_at = now()
     WHERE email = _key;
    _just_locked := (_prev_locked IS NULL OR _prev_locked < now());
  ELSE
    _lock := _prev_locked;
  END IF;

  RETURN QUERY SELECT _new_count, _lock, _just_locked;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_login_failures(_email text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.login_attempts
     SET fail_count = 0, locked_until = NULL, updated_at = now()
   WHERE email = lower(trim(_email))
$$;

REVOKE ALL ON FUNCTION public.get_login_lock(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_login_failure(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_login_failures(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_login_lock(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_login_failure(text, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_login_failures(text) TO service_role;
