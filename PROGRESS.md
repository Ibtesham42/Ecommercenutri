# Nutriyet — Progress Tracker

_Last updated: 2026-07-06 · Auto-maintained. Update at the end of every milestone._

## Snapshot

| Item                | Status                                                          |
| ------------------- | -------------------------------------------------------------- |
| Build               | ✅ passing (`next build`; affiliate routes included)            |
| TypeScript          | ✅ `tsc --noEmit` clean                                         |
| ESLint              | ✅ clean                                                        |
| Runtime smoke       | ✅ Premium UI verified; **Marketing Hub verified end-to-end** (2026-06-29 — cron dispatch, recurring re-arm + child, automation dedup, open/click tracking, env-gated channel no-op; see Marketing Hub section) |
| Database (Neon)     | ✅ live, migrated (…`affiliate_program`, `marketing_hub`, `marketing_automation`, `push_subscriptions`, `analytics_tracking`), seeded |
| Current milestone   | **M0–M6 + RBAC + CMS + Affiliate Program + Admin bulk actions + Marketing Hub + Advanced analytics — production-ready** |

## Phase 2 (Revenue/Growth/Conversion) — AI Assessment real recs (2026-07-07)
The health-quiz result now recommends REAL, in-stock, goal-matched catalog
products (add-to-cart ready, works logged-out) instead of hard-coded search
links — the AI moat + a direct conversion path, honoring "only in-DB in-stock
recs". `lib/quiz/recommend.ts#getQuizRecommendedProducts` maps focus tags →
products via the existing search (active-only), filters in-stock, round-robins +
dedupes, backfills with in-stock best-sellers; `completeQuiz` returns them
(best-effort); `health-quiz.tsx` renders a "Snacks picked for you" grid. No
scoring/API/DB/auth change. Shared First-Load unchanged (103 kB).

## Phase 2 (Revenue/Growth/Conversion) — order-success retention (2026-07-07)
Post-purchase page turned from a dead end into a retention+discovery moment
(additive; no logic/API/DB/auth change): delivery-reassurance strip (cuts WISMO
support load), "Popular with our customers" cross-sell (existing `getBestSellers`
+ `RecoSection`, excludes just-purchased items → repeat purchase/AOV), and a
conditional AI-Assessment invite (only when the shopper has no HealthQuizResult).
`app/(storefront)/checkout/success/page.tsx`. Shared First-Load unchanged (103 kB).

## Latest: Auth Redesign — Phone-OTP login + profile completion (2026-07-06)
Mobile number + OTP is the primary sign-in (email + Google kept as a full alternate
panel); backend reused — phone auth is a second NextAuth Credentials provider.
- **Schema** (migration `phone_auth_profile`): `User.phone` unique (legacy values
  normalized to `+91…` + deduped in-migration), `phoneVerified`, `gender`, `dob`.
- **OTP**: `lib/otp.ts` — crypto 6-digit, sha256-hashed in `VerificationToken`, 5-min
  TTL, MSG91 delivery (`MSG91_AUTH_KEY`/`MSG91_TEMPLATE_ID`); dev keyless toasts the
  code, production keyless hides phone login (classic email card unchanged).
  **MSG91 keys pending on the owner's side (DLT registration in progress).**
- **Login** (`components/auth/auth-shell.tsx`): phone → OTP → in, all client-side view
  switches; `OtpInput` (auto-advance/paste/SMS-autofill/resend); premium email panel.
- **Profile completion** (`/account`): avatar (direct-to-Cloudinary, user-scoped
  signature route), gender + DOB, email change w/ re-verification, set/change
  password, phone add/change with inline OTP. Header Sign in is now a filled pill CTA.
- Same-day: welcome popup + quiz redesigned into premium staged experiences
  (benefit cards, hero assessment CTA, coach lead-ins, analyzing beats).

