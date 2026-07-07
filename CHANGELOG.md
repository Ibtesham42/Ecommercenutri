# Changelog

All notable changes to Nutriyet, grouped by milestone. Dates are when the work
landed in this workspace. This project is pre-1.0; versions track milestones.

## [Admin Experience & Variant Media] — 2026-07-07

Premium variant management end to end + admin productivity sweep (A1–A8).

### Added
- **Schema** (migration `variant_media`, additive): `ProductVariant.images[]`
  (ordered, first = cover), `description`, `barcode`, `badge`,
  `nutritionImageUrl` — all optional; the storefront falls back to the
  product-level gallery/description, so existing products render unchanged.
- **Admin variant editor**: collapsible "Media & details" panel per variant —
  photo upload with grip-handle drag-reorder + make-cover, description with
  fallback placeholder, SKU/barcode/badge (suggestion datalist), nutrition
  image. One-click **duplicate variant** on every card.
- **PDP instant variant switching**: shared `VariantSelectionProvider` — the
  purchase panel drives selection; gallery (keyed blur-up crossfade, lightbox
  included), description tab, nutrition image, gold badge and SKU line follow
  instantly, no reload. Cart lines use the selected variant's cover image.
- **MultiImageDrop**: drag & drop / browse up to 10 images at once, client
  compression, direct signed Cloudinary uploads with batch progress; wired
  into product Images and variant photo panels (hidden when keyless).
- **One-click Duplicate product** (row menu): full copy incl. variant media
  as an unpublished draft with a unique `-copy` slug; SKUs left blank.
- **Order row quick actions**: "Mark as ‹next stage›" (ORDER_FLOW progression
  via `transitionOrderStatus`) + per-row Invoice PDF download.
- **Dashboard**: low-stock rows and a Restock link now open inventory.

## [Auth Redesign] — Phone-OTP-first login + profile completion — 2026-07-06

Mobile-number + OTP is now the primary sign-in (Flipkart/Zepto-style); email +
Google remain as a full alternate panel. Existing backend (NextAuth v5 JWT,
Google, credentials, user DB) reused — phone auth is a second Credentials
provider, not a rebuild.

### Added
- **Schema** (migration `phone_auth_profile`): `User.phone` unique (legacy
  values normalized to `+91…` + deduped in-migration), `phoneVerified`,
  `gender` enum, `dob`.
- **OTP backend**: `lib/otp.ts` (crypto 6-digit codes, sha256-hashed in
  `VerificationToken`, 5-min TTL, one active code per phone) + MSG91 delivery
  (`MSG91_AUTH_KEY`/`MSG91_TEMPLATE_ID`, `isConfigured.msg91`). Keyless: dev
  logs/toasts the code; production hides phone login entirely.
- **`phone-otp` NextAuth Credentials provider**: verifies the code, links by
  verified phone or silently auto-creates an account (placeholder email via
  `lib/phone-account.ts`) — no name/email/password asked at first login.
  Rate-limited per phone + per IP (`limiters.auth`).
- **Login UI** (`components/auth/auth-shell.tsx`): phone → OTP → in, as
  client-side view switches; `OtpInput` (6 boxes, auto-advance, paste, SMS
  autofill, countdown + resend, change number); "Continue with Email" premium
  panel hosting the existing LoginForm + Google button.
- **Profile completion** (`/account`): avatar upload (direct-to-Cloudinary via
  user-scoped `/api/account/avatar-signature`), gender chips + DOB, email
  change (uniqueness + re-verification), set/change password (current-password
  check when one exists), phone add/change with inline OTP verify.

### Notes
- New auth surfaces reuse the `btn-rich`/`shadow-elev-*` premium language;
  keyless-parity: production without MSG91 keys shows the classic email-first
  card unchanged.
- Verified: typecheck/lint/build (shared First-Load 103 kB unchanged), DB
  smoke (unique phone, OTP token round-trip, account create/link), login
  screenshots at 390/1280.

## [CMS Phase 4] — Homepage Section Builder — 2026-06-25

Admins can show/hide and drag-reorder homepage sections from `/admin/homepage`.
Strictly additive: each existing section's markup is unchanged — only order and
visibility are admin-controlled, and the homepage is identical until customized.

