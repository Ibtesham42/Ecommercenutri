# Nutriyet — Progress Tracker

_Last updated: 2026-06-29 · Auto-maintained. Update at the end of every milestone._

## Snapshot

| Item                | Status                                                          |
| ------------------- | -------------------------------------------------------------- |
| Build               | ✅ passing (`next build`; affiliate routes included)            |
| TypeScript          | ✅ `tsc --noEmit` clean                                         |
| ESLint              | ✅ clean                                                        |
| Runtime smoke       | ✅ Premium UI verified (home/products/PDP/search/cart 200; lightbox + blur-up + elevation/reveal present; search typeahead API returns suggestions; `/admin/messages` shows the contact message, guard 307) |
| Database (Neon)     | ✅ live, migrated (…`affiliate_program`: Affiliate/Commission/Payout/MarketingAsset + StoreSetting affiliate fields), seeded |
| Current milestone   | **M0–M6 + RBAC + CMS Phases 1–5 + content pages + Affiliate Program — production-ready** |

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

## Latest: Marketing Hub (phase 1 — core)
New `/admin/marketing` section (RBAC `marketing` permission), built modular for future channels.
Migration `marketing_hub`: Campaign / CampaignEvent / CampaignTemplate / AudienceSegment (+ enums).
**lib/marketing/**: channel adapter registry (In-App + Email live; Push/WhatsApp/SMS stubs), audience
resolver (9 segments over existing user/order/wishlist/cart/affiliate data), dispatch engine, Groq
AI copy generation (with heuristic fallback), built-in templates, conversion attribution. **Cron-ready
delivery**: Send-now is immediate; scheduled campaigns processed by `/api/cron/marketing` (CRON_SECRET,
`vercel.json` every 5 min). Open pixel + click-redirect tracking routes; conversions/revenue credited
from a 7-day `nut_campaign` cookie in `createOrder`. **Admin UI** (tabbed): Overview/analytics
(sent/delivered/opened/clicked/conversions/revenue), Campaigns (list+history, bulk delete/cancel,
send/schedule/duplicate/resend), Compose (rich editor + image, AI assist, audience targeting w/ live
count, channels, attach product/coupon, send/schedule/draft), Segments, Templates. Typecheck/lint/
build green; migration applied to Neon.

## Latest: Marketing Hub — Automation Rules
Trigger-based flows (migration `marketing_automation`: AutomationRule + AutomationLog +
AutomationTrigger enum). Triggers: WELCOME / ABANDONED_CART / WINBACK / POST_PURCHASE, each with a
delay (h/d), channels and content (+ optional coupon, AI-assisted copy). `lib/marketing/automation.ts#
runAutomations` runs from the same cron (after campaign dispatch), computes eligibility from existing
user/order/cart/OrderEvent data, dedups via `AutomationLog @@unique([ruleId, key])` (one send per
user, or per order for post-purchase), and delivers in-app + email with catch-up bounds + a per-run
cap. Admin **Automations** tab: list + enable toggle + CRUD dialog + manual "Run now". Typecheck/lint/
build green; migration applied. Remaining follow-ups: recurring schedules, live Push/WhatsApp/SMS.

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
