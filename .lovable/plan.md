
# Scope reality check

You picked **full multi-tenant** + **Audit Log/Fleet Manager** + **Compliance engine/Executive dashboard**. That touches ~24 tables, every RLS policy, and every server function. Doing it all in one turn guarantees regressions in your existing working modules (trips, vehicles, fuel, dashboard, tracking, marketplace).

I'll deliver it in **3 sequential turns**, each fully working and tested before the next. This turn = Phase 1. Say "go" and I'll ship it.

---

## Phase 1 — this turn

### A. Multi-tenant foundation (migration 1)

New tables:
- `companies` (name, gstin, contact, plan_id, created_by)
- `company_members` (company_id, user_id, role: `owner|manager|driver|broker|viewer`, unique(company_id,user_id))

Enum change:
- Add `fleet_manager` to `app_role` (global admin-style role stays; `company_members.role` is the company-scoped role).

Helpers (SECURITY DEFINER, search_path=public):
- `is_company_member(_company uuid)` → boolean
- `company_role(_company uuid)` → text
- `user_companies()` → setof uuid
- `current_company_id()` → uuid (reads `request.jwt.claims->>'active_company'` set by app, falls back to first membership)

Add `company_id uuid REFERENCES companies` to the **core operational tables** (nullable, backfilled):
`vehicles, drivers, trips, expenses, fuel_logs, maintenance_logs, documents, alerts, audit_log, driver_scores, gps_pings, geofences, geofence_events, invoices`.

**Backfill**: for each existing user with data, create one company (`"<full_name>'s Fleet"`), add them as `owner`, stamp all their rows with that company_id. After backfill, set `company_id NOT NULL` on the same tables.

**RLS rewrite** for those tables: `USING (is_company_member(company_id))` plus role-scoped write policies (owner/manager can write; driver/broker read-only or scoped). Keep existing `owner_id` column and its policies as a compatibility fallback for one phase, then drop in Phase 3.

Grants: `authenticated` gets SELECT/INSERT/UPDATE/DELETE on companies + company_members with policies scoped to `auth.uid()`.

### B. Company switcher

- `src/hooks/use-company.ts` — reads memberships, keeps active company in `localStorage` + broadcasts change.
- `src/components/layout/CompanySwitcher.tsx` — dropdown in TopBar (create company, switch).
- All server functions in `vehicles/drivers/trips/expenses/fuel/maintenance/documents/alerts/dashboard/analytics.functions.ts` get an `active_company_id` input from the client and use it as the primary filter (RLS still enforces).

### C. Audit Log surface

- `src/lib/audit.functions.ts` — `listAudit({ company_id, filters, cursor })` returning paginated entries with actor profile join.
- `src/routes/_authenticated/audit.index.tsx` — filterable timeline (actor, action, entity, date range, IP), searchable.
- Extend `audit()` helper to always stamp `company_id`.
- Wire audit calls into: vehicle/driver/trip create/update/delete, settings changes, document upload/delete, login (via auth state change).

### D. Fleet Manager role

- Sidebar/route visibility: manager sees everything owner sees except billing + company settings destructive actions.
- Server functions check `company_role()` for write ops on settings/billing.
- Admin page gains a "Team" tab: invite by email, assign company role, remove.

### E. Compliance alert engine (cron)

- `src/routes/api/public/hooks/compliance-scan.ts` — scans vehicles (insurance/permit/fitness/puc/maintenance_next_due) and drivers (license_expiry) across all companies, inserts `alerts` rows with severity=`critical|warning|info` based on days-to-expiry (<0/≤7/≤30), dedupes on (entity_id, kind, due_date).
- `pg_cron` daily at 03:00 IST → POST to that route (via insert tool, not migration).
- Alerts page already exists; add severity filter + "expiring soon" grouping.

### F. Executive dashboard

- New route `/_authenticated/executive.tsx` (fleet_owner + fleet_manager + super_admin only).
- `src/lib/executive.functions.ts` — one server fn returning: revenue/expense/profit (MTD, YTD), active vehicles/drivers, trips today, expiring-docs count, maintenance-due count, top 5 vehicles by profit, top 5 drivers by score, open cost-leakage alerts count.
- Charts reuse existing recharts setup. Zero hardcoded numbers.

### Verification this turn

- `tsgo` clean.
- Manual: log in → switch/create company → old data appears under new company → create vehicle → audit row appears in Audit page → run compliance cron manually via curl → alerts appear → executive dashboard shows real numbers.

---

## Phase 2 — next turn

Global search · Data export (CSV/Excel) · OCR on document upload (Lovable AI Gemini vision) · Trip settlement PDF/Excel · Fuel anomaly detection (rolling z-score) · Route deviation analytics (from gps_pings vs planned route) · Predictive maintenance (interval-based projection) · Cost leakage AI (Lovable AI over rolled-up per-vehicle costs).

## Phase 3 — final turn

Drop legacy `owner_id` columns and policies · super-admin cross-company read views · permission matrix admin UI · audit retention/archive · full RBAC test pass.

---

## Technical notes

- Zero data loss: backfill is idempotent, wrapped in a transaction, verifies row counts before flipping NOT NULL.
- No breaking changes to existing routes this turn — every current page keeps working because we keep `owner_id` populated in parallel.
- `active_company` is client-set (localStorage → passed on every server fn call). RLS is the security boundary, not the client value.
- `has_role` / `current_user_is_admin` stay for global admin. Company-scoped checks use the new `company_role()` helper — no privilege-escalation path.

Reply **"go"** to start Phase 1.