### Added
- **Schema** (additive migration `home_sections`): `HomeSection` model (key unique,
  enabled, sortOrder). Registry in `lib/home-sections.ts` (10 sections in current order).
- **Backend**: `getHomeSectionOrder()` (`lib/queries/home.ts`) merges admin config with
  the registry (saved order first, new keys appended; all-enabled default).
  `lib/actions/admin/home-sections.ts`: `ensureHomeSections`, `toggleHomeSection`,
  `reorderHomeSections` (`requirePermission("appearance")`).
- **Homepage** (`app/(storefront)/page.tsx`) refactored to a keyed section map rendered
  in the configured order; sections with unmet data conditions (no featured/hero slides/
  logged-out) stay hidden automatically.
- **Admin** `/admin/homepage` (gated by `appearance`): `home-sections-manager.tsx` with
  native HTML5 drag-and-drop reorder + show/hide switches. New nav item.

### Notes
- Reuses the native-DnD + `reorder(keys[])` pattern; no new dependencies.
- Verified live: homepage identical by default; hiding a section removes it; reorder
  changes the layout; restored to default after testing. Typecheck/lint/build green (52 routes).

## [CMS Phase 3] — Appearance & Website Settings — 2026-06-25

Admins can now manage the storefront's branding, theme, announcement bar, contact
details and SEO defaults without code, from `/admin/appearance`. Additive; every value
falls back to `config/site.ts`.

### Added
- **Schema** (additive migration `appearance_settings`): extended `StoreSetting` with
  siteName, tagline, logo, logoDark, favicon, primaryColor, secondaryColor,
  announcement(+active+link), whatsapp, businessHours, mapsEmbedUrl, metaTitle,
  metaDescription, ogImage.
- **Admin** `/admin/appearance` (gated by `appearance` permission): `appearance-form.tsx`
  with Branding / Theme / Announcement / Contact / Social / SEO sections, color pickers,
  and `ImageUploadField` for logo/dark-logo/favicon/OG. `updateStoreSettings` now uses
  `requirePermission("appearance")`. New nav item; `/admin/settings` links here (the old
  inline store form was removed).
- **Storefront wiring**: `AnnouncementBar` (top promo bar) + floating `WhatsAppButton`;
  admin **theme colors** injected as `--primary`/`--secondary` CSS-var overrides; uploaded
  **logo** in header + footer; **business hours/address** in the footer; and **SEO defaults
  + favicon** wired into the root layout's `generateMetadata()` (config fallback).

### Notes
- `getStoreSettings()` extended with config fallbacks; no new dependencies.
- Verified live: setting announcement/color/WhatsApp/hours/meta-title reflects on the
  storefront; super admin + appearance sub-admin can manage it; other-section access still
  blocked. Test values reset afterward. Typecheck/lint/build green (51 routes).

## [CMS Phase 2] — Product page UX redesign + mobile — 2026-06-25

Premium, mobile-first redesign of the product detail purchase experience.
Frontend-only; no schema or API changes.

### Changed
- **`components/storefront/product-purchase.tsx`** redesigned: clearer price block with
  savings ("You save ₹X") and tax note; nutrition **highlight chips**; larger
  **variant pills** (≥52px) showing per-variant price + sold-out state; bigger
  **quantity stepper** (44px targets); stronger **button hierarchy** (Buy now primary,
  Add to cart secondary, icon wishlist); **delivery estimate** (date-fns, 3–5 days);
  **free-shipping** progress (reuses `FREE_SHIPPING_THRESHOLD`); a row of **trust badges**;
  and a **sticky mobile add-to-cart bar** that appears (via IntersectionObserver) once the
  inline CTAs scroll off-screen, with safe-area inset padding.
- **`components/storefront/product-reviews.tsx`**: added a **rating-distribution** bar
  chart, a **Verified** buyer badge, roomier cards, and a nicer empty state.
- **Product page** (`app/(storefront)/products/[slug]/page.tsx`): passes top-3 nutrition
  facts as highlights and adds mobile bottom padding so the sticky bar never overlaps content.