## Conversion Optimization — Phase 1 (2026-07-05)
Additive signup-conversion features, all admin-toggleable via the new `StoreSetting.growth` JSON blob
(migration `growth_conversion`; also new `HealthQuizResult` model + `QUIZ_*`/`POPUP_*`/`COUPON_CLAIM`/
`STICKY_CLICK` event types). Existing analytics/checkout/admin/AI untouched.
- **AI Health Score Quiz** (`/quiz`): 6 questions → deterministic 0–100 score + band + rule-based recs
  (optional Groq summary) → **quiz-first, signup-to-unlock** (`quizSignup` creates user + claims the
  anon result + grants the shared welcome coupon + signs in; `claimQuizForCurrentUser` on `/account`
  covers Google/normal-register). Premium animated stepper + SVG score gauge (no new deps). Dashboard
  "My Health Score" card. `lib/quiz/*`, `lib/actions/quiz.ts`, `lib/queries/quiz.ts`.
- **Smart Welcome Popup**: first-time + logged-out only, not on checkout, once/24h, after 10s or 40%
  scroll. **Sticky Offer Bar**: dismissible 24h, Get Coupon + Take Assessment. **Trust Section**
  below the hero: static badges + REAL DB stats above a threshold (never fabricated).
- **Welcome coupon**: shared public `WELCOME20` (PERCENT 20, one-use), synced on admin save.
- **Analytics**: quiz/popup/sticky funnel events → new **Conversion & growth** section on
  `/admin/insights` (`lib/queries/conversion.ts`).
- **Admin control** `/admin/growth` (`appearance` perm): feature toggles + coupon + copy.
- Verified (18/18 data-path + logic checks). Typecheck/lint/build green; shared First Load JS still
  103 kB (`/quiz` route 9 kB, lazy).

## Analytics accuracy fixes (2026-07-04)
Audited the new journey/heatmap tracking against live data (read-only DB audit script) and fixed
three real bugs that made metrics unrealistic:
- **Identity fragmentation** (broke the funnel — Landing showed ~4%): concurrent first-load beacons
  each minted a fresh anon id before the httpOnly cookie landed, splitting one shopper into many
  sessions (71 product-viewers had no page-view; only 7 had both). Fix: durable client id
  (`lib/client-id.ts`, localStorage `nut_cid`) sent as `cid` on every `/api/track` + `/api/replay`
  beacon; server prefers it over the cookie.
- **Clicks lost to late engine start** (heatmap — add-to-cart showed 31 views / 0 clicks despite 114
  CART_ADDs): the engine waited for requestIdleCallback/2.5s, attaching its click listener after the
  clicks happened. Fix: `engagement-tracker.tsx` starts the engine right after first paint + on first
  interaction. Also IO threshold `0.4 → [0, 0.5]` so footer/hero get fair impressions.
- **No confidence gating** (footer with 1 view/1 click read as "100%, top section"): added
  `lib/analytics-confidence.ts` floors — heatmap sections scored/ranked only above 25 impressions
  (else `score=null` → "Collecting data", never crowned); AI journey/heatmap builders return "Not
  enough data yet" below 30 sessions / 150 impressions; `heatFacts` no longer leaks null-score
  sections to the model; UI shows "Low confidence" badges + shortfall notes.
Verified end-to-end (12/12 checks: attribution, gating both directions, ranking floor, real AI
output). Typecheck/lint/build green; First Load JS still 103 kB.

## Journey + Heatmap + Rage + Session Replay analytics (2026-07-04)
Four **additive** sections appended to `/admin/insights` (`ai` permission) — existing charts/KPIs/
AI untouched; everything degrades to empty states and works keyless. Migration
`journey_heatmap_replay` (`HeatStat`, `SessionRecording`, `UserEvent.path/city/region`,
`HOME_VIEW`/`PAYMENT_START`/`RAGE_CLICK` enum values).
- **Customer Journey Analytics** — 11-stage funnel (Visitor→Landing→Homepage→Category→Product→
  Search→Add-to-cart→Checkout→Payment→Order success→Returning customer); per stage: users,
  conversion%, drop-off%, exit-rate, avg time-to-next, prev-period delta. Filters: device / source /
  product / state / city (URL-driven). AI drop-off diagnosis. `lib/queries/journey.ts`.
- **Website Heatmap Analytics** — engagement score 0-100 per `data-heat` section (clicks/click-rate/
  hovers/taps/time-in-view) + per-page scroll depth. Pre-aggregated daily `HeatStat` counters via
  `/api/heat` beacon (no per-interaction rows). AI best/worst + UI/CTA tips. `lib/heat-sections.ts`,
  `lib/queries/engagement.ts`.
