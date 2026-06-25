# Changelog

All notable changes to Nutriyet, grouped by milestone. Dates are when the work
landed in this workspace. This project is pre-1.0; versions track milestones.

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