### Notes
- No new dependencies (reuses `date-fns`, `lib/shipping.ts`, `lib/format.ts`, existing UI).
- Verified: all new elements render; existing tabs/nutrition/related/JSON-LD intact; no
  regressions on other pages. Typecheck/lint/build green.

## [CMS Phase 1] — Homepage Hero Slider Manager — 2026-06-25

First phase of the WordPress-style CMS: admins can manage the homepage hero slider
without code. Delivered additively (no rewrites; slider renders only when active
slides exist).

### Added
- **Schema** (additive migration `hero_slides`): `HeroSlide` model (title/subtitle/
  description, desktop + mobile image, CTA text/url, product or category link, overlay,
  button color, text alignment, sort order, active, publish/expiry schedule) with
  `product`/`category` relations.
- **RBAC**: new `"appearance"` permission key (`lib/permissions.ts`) covering CMS sections.
- **Backend**: `lib/validations/admin.ts#heroSlideSchema`; `lib/actions/admin/hero.ts`
  (save/toggle/duplicate/delete/reorder, all `requirePermission("appearance")`);
  `lib/queries/home.ts` (`getActiveHeroSlides` with schedule window + `heroSlideHref`).
- **Admin** (`/admin/hero`, guarded by `appearance`): `hero-slider-manager.tsx` —
  native HTML5 **drag-and-drop reordering**, add/edit dialog (reusing `ImageUploadField`
  ×2, product/category selects, overlay slider, alignment + button-color, schedule),
  **duplicate**, publish/unpublish toggle, and a **live preview** modal. New nav item.
- **Storefront**: premium responsive `hero-slider.tsx` (art-directed desktop/mobile
  images via `<picture>` + `cldUrl`, overlay, alignment, CTA, autoplay with hover/tab
  pause + reduced-motion, dots + arrows + swipe), rendered right after Stories.

### Notes
- No new dependencies (native DnD; reused embla-era patterns, Cloudinary, RBAC).
- Verified: slide renders after Stories; unpublish hides it; super admin manages it;
  a sub-admin without `appearance` is blocked (307). Typecheck/lint/build green (50 routes).
- Remaining CMS phases (product-page UX, appearance/settings, section builder, banners,
  navigation, footer, media library, content) are the agreed backlog.

## [Admin RBAC] — Sub-admins, permissions & store settings — 2026-06-25

### Added
- **Roles**: `SUPER_ADMIN` (main admin) added to the `Role` enum; the bootstrap admin
  is promoted to it. Sub-admins use role `ADMIN` with a `User.permissions` array.
- **Schema** (additive migration `admin_rbac`): `Role.SUPER_ADMIN`; `User.permissions`,
  `contactEmail`, `address`, `isActive`; new `StoreSetting` singleton.
- **RBAC core**: `lib/permissions.ts` (section keys + `hasPermission`),
  `lib/auth.ts` (`getAdminUser` DB-fresh context, `isSuperAdmin`, `requireSuperAdmin`,
  `requirePermission`; `requireAdmin`/`isAdmin` now accept both admin roles),
  `lib/admin-guard.ts` (`guardSection` page redirect). Middleware allows both admin roles.
