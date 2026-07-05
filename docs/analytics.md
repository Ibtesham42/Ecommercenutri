# Analytics — Range Analytics, Journey, Heatmap, Replay + Accuracy Invariants

> Part of the [Nutriyet docs](../CLAUDE.md#documentation-index). All surfaced on
> `/admin/insights` (`ai` permission). Everything is keyless, degrades to empty states,
> and never touches the existing charts/KPIs.

## Advanced range analytics

- `lib/queries/analytics.ts#getRangeAnalytics` (additive companion to the fixed-window BI
  in `lib/queries/bi.ts`): admin-chosen range (today/yesterday/7d/30d/custom ≤366d) vs the
  same-length previous window — conversion **funnel** (visitors→product views→cart adds→
  checkout starts→purchases, "tracking new" pending flags), KPI cards with deltas, geo
  (cities by revenue), device/traffic-source breakdowns, weak converters, cart recovery.
  Outputs are plain JSON (Redis-cache safe), degrade to zeros on fresh tracking.
- Tracking: `UserEvent` has `PAGE_VIEW`/`CHECKOUT_START` types + `device` (server-derived
  from UA via `lib/ua.ts`) and `referrer` (external hostname only, no PII) — fed by
  `VisitTracker` (one PAGE_VIEW per browser session, storefront layout) and the checkout
  page through the rate-limited `/api/track`. **No pruning yet** — add a retention/rollup
  job when volume warrants.
- Insights page: `RangeFilter` (searchParams), `LiveStrip` (45s-poll of a guarded server
  action, pauses when tab hidden), CSV export (`/admin/insights/export`, `?section=`),
  branded PDF report (`/admin/insights/report`, `lib/pdf/analytics-pdf.tsx`); AI
  summary/Q&A grounded in the selected range's facts.

## Customer Journey Analytics

- `lib/queries/journey.ts#getJourneyAnalytics` + `journey-section.tsx`: 11-stage funnel
  (Visitor→Landing→Homepage→Category→Product→Search→Add-to-cart→Checkout→Payment→Order
  success→Returning customer) with per-stage users / conversion% / drop-off% / exit-rate /
  avg-time-to-next and previous-period delta. Computed per unique-shopper "session" from
  one bounded `UserEvent` fetch; browse stages (category/search) are optional so they
  don't distort the main-path conversion base. URL-driven filters (device / traffic
  source / product / state / city). AI drop-off diagnosis via `generateJourneyDiagnosis`
  (Groq seam + rule-based fallback).

## Website Heatmap Analytics

- `lib/queries/engagement.ts#getHeatmapAnalytics` + `heatmap-section.tsx`: engagement
  score 0-100 per `data-heat` section (registry in `lib/heat-sections.ts`), with clicks /
  click-rate / hovers (desktop) / taps (mobile) / avg time-in-view, plus per-page
  scroll-depth (25/50/75/100%) and time-on-page.
- Data is **pre-aggregated** into daily `HeatStat` counters (one row per
  day×page×section×device) by the `/api/heat` beacon — no per-interaction rows.
- AI best/worst + UI/CTA suggestions via `generateHeatmapInsights`.
- **Add tracking to a new area:** drop `data-heat="<key>"` on it + add the key to
  `HEAT_SECTIONS` in `lib/heat-sections.ts`.

## Rage clicks & Session Replay

- **Rage-click detection** (`getRageClicks`, `rage-section.tsx`): 3+ rapid clicks in one
  spot → a `RAGE_CLICK` event (element label = nearest `data-heat` key or control
  descriptor); grouped by element+path with previous-period delta.
- **Session Replay** (`getSessionReplays`/`getSessionReplay`, `replay-section.tsx` +
  `replay-panel.tsx`): **anonymized, sampled** (25%) — normalized cursor/scroll/click
  coordinates + page paths ONLY (never DOM content, text or keystrokes — passwords/
  payment/PII can't be captured by construction). Stored in `SessionRecording` (JSON page
  chunks appended per page via `/api/replay`, size/page caps, 30-day retention pruned
  lazily on admin read). Player is dependency-free (schematic viewport + rAF timeline,
  scrub + speed).

## Client tracking engine

- `UserEventType` includes `HOME_VIEW` / `PAYMENT_START` / `RAGE_CLICK` (+ growth types,
  see `docs/growth.md`); `UserEvent` has `path` / `city` / `region` (coarse platform geo
  via `lib/geo.ts` — Vercel IP-city/region headers, no IP stored).
- The engine is **lazy**: `components/storefront/engagement-tracker.tsx` dynamic-imports
  `engagement-engine.ts` (shared First-Load JS stays ~103 kB); it batches ONE `/api/heat`
  + one `/api/replay` beacon per page (sendBeacon on leave), all listeners passive,
  fail-silent. `JourneyTracker` logs `HOME_VIEW`; checkout logs `PAYMENT_START`. Beacon
  routes are Zod-validated, rate-limited (`limiters.api`), fail-open.
- Migrations: `analytics_tracking` (event cols) + `journey_heatmap_replay` (`HeatStat`,
  `SessionRecording`, enum values).

## Accuracy invariants — DO NOT REGRESS

1. **One shopper = one id.** A durable client id (`lib/client-id.ts`, localStorage
   `nut_cid`) is minted synchronously and sent as `cid` on every `/api/track` +
   `/api/replay` beacon; the server prefers it over the cookie. Concurrent first-load
   beacons used to each mint a different anon id, fragmenting one shopper into many
   "sessions" and collapsing the funnel. Never revert to cookie-only identity.
2. **The engagement engine must start promptly** — `engagement-tracker.tsx` loads it right
   after first paint AND on first interaction (pointerdown/keydown/scroll/touch). A
   delayed start loses early clicks while impressions keep accruing.
3. **Impressions use IO threshold `[0, 0.5]`** so large/below-fold sections (footer, hero)
   are counted fairly.
4. **Confidence gating** (`lib/analytics-confidence.ts`): heatmap sections are
   scored/ranked only above `minSectionImpressions` (25) — below that `score` is `null`
   and they render "Collecting data", never crowned #1. AI journey/heatmap builders return
   "Not enough data yet" below `minJourneySessions` (30) / `minHeatmapImpressions` (150);
   `heatFacts` never sends an unscored section to the model. UI shows a "Low confidence"
   badge + shortfall note.

## Pluggable page analytics

Dependency-free: a `<Script>` is injected only when `NEXT_PUBLIC_ANALYTICS_SRC` +
`_DOMAIN` are set (Plausible/Umami-style), else nothing. GA4/GTM/Meta Pixel inject via
the SEO manager (see `docs/seo-pwa.md`).