- **Rage-click detection** — 3+ rapid same-spot clicks → `RAGE_CLICK`; grouped by element+path with
  delta; AI explains the top issue.
- **Session Replay** — anonymized, 25%-sampled recordings (cursor/scroll/click coords + paths only,
  never DOM/text/PII); `SessionRecording` (JSON chunks, size/page caps, 30-day retention);
  dependency-free rAF player (scrub + speed). `/api/replay` beacon.
- **Tracking**: lazy client engine (`engagement-tracker.tsx` → `engagement-engine.ts` after idle;
  one batched heat + replay beacon per page; passive listeners) — shared First-Load JS stays 103 kB.
  `JourneyTracker` (HOME_VIEW), checkout (PAYMENT_START), coarse geo via `lib/geo.ts` (no IP stored).
- Verified end-to-end (20/20 synthetic-pipeline checks incl. real Groq AI output; self-cleaning
  script). Typecheck/lint/build green.

## Advanced analytics (range-scoped) + exports (2026-07-04)
The BI dashboard's promised follow-up wave. New **`lib/queries/analytics.ts#getRangeAnalytics`** —
admin-chosen range (today / yesterday / 7d / 30d / custom ≤ 366d) always compared against the
same-length previous window: **conversion funnel** (visitors → product views → cart adds →
checkout starts → purchases, with per-stage % and "tracking new" pending flags), **KPI cards with
deltas**, **geo** (top cities by revenue), **device + traffic-source breakdowns**, weakest-converting
products and **cart-recovery** stats. Outputs are plain JSON (Redis read-through cache safe) and
degrade to zeros/placeholders on fresh tracking. **Tracking additions** (migration on `UserEvent`):
new event types `PAGE_VIEW` + `CHECKOUT_START`; new `device` (UA-derived server-side, `lib/ua.ts`)
and `referrer` (external hostname only, no PII) columns + `createdAt` index. `VisitTracker`
(storefront layout) logs one PAGE_VIEW per browser session with the external referrer;
CHECKOUT_START fires from the checkout page; `/api/track` stays rate-limited. `UserEvent` grows
unbounded — a retention/rollup job is a noted future follow-up. **Insights page**: `RangeFilter`
(presets + custom dates via searchParams), KPI cards, dependency-free SVG charts, **`LiveStrip`**
(live visitors + today's orders/revenue + latest activity; polls a guarded server action every 45s,
pauses on hidden tab), rule-based `ActionPlan`. **Exports**: CSV at `/admin/insights/export`
(`?section=` narrows; opens in Excel) and a branded **PDF report** at `/admin/insights/report`
(`lib/pdf/analytics-pdf.tsx`, @react-pdf, ASCII `Rs.`), both `ai`-permission-guarded. The AI
summary/Q&A (`lib/ai/insights.ts`) is now grounded in the selected range's facts too. Typecheck/
lint/build green.

## Latest: Affiliate / Influencer Program (done)
Full referral-marketing program layered additively on orders, gated by a new `affiliates`
RBAC permission + `StoreSetting.affiliateEnabled`. Migration `20260628201357_affiliate_program`
(Affiliate, AffiliateClick, CommissionRule, Commission, Payout, MarketingAsset + enums +
StoreSetting fields: cookieDays/defaultCommission/minPayout). **Attribution**: `?ref=` last-click
`nut_ref` cookie (middleware) + `/ref/[code]` + click beacon; coupon-affiliate wins else cookie,
self-referrals excluded, snapshotted on `Order.affiliateId`. **Commission engine**
(`lib/affiliate/commissions.ts`): per-line on post-discount value (excl. tax/shipping), rate
precedence PRODUCT→CATEGORY→affiliate-override→ROLE→default; PENDING on confirm → mature after
return window at DELIVERED → APPROVED (lazy sweep, no cron) → batched into Payouts; voided on
cancel/refund. Notifies in-app + email each step. **Affiliate** UI at `/account/affiliate`
(apply, dashboard, QR, payout request); **admin** at `/admin/affiliates` (list/detail, rules,
payouts, settings, marketing-kit, analytics, CSV export). See CLAUDE.md §8c. Full gate green
(typecheck/lint/build); migration applied to Neon. Renders nothing when disabled — homepage/
checkout unchanged for non-referred orders.
- **Public landing** `/affiliate` (footer + sitemap) drives applications; smart CTA → dashboard.
- **Commission management** `/admin/affiliates/commissions`: status-filtered list + Pending/
  Approved/Paid/Cancelled totals; commission approval is **automatic** (delivered + return window
  → `matureCommissions`) with admin "Run maturation" + manual approve/cancel for edge cases.
