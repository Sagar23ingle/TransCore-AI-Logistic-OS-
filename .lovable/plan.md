
# TransCore AI — Web SaaS Build Plan

## Reality check
- This project is a **fresh TanStack Start scaffold**, not an existing app to refactor. Everything in your 18-point spec is net-new.
- Lovable builds **web apps**. This will be a responsive, installable PWA — not an Android APK. Same product surface (works on phone browsers, installable to home screen).
- Firebase → replaced with **Lovable Cloud** (Postgres + Auth + Storage). Cloud Functions → **TanStack server functions**. FCM → **Web Push (VAPID)**. Crashlytics → **client error logger table**. Firebase Analytics → **events table + dashboard**. Same capabilities, web-native.
- Gemini → **Lovable AI Gateway** (server-side, key never exposed).
- Razorpay → real integration via server functions + webhooks.
- GPS → **integration-ready ingestion endpoints** (Traccar/Teltonika/MapMyIndia can POST to `/api/public/gps/ingest`) + browser Geolocation for driver phones. No simulated movement anywhere.

## Phasing (each phase ships working, tested, buildable)
I'll do phases 1–3 in this first pass. After you see it working, we do 4, then 5.

### Phase 1 — Foundation (this pass)
- Enable Lovable Cloud
- Design system: dark premium logistics theme (semantic tokens in `styles.css`), typography, layout shell, sidebar nav
- Database schema + RLS + GRANTs:
  - `profiles`, `user_roles` (enum: super_admin, fleet_owner, driver, broker), `has_role()` SDF
  - `vehicles`, `drivers`, `trips`, `documents`, `expenses`, `gps_pings`, `alerts`, `notifications`, `subscriptions`, `ai_requests`, `audit_log`, `error_reports`, `analytics_events`
  - All owner-scoped RLS; role-based policies for super admin
- Auth: email/password + Google, `_authenticated/` gate, role-aware routing, sign-out hygiene

### Phase 2 — Core fleet modules (this pass)
- Dashboard (real aggregates only — zero-state when empty)
- Vehicles CRUD
- Drivers CRUD (with driver-user linking)
- Trips CRUD (assign driver + vehicle, status lifecycle)
- Expenses (fuel, maintenance, tolls, other)
- All charts driven by real Postgres queries via server functions

### Phase 3 — Documents + Alerts + AI (this pass)
- Document Vault: upload/preview/replace/delete via Lovable Cloud Storage, per-owner RLS, expiry dates
- Smart Alerts engine: server function computes alerts at 30/15/7/3/0 days from real expiry dates (insurance, permit, fitness, PUC, DL, EMI, maintenance)
- AI (Gemini via Lovable AI Gateway): trip analysis, expense insights, document OCR summary — server-only, real errors surfaced ("AI service temporarily unavailable"), no fake fallbacks, retry with backoff

### Phase 4 — GPS, Payments, Notifications (next pass)
- GPS ingestion: public signed endpoint `/api/public/gps/ingest` (HMAC) that accepts Traccar/Teltonika/MapMyIndia payloads; live map with Leaflet + OSM; route polyline; distance (Haversine); ETA; speed
- Driver PWA mode: browser Geolocation background updates while trip is active
- Razorpay subscriptions: Free/Starter/Pro/Enterprise, order creation server fn, webhook verification, plan gating middleware
- Web Push notifications (VAPID) for document expiry, trip assignment, payment reminders

### Phase 5 — Admin, Offline, Hardening (final pass)
- Super Admin panel: users, fleets, revenue, subscriptions, AI usage, system health
- Offline-first: IndexedDB queue for writes, sync worker, connection status indicator
- Security hardening: Zod validation everywhere, rate-limit middleware on write endpoints, audit log, session review
- Final implementation report

## Technical details

**Stack additions**
- `@supabase/supabase-js` (via Cloud integration)
- `recharts` for charts
- `leaflet` + `react-leaflet` for maps
- `zod` + `react-hook-form` for validation
- `date-fns` (already installed)
- `idb` for offline queue
- `web-push` (server) for notifications
- Razorpay REST (fetch-based, no SDK — Worker compatible)

**File layout (real SaaS split, not one file)**
```text
src/
  routes/
    __root.tsx
    index.tsx                       # marketing landing
    auth.tsx                        # sign in / sign up
    _authenticated/
      route.tsx                     # managed gate
      dashboard.tsx
      vehicles.index.tsx
      vehicles.$id.tsx
      drivers.index.tsx
      drivers.$id.tsx
      trips.index.tsx
      trips.$id.tsx
      documents.index.tsx
      expenses.index.tsx
      alerts.index.tsx
      tracking.index.tsx            # live map
      ai.index.tsx                  # AI assistant
      billing.index.tsx             # subscription
      admin/                        # super-admin only
        users.tsx
        overview.tsx
        subscriptions.tsx
        health.tsx
    api/public/
      gps/ingest.ts                 # HMAC-signed GPS ingest
      razorpay/webhook.ts
      push/subscribe.ts
  components/
    layout/ (Sidebar, TopBar, Shell)
    dashboard/ (KpiCard, RevenueChart, FleetUtilChart, ...)
    vehicles/ (VehicleForm, VehicleCard, ...)
    drivers/ ...
    trips/ ...
    documents/ (DocumentUploader, DocumentCard, ExpiryBadge)
    alerts/ (AlertList, AlertBadge)
    tracking/ (LiveMap, VehicleMarker, RouteLayer)
    ai/ (AiChat, AiInsightCard)
    billing/ (PlanCard, CheckoutButton)
    admin/ ...
    ui/ (existing shadcn)
  lib/
    dashboard.functions.ts
    vehicles.functions.ts
    drivers.functions.ts
    trips.functions.ts
    documents.functions.ts
    alerts.functions.ts
    gps.functions.ts
    ai.functions.ts
    billing.functions.ts
    admin.functions.ts
    rbac.ts
    validation/ (zod schemas per domain)
    offline/ (IndexedDB queue)
  integrations/supabase/   # generated by Cloud
```

**Design language**
Dark theme, deep navy background, electric-cyan accent, generous spacing, glass-card surfaces, mono for numbers. All colors as HSL semantic tokens in `src/styles.css`. No hardcoded Tailwind color utilities in components.

**Explicit "no fake data" guarantees**
- New user dashboard shows zero-state empty cards ("Add your first vehicle") — never seeded rows.
- Every chart queries the DB; empty result → empty state component.
- AI failures render an `AiUnavailable` component with the exact copy you specified.
- GPS map shows "No active vehicles" when no pings in the last N minutes; never animated markers.

## What you'll see after this first pass (phases 1–3)
A working, signed-in dashboard with vehicles, drivers, trips, expenses, documents (upload/preview/delete with real Storage), an alerts page driven by real expiry math, and a working AI assistant powered by Gemini via the gateway. GPS map, payments, push, admin, and offline follow in the next passes.

## Ask before I start
1. Confirm phases 1–3 in this pass is OK (single pass = a few thousand LOC across ~40+ files; if you want smaller increments say so).
2. Do you have a preferred **brand color** for the accent (default: electric cyan `#22D3EE`)?
3. Are the 4 roles (super_admin, fleet_owner, driver, broker) final, or should I skip `broker` until you define its modules?

Reply "go" (with any color/role tweaks) and I'll start building.