- **Admin management** (`/admin/admins`, SUPER_ADMIN only): create/edit/activate/delete
  sub-admins with per-section permission checkboxes, phone, contact email, address and
  optional photo. Safety guards (no self-delete/deactivate, no super-admin delete, unique
  email, deactivated admins can't sign in).
- **Self-service**: any admin can change their own login email + password from
  `/admin/settings`.
- **Editable store settings**: SUPER_ADMIN edits support email/phone, address, socials and
  an announcement (`StoreSetting`); the storefront footer now reads them with a config
  fallback (`lib/queries/settings.ts`).
- **Permission-aware UI**: admin nav filters by permissions; every admin section page is
  guarded; section server actions now require the matching permission; the dashboard only
  renders widgets the admin may see.

### Notes
- Authorization is layered and **DB-fresh** so a stale JWT can't grant access.
- Verified end-to-end: super admin full access; a products+stories sub-admin is allowed
  into those sections only, blocked (307) elsewhere, and sees a restricted dashboard.
- Quality gates: typecheck, ESLint, production build (49 routes) — all green.

## [M6] — SEO, PWA, Analytics, Notifications, Deploy — 2026-06-25

### Added
- **SEO**: dynamic `app/sitemap.ts` (static pages + active products + categories) and
  `app/robots.ts` (disallows private/transactional areas, links the sitemap).
  Structured data helpers in `lib/seo.ts` — Organization + WebSite (with SearchAction)
  in the root layout, BreadcrumbList on product and category pages (Product JSON-LD
  already existed).
- **Generated images** via `next/og`: `app/icon.tsx`, `app/apple-icon.tsx`,
  `app/opengraph-image.tsx` (brand-green). `siteConfig.ogImage` now points at the
  generated OG route.
- **PWA**: `app/manifest.ts`, a conservative service worker (`public/sw.js` —
  network-first navigations with an `/offline` fallback, cache-first static assets,
  never intercepts api/admin/account/checkout/auth), a production-only registrar
  (`components/service-worker-register.tsx`), and `app/offline/page.tsx`.
- **Analytics**: `components/analytics.tsx` — injects a Plausible/Umami-style script
  only when `NEXT_PUBLIC_ANALYTICS_SRC` + `_DOMAIN` are set; renders nothing otherwise.
- **Order notifications**: `orderStatusEmail` (shipped/delivered/cancelled/refunded)
  sent from the admin `updateOrderStatus` action (best-effort, reuses Resend infra).
- **Hardening**: `/api/ai/chat` rate-limited via the existing `limiters.ai` (Upstash,
  fail-open; 429 + friendly message when exceeded). The chat client renders
  `X-AI-Fallback` responses inline.
- **`DEPLOYMENT.md`**: Vercel + Neon + integration setup + production hardening checklist.

### Notes
- Icons/OG need no binary assets (generated at the edge). SW registers in production
  only. Quality gates: typecheck, ESLint, production build (48 routes), runtime smoke
  (SEO/PWA endpoints, structured data, AI streaming, rate-limit no-op) — all green.

## [M5] — Stories Viewer + Cloudinary Uploads — 2026-06-25

### Added
- **Immersive stories viewer** (`components/storefront/stories-viewer.tsx`):
  full-screen overlay with segmented progress bars, auto-advance (images 5 s, video
  on end), tap zones + keyboard navigation, product CTA, pause when the tab is hidden,
  and body scroll lock. The storefront stories rail now opens it instead of linking out.
- **Story view tracking** (`lib/actions/stories.ts#recordStoryView`) — increments
  `Story.viewCount` and logs a `StoryView`.
- **Real Cloudinary uploads** in admin: `lib/actions/admin/upload.ts` (signed,
  server-side via the existing `uploadImage`) + `components/admin/image-upload-field.tsx`
  (file upload when Cloudinary is configured, pasted-URL fallback otherwise). Wired
  into product, category and story admin forms.
- **Image optimization** (`lib/cld.ts#cldUrl`): injects `f_auto,q_auto` (+ optional
  resize) into Cloudinary URLs; a no-op for other hosts.

### Changed
- `next.config.ts` server-action body limit raised to 12 MB (image data URIs).
- Replaced plain URL inputs with the upload field for product images, the category
  image and story cover/media across the admin forms.

### Notes
- Cloudinary detected as **configured** in this environment — uploads are live.
- Quality gates: typecheck, ESLint, production build (36 routes), runtime smoke — green.

## [M4] — AI (Groq) — 2026-06-25

### Added
- **Provider-agnostic AI layer** under `lib/ai/`: `provider.ts` (adapter registry —
  add OpenAI/Anthropic/Gemini later without caller changes), `settings.ts` (DB
  settings + usage metering), `retrieval.ts` (RAG seam returning `ContextChunk[]`),
  `prompts.ts`, `chat.ts` (orchestration), `search.ts`, `recommendations.ts`,
  `history.ts`.
- **Streaming AI chat** (`/assistant` + `app/api/ai/chat/route.ts`) using
  `streamText().toTextStreamResponse()`, consumed by `components/storefront/ai-chat.tsx`
  via `fetch`/`ReadableStream`. Grounded in catalog context.
- **Per-product assistant** on product pages (`product-ai-assistant.tsx`), grounded
  in the specific product (benefits, nutrition, storage, who-should-avoid, …).
- **Natural-language product search** on `/search`: extracts structured filters
  (category/price/sort) and runs a progressive catalog query; keyword fallback.
- **Recommendations**: personalized (wishlist + order category affinity) on home/cart,
  similar products on product pages, and a localStorage **recently-viewed** strip.
- **Chat history** for logged-in users (`AIChat`/`AIMessage`) with a transcript view
  at `/account/ai-history/[id]`; **admin usage metering** shown on `/admin/ai-settings`.

### Notes
- AI features **degrade gracefully** with no `GROQ_API_KEY` (friendly fallback,
  `X-AI-Fallback: 1`); verified with and without a key.
- Uses `generateText` + JSON parse (not `generateObject`) because Groq
  `llama-3.3-70b-versatile` doesn't support the `json_schema` response format.
- Quality gates: typecheck, ESLint, production build (36 routes), live + no-key
  runtime tests — all green.

## [M3] — Admin Panel — 2026-06-25

### Added
- **Admin shell** at `/admin`, gated by middleware **and** the layout (ADMIN only):
  responsive sidebar with a mobile sheet, top bar with theme toggle / view-store /
  sign-out (`app/admin/layout.tsx`, `components/admin/admin-nav.tsx`).
- **Dashboard** with KPI cards (revenue, orders, customers, products), recent orders,
  low-stock list and top products (`app/admin/page.tsx`, `lib/queries/admin.ts`).
- **Order management:** list with status filter, search and pagination; detail view;
  status transitions with payment side-effects and automatic restock on cancel/refund
  (`app/admin/orders/*`, `lib/actions/admin/orders.ts`).
- **Product CRUD:** list with search; create/edit form using React Hook Form field
  arrays for variants, images (by URL) and nutrition facts; publish/feature toggles;
  delete (`app/admin/products/*`, `components/admin/product-form.tsx`,
  `lib/actions/admin/products.ts`).
- **Inventory** quick-edit page (per-variant stock, low-stock filter).
- **Categories, Coupons, Stories** management (CRUD + toggles) with manager components.
- **Customers** list (orders + lifetime spend) and detail (orders, addresses).
- **AI Settings** form editing the `AISetting` singleton; **Site Settings** integration
  status page.
- Shared admin plumbing: `lib/validations/admin.ts` (Zod), `AdminResult` type,
  `requireAdmin()` in `lib/auth.ts`.

### Notes
- Money entered in rupees in the UI, stored/validated as paise on the server.
- Product edits preserve variant/image ids; deleting a category with products or a
  used coupon is blocked (coupon is deactivated instead).
- Quality gates: typecheck, ESLint, production build (35 routes), and an authenticated
  admin smoke test against live Neon data — all green.

## [M2] — Cart → Checkout → Razorpay → Orders — 2026-06-25

### Added
- Server-authoritative checkout: re-pricing + stock validation (`lib/orders.ts`),
  coupon validation (`lib/coupons.ts`), shared shipping rules (`lib/shipping.ts`).
- `createOrder` / `verifyPayment` / `applyCoupon` actions with **Razorpay live flow**
  and a **keyless mock flow** (`lib/actions/checkout.ts`).
- Idempotent, signature-verified Razorpay webhook (`app/api/webhooks/razorpay`).
- `/checkout`, `/checkout/success`, account order detail page, order confirmation email.

## [M1] — Storefront + Auth + Products — 2026-06-25

### Added
- Catalog (list/detail), categories, search, product gallery/reviews/wishlist.
- Full auth: register, login, Google OAuth, email verification, password reset.
- Account area: profile, addresses, orders, wishlist.

## [M0] — Foundation — 2026-06-24

### Added
- Next.js 15 + TS + Tailwind v4 + shadcn scaffold; full Prisma schema (23 models);
  service-client libs with keyless fallbacks; branded storefront shell.
- Neon PostgreSQL connected, `init` migration applied, database seeded.