- **Payout notifications**: approve/reject/mark-paid each send in-app + email; reject captures a
  reason and returns commissions to the available pool. Min withdrawal configurable in Settings.

## CMS roadmap (WordPress-style admin management; one phase per turn)
✅ **Phase 1 — Hero Slider Manager**: `HeroSlide` model + `/admin/hero` (drag-drop reorder,
duplicate, schedule, publish, live preview) + premium storefront slider after Stories.
Gated by `appearance` permission.
✅ **Phase 2 — Product page UX redesign + mobile**: redesigned `product-purchase.tsx`
(savings price block, nutrition highlight chips, larger variant pills + per-variant price,
44px quantity stepper, Buy-now-primary hierarchy, delivery estimate, free-shipping progress,
trust badges, **sticky mobile add-to-cart bar** via IntersectionObserver); polished reviews.
✅ **Phase 3 — Appearance & Website Settings**: extended `StoreSetting` (branding, theme
colors, announcement bar, contact + business hours + maps + WhatsApp, SEO defaults + favicon).
`/admin/appearance` manager; storefront wired (announcement bar, theme override, logo,
WhatsApp, footer hours, root `generateMetadata` SEO).
✅ **Phase 4 — Homepage Section Builder**: `HomeSection` model + registry
(`lib/home-sections.ts`); homepage refactored to a keyed section map rendered in admin
order; `/admin/homepage` (drag-drop reorder + show/hide). Additive — identical until edited.
✅ **Phase 5 — Banner Manager**: `Banner` model + named placements registry
(`lib/banners.ts`: homeTop / productsTop / categoryTop); `/admin/banners` (create/edit,
desktop+mobile images, link to product/category/URL, priority, schedule, publish toggle,
duplicate, delete) gated by `appearance`; storefront `<BannerStrip position>` renders active
in-schedule banners by priority (server component, renders nothing when empty — fully additive).
✅ **Footer/nav content pages**: every footer + nav link now resolves (no 404s).
Added `/contact` (working form → `ContactMessage` + email), `/blog` + `/blog/[slug]`
(`BlogPost`, CMS-ready, 3 seeded posts), `/support` (help hub), `/track` (public guest
order tracking → existing Order system), and `/shipping` `/privacy` `/terms` (`ContentPage`
override + professional code defaults in `lib/legal-content.ts`). Footer "Track Order" →
`/track`; sitemap + SEO/JSON-LD updated. Admin editors for these land in a later CMS phase.
Sanitization moved to `lib/sanitize.ts` (`sanitize-html`; isomorphic-dompurify breaks the
Node-21 build).
✅ **CMS fixes/upgrades**:
- **Favicon**: removed the `app/favicon.ico`/`app/icon.tsx`/`app/apple-icon.tsx` file
  conventions (they overrode `metadata.icons`); brand defaults now at `/brand-icon` +
  `/brand-apple-icon`; root metadata drives icons from `StoreSetting.favicon`, normalized via
  `cldUrl` (f_auto) so any uploaded asset (incl. a stale `.pdf`) is delivered as an image and
  the versioned URL cache-busts. Favicon upload accepts `.png/.ico/.svg`.
- **Banner Manager**: `Banner` gains optional `desktopImageDark`/`mobileImageDark`; `cldUrl`
  gains `gravity`(g_auto smart crop)+`dpr`; storefront uses a shared `BannerCard` with a
  responsive `<picture>` (mobile/tablet/desktop, auto mobile crop, dark variants w/ light
  fallback); admin form adds dark uploads + a live theme/viewport preview.
- **Logo sizing**: `StoreSetting` gains `logoHeight`/`logoHeightMobile`/`logoMaxWidth`;
  Appearance form exposes them; `Logo` applies them responsively via CSS vars (defaults
  32px/160px). Fixes the too-small storefront logo. (Note: existing logo/favicon assets were
  uploaded as Cloudinary `.pdf`; `cldUrl` now delivers them as images — re-upload a PNG/SVG for
  best quality.)
