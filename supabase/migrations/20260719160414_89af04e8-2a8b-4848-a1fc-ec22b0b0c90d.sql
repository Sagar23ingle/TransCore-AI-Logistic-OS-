-- Composite index matching the hot listAlerts query:
--   WHERE owner_id = $1 AND is_dismissed = false ORDER BY days_remaining ASC
CREATE INDEX IF NOT EXISTS idx_alerts_owner_open_days
  ON public.alerts (owner_id, is_dismissed, days_remaining)
  WHERE is_dismissed = false;