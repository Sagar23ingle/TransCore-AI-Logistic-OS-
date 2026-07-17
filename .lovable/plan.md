# SEO Plan — TransCore AI

TransCore AI is 99% authenticated app (dashboards, tracking, admin). Google only indexes public pages, so SEO here means **creating a real public marketing surface** in front of the app, plus wiring the technical basics. This is both a content plan and an implementation plan.

## Goals
- Rank for buyer-intent queries: "fleet management software India", "truck GPS tracking app", "logistics SaaS for truck owners", "AI trip & expense tracker", "load marketplace for brokers".
- Establish authority for informational queries: fuel efficiency, driver scoring, vehicle compliance, cost-per-km.
- Convert organic visitors → signups on `/auth`.

## 1. Public marketing routes (new)
All rendered SSR with unique `head()` metadata, canonical, og:url, JSON-LD.

- `/` — Home (rewrite current index as a real landing page: hero, problem, features grid, social proof, CTA to `/auth`).
- `/features` — overview + anchored sections.
- `/features/gps-tracking`
- `/features/trip-expense-management`
- `/features/document-vault`
- `/features/driver-scoring`
- `/features/load-marketplace`
- `/features/ai-insights`
- `/pricing` — plans from DB (Free / Pro / Fleet) with FAQ.
- `/for/truck-owners`
- `/for/fleet-managers`
- `/for/brokers`
- `/about`
- `/contact` — form → `contact_messages` table.
- `/blog` + `/blog/$slug` — DB-backed articles (`posts` table, `published=true`).
- `/legal/privacy`, `/legal/terms`
- `/404` handled by existing `notFoundComponent`.

## 2. Per-route head metadata
Every public route defines: `title` (<60 chars, keyword-led), `description` (<160 chars), `og:title`, `og:description`, `og:url`, `og:type` (`article` for blog, else `website`), `twitter:card=summary_large_image`, and a leaf-only `<link rel="canonical">`. Root keeps sitewide defaults only — remove page-specific title from `__root.tsx`. Add `og:image` per route only when a real hero image exists (blog covers, feature hero); otherwise omit and let hosting inject.

## 3. Structured data (JSON-LD)
- Root: `Organization` + `WebSite` with `SearchAction`.
- `/pricing`: `Product` + `Offer` per plan.
- `/blog/$slug`: `Article` + `BreadcrumbList`, headline/image/date from loader.
- `/contact`, `/about`: `ContactPage` / `AboutPage`.
- Feature pages: `SoftwareApplication` on `/` and `/features/*`.

## 4. Technical SEO
- **Dynamic sitemap** at `src/routes/sitemap[.]xml.ts` — enumerates all public routes + all `published` blog posts, `BASE_URL = https://transcoreai.lovable.app`.
- **robots.txt** — keep the app-route disallows, keep `Sitemap: https://transcoreai.lovable.app/sitemap.xml` absolute.
- **404**: already set; add `noindex` meta on it.
- **Auth pages** (`/auth`): add `noindex` meta (not useful in search).
- **Performance**: lazy-load below-the-fold images with `loading="lazy"`, add `width`/`height`, use responsive `<img srcset>` for hero, prefetch `/auth` on CTA hover (TanStack `preload="intent"`).
- **Accessibility/semantics**: single `<h1>` per page, semantic `<header>/<main>/<footer>`, descriptive `alt` on every image, skip-to-content link.
- **Internal linking**: footer with links to every public route, contextual cross-links between feature pages and matching blog posts.

## 5. Content plan (blog seed — 12 posts)
Buyer-intent + informational, one post per fortnight:

1. Best fleet management software for Indian truck owners (2026)
2. How to calculate true cost-per-km for your truck
3. GPS tracking vs telematics: what small fleets actually need
4. Driver scoring: 6 metrics that predict accidents & fuel waste
5. Document expiry alerts: the compliance checklist for Indian trucks (RC, FC, insurance, PUC)
6. Reducing fuel theft: anomaly detection with real fuel logs
7. Load marketplace guide: how brokers and truck owners settle fair rates
8. Predictive maintenance: turning odometer data into service alerts
9. Trip settlement without spreadsheets
10. GST invoicing for transporters — a practical primer
11. AI in logistics: what actually works in 2026
12. Case study template — publish real customer stories as they come

Each post: 1,200–1,800 words, primary keyword in title/H1/first 100 words/URL, one internal link to the matching `/features/*` and `/pricing`, one external authoritative reference.

## 6. Off-page & discovery
- **Google Search Console**: verify via META token (agent runs the verification flow), submit sitemap.
- **Bing Webmaster Tools**: import from GSC.
- **Business listings**: Google Business Profile, Crunchbase, ProductHunt launch, LinkedIn company page, relevant Indian logistics directories.
- **Backlinks**: guest posts on logistics blogs, answer relevant Quora/Reddit threads with post links, partner with driver-community forums.

## 7. Analytics & monitoring
- Wire lightweight page-view + `signup_click` events into existing `analytics_events` table on public routes.
- Weekly Search Console review (impressions, CTR, position) — decide next content topic from actual queries.
- Monthly SEO scan via built-in tool; track fixes.

## 8. Rollout order (build phases)
1. **Foundation** — dynamic sitemap route, `noindex` on `/auth` + 404, footer with public links, sitewide JSON-LD.
2. **Landing + top funnel** — rewrite `/`, add `/features`, `/pricing`, `/for/truck-owners`, `/for/fleet-managers`, `/for/brokers`.
3. **Deep feature pages** — 6 `/features/*` routes with unique metadata + `SoftwareApplication` schema.
4. **Blog infrastructure** — `posts` table (title, slug, excerpt, cover_url, body_md, author, published, published_at) with RLS (public read where `published=true`, author write), `/blog` index, `/blog/$slug` with `Article` JSON-LD, cover → og:image.
5. **Company pages** — `/about`, `/contact` (+ `contact_messages` table), `/legal/*`.
6. **Content push** — seed the 12 posts.
7. **Search Console + GBP + first backlinks**.

## Technical details (for the engineer)
- New routes use `createFileRoute` with `head({ params, loaderData })`; leaf routes carry canonical in `links`.
- Origin helper (`src/lib/origin.functions.ts`) via `getRequestOrigin` for absolute og:image URLs on dynamic blog posts.
- Sitemap loads posts inside handler with server-side publishable Supabase client (public `TO anon` SELECT on `posts` where `published`).
- `posts` and `contact_messages` migrations include `GRANT`s per project rules; `posts` gets `GRANT SELECT ON public.posts TO anon` scoped by RLS to published rows.
- Preserve current `_authenticated` layout and all existing app routes untouched.
- After foundation ships, trigger an SEO scan and mark passing findings fixed.

Reply "go" to start phase 1, or tell me which phase to run first.