- **Homepage Section editor**: `HomeSection.content` JSON + `lib/home-content.ts` defaults;
  the 8 content sections (hero, aiBanner, headings, why-choose-us, testimonials) are fully
  editable (text, buttons, colors, list items) with live preview, save and reset-to-default;
  homepage is pixel-identical until edited. stories/heroSlider keep their own managers.
✅ **Premium UI/UX uplift** (refined motion + warm-gold accent + elevation + skeletons):
- **Design language** (`app/globals.css`): `--gold`/`--gold-foreground` tokens, `.shadow-elev-1/2/3`,
  reduced-motion-gated keyframes (fade-up, blur-up, shimmer), `[data-reveal]` scroll reveal.
  New shared `BlurImage`, `Reveal`, `EmptyState`, and skeleton building blocks.
- **Product card + states**: premium card (BlurImage, gold best-seller badge, savings, hover-lift),
  `loading.tsx` skeletons for products/categories/search/PDP, consistent `EmptyState` everywhere.
- **Homepage**: gold-accented section headings, overlay category cards, elevated hero/AI-banner/
  testimonials/why-choose-us, larger stories rail, footer trust row — CMS structure intact.
- **PDP**: full-screen gallery **lightbox** (zoom + thumbnail/keyboard nav), refined buy area.
- **Header**: desktop + mobile **search typeahead** (debounced, keyboard-nav,
  `/api/search/suggestions`), polished nav; cart/checkout sticky elevated summaries; wishlist
  heart micro-interaction.
- **Contact admin inbox** (`/admin/messages`, `customers` permission): view / New+All filter /
  search / mark handled / delete / reply; dashboard "new messages" banner. (Messages already
  persisted + best-effort email — this adds the missing admin view.)
⏳ Backlog: Admin editors (blog/legal) · Navigation Builder · Footer Builder · Media Library ·
popups/ads.

## Latest: Admin RBAC (sub-admins, permissions, store settings)
Roles `SUPER_ADMIN`/`ADMIN` with per-section `User.permissions`; new `StoreSetting`.
`/admin/admins` (main admin) adds/manages sub-admins (permission checkboxes, photo,
phone, contact email, address); self email/password + editable store contact/socials in
`/admin/settings`. Enforced in middleware + `guardSection` (pages) +
`requirePermission`/`requireSuperAdmin` (actions), all DB-fresh; dashboard widgets scoped
to permissions. (Deploy still requires `DATABASE_URL` at runtime — see the build fix.)

## Latest: AI Business Intelligence dashboard (insights upgrade)
Transformed `/admin/insights` (`ai` permission) from basic stats into a BI dashboard — all
**deterministic + lightweight**, reusing existing orders/products/users/carts/affiliates/campaigns/
returns data (no new tables, no AI required for the numbers). `lib/queries/bi.ts#getBusinessIntelligence`
(parallel aggregates, one ~90-day order fetch) computes: sales summary (today/week/month/year) + WoW/MoM
growth, 30-day revenue trend, run-rate month forecast, customer segmentation (new/returning/inactive/
high-value) + repeat rate + top customers, inventory velocity forecast (low/out-of-stock + days-to-
stockout), trending/declining + best-by-category + "worth promoting" (high-view/low-sale), cart
abandonment, affiliate + campaign snapshots, refund rate, best day/hour to promote, and rule-based
**smart alerts**. `lib/ai/insights.ts` adds a **natural-language summary** + **AI Q&A** via the Groq
seam, grounded in the computed facts, each with deterministic fallbacks (works with no key).
`askBusinessQuestion` server action powers the Q&A box. Charts are **dependency-free** SVG sparklines +
hover-tooltip bars. Mobile-friendly. Typecheck/lint/build green. Follow-up wave: PDF/Excel export +
scheduled weekly/monthly AI report emails.
- **Prod crash fix**: the page (server component) passed a `format` **function** prop to the client
  `MiniBars` — non-serializable across the RSC boundary → server-side exception in production. Replaced
  with pre-formatted `valueLabels` strings. Hardened so it can never crash: `getBusinessIntelligence`
  retries once (Neon cold start) then returns a safe empty snapshot; added an `app/admin/insights/
  error.tsx` route error boundary (rest of admin stays functional); empty datasets render empty states.

