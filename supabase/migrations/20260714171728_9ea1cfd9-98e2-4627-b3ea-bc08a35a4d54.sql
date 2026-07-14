CREATE INDEX IF NOT EXISTS gps_pings_trip_id_idx ON public.gps_pings(trip_id);
CREATE INDEX IF NOT EXISTS alerts_driver_id_idx ON public.alerts(driver_id);
CREATE INDEX IF NOT EXISTS alerts_vehicle_id_idx ON public.alerts(vehicle_id);
CREATE INDEX IF NOT EXISTS geofence_events_geofence_id_idx ON public.geofence_events(geofence_id);
CREATE INDEX IF NOT EXISTS geofence_events_trip_id_idx ON public.geofence_events(trip_id);
CREATE INDEX IF NOT EXISTS geofence_events_vehicle_id_idx ON public.geofence_events(vehicle_id);
CREATE INDEX IF NOT EXISTS fuel_logs_driver_id_idx ON public.fuel_logs(driver_id);
CREATE INDEX IF NOT EXISTS fuel_logs_trip_id_idx ON public.fuel_logs(trip_id);
CREATE INDEX IF NOT EXISTS loads_assigned_owner_id_idx ON public.loads(assigned_owner_id);
CREATE INDEX IF NOT EXISTS loads_assigned_vehicle_id_idx ON public.loads(assigned_vehicle_id);
CREATE INDEX IF NOT EXISTS truck_posts_vehicle_id_idx ON public.truck_posts(vehicle_id);
CREATE INDEX IF NOT EXISTS invoices_plan_id_idx ON public.invoices(plan_id);
CREATE INDEX IF NOT EXISTS payment_transactions_invoice_id_idx ON public.payment_transactions(invoice_id);
-- Partial indexes for the most common list filters
CREATE INDEX IF NOT EXISTS trips_company_status_idx ON public.trips(company_id, status);
CREATE INDEX IF NOT EXISTS vehicles_company_status_idx ON public.vehicles(company_id, status);
CREATE INDEX IF NOT EXISTS expenses_company_incurred_idx ON public.expenses(company_id, incurred_on DESC);
CREATE INDEX IF NOT EXISTS trips_company_end_idx ON public.trips(company_id, actual_end DESC) WHERE status = 'completed';
ANALYZE public.trips, public.vehicles, public.expenses, public.alerts, public.gps_pings;