## Latest: Admin UI/UX polish + email logo branding
Purely presentational admin uplift (no logic/workflow changes): `app/admin/loading.tsx` skeleton on
every admin navigation; `AdminPageTransition` (pathname-keyed `animate-fade-up`, reduced-motion gated);
admin header now shows the **admin-uploaded store logo** (+ backdrop-blur + elevation); nav items get
premium hover/active (primary-tint pill, left accent bar, motion-safe icon scale); `PageHeader` gains a
divider for hierarchy; shared `Table` header gets a faint strip. Buttons/tables/dialogs/dropdowns
already had micro-interactions + mobile overflow. **Email branding**: the email shell now renders the
admin-uploaded logo (white pill on the green header, wordmark fallback) via a `<!--NUTRIYET_BRAND-->`
marker replaced in `sendEmail` (cached 5 min, fail-safe). Header/footer/invoice-PDF already used the
store logo, so the uploaded logo now flows everywhere customer-facing and auto-reflects on change.
Typecheck/lint/build green.

## Latest: CMS content editors (Blog + Legal)
Built the two missing admin content editors (CLAUDE.md §8b backlog), gated by `appearance`.
**Blog** (`/admin/blog`): `BlogPost` CRUD — title/auto-slug, excerpt, HTML content, cover image,
author, tag, publish toggle + date — with the shared `<BulkBar>` (publish/unpublish/delete);
content is `sanitizeRichText`-sanitized on save and revalidates `/blog` + `/blog/[slug]` + sitemap.
**Legal** (`/admin/legal`): per-page editor for Shipping/Privacy/Terms — `saveContentPage` upserts a
`ContentPage` override (sanitized), `resetContentPage` deletes it to fall back to the code default;
the editor pre-fills from the default HTML and shows Custom/Default status. (Contact inbox was already
shipped at `/admin/messages`.) Both added to the admin nav. No migration (models existed).
Typecheck/lint/build green.

## Marketing Hub (complete — full multi-channel campaign system)
A modular, production-ready marketing platform at **`/admin/marketing`**, gated by the new
`marketing` RBAC permission. Built across four waves; reuses existing users/products/coupons/
notifications/email/Groq. See CLAUDE.md §8d. Full gate green (typecheck/lint/build); all migrations
applied to Neon. Degrades gracefully — email→console without Resend, AI→heuristic without Groq, and
every channel/cron is keyless-safe.

**Data** (migrations `marketing_hub`, `marketing_automation`, `push_subscriptions`): `Campaign`,
`CampaignEvent`, `CampaignTemplate`, `AudienceSegment`, `AutomationRule`, `AutomationLog`,
`PushSubscription` (+ CampaignType/Status/Channel, SegmentType, AutomationTrigger enums).

**Engine** (`lib/marketing/`):
- **Audience** — `resolveAudience`/`countAudience` over 9 segment types (All, Customers, Affiliates,
  product/category buyers, Wishlist, Abandoned-cart, Inactive, Selected); recipients carry email +
  phone (`user.phone` ?? latest address).
- **Channels** — a per-channel **adapter registry** (`deliver.ts`). In-App (`notify`) + Email
  (`marketingEmail`) always work; **Push (VAPID/`web-push`), WhatsApp (Meta Cloud API), SMS (Twilio)**
  are real, **env-gated** adapters (`providers.ts`) that no-op until their keys are set.
- **AI** — `generateCampaignContent` via the Groq seam (generateText + JSON parse, heuristic fallback).
- **Conversion attribution** — click-redirect drops a `nut_campaign` cookie; `recordCampaignConversion`
  credits conversions/revenue in `createOrder` (7-day window).
- **Cron-ready dispatch** — `/api/cron/marketing` (CRON_SECRET, `vercel.json` daily `0 3 * * *` —
  Hobby-plan max; Pro can use `*/5`) runs
  `dispatchDueCampaigns` + `runAutomations`.

**Campaigns** — Compose (rich editor + image, AI assist, audience targeting with a **live recipient
count**, channel toggles + "needs setup" hints, attach product/coupon). Send now / schedule / save
draft. Tracking via `/api/marketing/open` (pixel) + `/click` (redirect). **Recurring** Daily/Weekly/
Monthly: a recurring campaign is a *series parent* (stays SCHEDULED) that spawns a one-off **child
snapshot** per occurrence (own per-occurrence analytics) and re-arms via `nextRun()` (skips missed
windows). Campaigns list = history with bulk delete/cancel + per-row send/schedule/duplicate/resend.

**Automations** — trigger-based flows (WELCOME / ABANDONED_CART / WINBACK / POST_PURCHASE) with a
delay, channels, AI-assisted content + optional coupon. `runAutomations` (same cron) computes
eligibility from user/order/cart/OrderEvent data, **dedups via `AutomationLog @@unique([ruleId, key])`**
(once per user, or per order for post-purchase), with catch-up bounds + per-run cap. Enable toggle +
"Run now".

**Segments** (saved audiences with live counts), **Templates** (6 built-ins + custom), **Overview**
analytics (sent/delivered/opened/clicked/conversions/revenue). **Web Push** opt-in on the account
page + additive SW `push`/`notificationclick` handlers (`public/sw.js` VERSION→v3, fetch/cache
invariant untouched). New env (`.env.example`): `CRON_SECRET`, VAPID keypair, `WHATSAPP_*`, `TWILIO_*`.

**Verified end-to-end (2026-06-29)** — ran the dev server against live Neon and drove the real HTTP
surfaces with an isolated `@example.test` user (no real customer messaged): `GET /api/cron/marketing`
→ `{processed:2, automated:8}` ran audience resolution + dispatch + automations in one call; one-off
campaign went `SENT` (sent 2 / delivered 2, In-App + Email); recurring parent stayed SCHEDULED and
re-armed exactly **+1 day** with a `SENT` child snapshot; automation logged 8 recipients and a 2nd run
returned `automated:0` (**dedup confirmed**); `open` → `200 image/gif` (openCount+1, OPEN event);
`click` → `307 /products` + `nut_campaign` cookie (clickCount+1, CLICK event); an all-channels send
gave `sent 5 / delivered 2` with **Push/WhatsApp/SMS no-op'ing cleanly** when unconfigured (no errors);
admin guard `307→/login`. Findings: (1) activating an automation also messages existing customers
matching the trigger within the catch-up window → **added confirm dialogs + an amber note to the
Automations UI** (commit `433de5c`); (2) campaign dispatch sends the audience synchronously per request
(automations capped at 500/run; large broadcasts are a batching/queue scale follow-up). Conversion
credit-on-order and AI copy generation are behind authenticated surfaces (cookie + Groq seam verified;
the order/admin halves not driven via curl). Test data fully cleaned up.

## Latest: Admin bulk actions (wave 3 — new moderation pages)
Built the two admin tables that didn't exist yet, with bulk baked in. **Reviews**
(`/admin/reviews`, `products` permission): moderation list (filter all/approved/hidden + search),
per-row approve/hide/delete, bulk approve/hide/delete + CSV export; `bulkReviewAction` recomputes
each product's rating aggregate so the storefront stays in sync (storefront shows only
`isApproved`). **Notifications** (`/admin/notifications`, `customers` permission): oversight of all
in-app `Notification` rows (filter all/unread/read + search by title/body/recipient), per-row delete,
bulk mark read / unread / delete. Both added to the admin nav (Star / Bell icons). Typecheck/lint/
build green.

## Latest: Admin bulk actions (wave 2)
Extended the bulk foundation to commerce + CMS modules. **Orders**: bulk status update
(`bulkUpdateOrderStatus` → shared `transitionOrderStatus`, emails per order) via a status
`<select>` in the bulk bar, sequential invoice-PDF download, CSV export, shipping-label stub
(future). **Returns**: bulk approve / reject / mark-refunded (`bulkReturnAction` reusing
`transitionReturnStatus`/`processRefund` + notifications; bulk refund settles to the original
method and skips COD/manual with a note). **Stories / Hero / Banners**: bulk publish / unpublish /
delete (card managers keep their existing drag/priority ordering). `<BulkBar>` gained an optional
`children` slot for inline controls. Typecheck/lint/build green. (Homepage Sections are a fixed
registry — show/hide + reorder only, no bulk delete. Reviews/Notifications have no admin table yet.)

## Latest: Admin bulk actions (wave 1)
Reusable bulk-selection foundation (`useBulkSelection` hook, floating `<BulkBar>` with built-in
confirm, `toastBulk`, client `downloadCsv`) + per-module `bulk<Entity>Action(ids, action)` server
actions returning `AdminResult<BulkOutcome>`. Wired into **Products** (delete/activate/deactivate/
feature/unfeature/export), **Categories** + **Coupons** (delete-safe/activate/deactivate),
**Customers** (activate/deactivate/safe-delete/export), **Messages** (close/delete), **Affiliates**
(suspend/reactivate/export) — each with select-all + per-row checkboxes. Delete policy: deactivate
+ safe hard-delete only (skip categories-with-products, deactivate used coupons, delete only
order-free customers, never touch admins). Typecheck/lint/build green. Remaining modules
(Orders/Returns/Stories/Hero/Banners/Reviews/Notifications) are follow-up waves.

## Milestones

| Milestone | Scope                                                | Status        |
| --------- | ---------------------------------------------------- | ------------- |
| M0        | Foundation                                           | ✅ Complete    |
| M1        | Storefront + Auth + Products + Account               | ✅ Complete    |
| M2        | Cart → Checkout → Razorpay → Orders                   | ✅ Complete    |
| M3        | Admin panel                                          | ✅ Complete    |
| M4        | AI (Groq): assistant, product chat, search, recs     | ✅ Complete    |
| M5        | Stories viewer, Cloudinary uploads, image optimization | ✅ Complete  |
| M6        | SEO, PWA, analytics, notifications, deploy            | ✅ Complete    |

## M6 deliverables (this session)
- **SEO**: `app/sitemap.ts` (static + products + categories), `app/robots.ts`,
  Organization + WebSite (SearchAction) JSON-LD in root layout, BreadcrumbList on
  product + category pages (`lib/seo.ts` helpers).
- **Images**: generated `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`
  via `next/og`; `siteConfig.ogImage` → `/opengraph-image`.
- **PWA**: `app/manifest.ts`, `public/sw.js` (conservative network-first SW),
  `components/service-worker-register.tsx` (prod only), `app/offline/page.tsx`.
- **Analytics**: `components/analytics.tsx` (pluggable, no-op fallback) + env wiring.
- **Notifications**: `orderStatusEmail` (shipped/delivered/cancelled/refunded) sent
  from the admin `updateOrderStatus` action (best-effort, reuses Resend infra).
- **Hardening**: `/api/ai/chat` rate-limited via `limiters.ai` (Upstash, fail-open).
- **Docs**: `DEPLOYMENT.md` (Vercel + Neon + integrations + hardening checklist).

## Integrations (all optional; fallbacks active)
| Integration | Status in this env | Effect if blank                  |
| ----------- | ------------------ | -------------------------------- |
| Database (Neon) | ✅ live          | required                         |
| Groq        | ✅ configured       | AI shows friendly fallback       |
| Cloudinary  | ✅ configured       | admin images become URL-paste    |
| Razorpay    | set as needed       | checkout uses mock-success flow  |
| Resend      | set as needed       | emails logged to console         |
| Google OAuth| set as needed       | only credentials login shown     |
| Upstash     | set as needed       | cache + rate-limit are no-ops    |
| Analytics   | optional            | no script injected               |

## Risks / notes
- **Node 21.1.0 (EOL)** pins Prisma to 6. Use Node 20/22 LTS in production, then
  optionally bump Prisma 7.
- Neon **cold start** (`P1001`) on first connect after idle — retry once.
- Service worker interactivity (install/offline) is client-only — verify visually.
- Local smoke shows `localhost:3000` in sitemap/OG; production derives URLs from
  `NEXT_PUBLIC_APP_URL` — set it to the real domain on deploy.

## Next (operational, post-feature-complete)
Deploy to Vercel per `DEPLOYMENT.md`. Future iterations: real RAG (vector retrieval
behind the existing `lib/ai/retrieval.ts` seam), richer analytics/funnels, A/B tests,
more transactional notifications.
