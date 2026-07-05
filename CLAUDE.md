# Nutriyet — Project Guide (CLAUDE.md)

> Production-grade, AI-powered health & nutrition e-commerce platform for **nutriyet.in**.
> This file is the single source of truth for how this codebase is built. Keep it
> updated as the project evolves. It is **project-specific** (do not put global prefs here).

---

## 1. Project Overview

Nutriyet is India's AI-assisted nutrition marketplace selling makhana, dry fruits,
seeds, protein, healthy snacks, organic foods and wellness products. It pairs a
fast, SEO-friendly storefront with an AI nutrition assistant, Razorpay payments,
Instagram-style product stories, and a full account + admin experience.

- **Live domain:** nutriyet.in
- **Repo location:** `D:\AnacondaProj\Ecommerce` (a Next.js app at the repo root,
  inside an otherwise Python/ML workspace).
- **Package manager:** npm (an `.npmrc` sets `legacy-peer-deps=true` for React 19
  peer ranges — keep it).

---

## 2. Tech Stack

| Concern        | Choice                                                              |
| -------------- | ------------------------------------------------------------------- |
| Framework      | **Next.js 15** (App Router, RSC, Server Actions, Turbopack dev)     |
| Language       | **TypeScript** (strict)                                             |
| UI             | **Tailwind CSS v4** + **shadcn/ui** (Radix primitives)              |
| State (client) | **Zustand** (cart, persisted to localStorage)                      |
| ORM / DB       | **Prisma 6** + **Neon PostgreSQL** (serverless, pooled + direct)    |
| Auth           | **NextAuth v5 (Auth.js)** — Google OAuth + Credentials, JWT session |
| Email          | **Resend** (React/HTML emails)                                      |
| Payments       | **Razorpay** (orders + checkout + webhook signature verification)   |
| Media          | **Cloudinary**                                                      |
| AI             | **Groq** via the **Vercel AI SDK v6** (`llama-3.3-70b-versatile`)   |
| Cache / limits | **Upstash Redis** (`@upstash/ratelimit`)                            |
| Validation     | **Zod v4**                                                          |
| Forms          | **React Hook Form** + `@hookform/resolvers`                        |
| Toasts         | **sonner**                                                          |
| Icons          | **lucide-react**                                                    |

### Pinned-version decisions (do not undo without a reason)
- **Next.js 15, not 16.** `create-next-app@latest` installs Next 16 (breaking);
  spec requires 15. Scaffolded with `create-next-app@15`.
- **Prisma 6, not 7.** The dev machine runs **Node 21.1.0 (EOL)**; Prisma 7's
  preinstall hard-requires Node 20.19+/22.12+/24+ and aborts. Move to Node 20/22
  LTS first, then bump to Prisma 7.
- **shadcn initialized with `-b radix`.** The default (`base-nova` = Base UI) has
  no `asChild` (uses a `render` prop) and breaks standard patterns.

---

## 3. Folder Structure

```
app/
  (storefront)/        Public storefront (route group, shared header/footer)
    page.tsx           Landing page
    products/          Catalog list + [slug] detail
    categories/        Category list + [slug]
    search/            Search results
    cart/              Cart (client, Zustand)
    checkout/          Checkout + checkout/success
    assistant/         AI nutrition assistant
    about/
    contact/           Contact form (server action) + business info + FAQ + map
    support/           Help & support hub (links to track/shipping/policies/AI)
    track/             Public guest order tracking (order # + checkout email)
    blog/              Blog list + [slug] (DB-driven, CMS-ready BlogPost model)
    shipping/ privacy/ terms/   Legal/policy pages (ContentPage override + code defaults)
  (account)/           Authenticated customer area (middleware-gated)
    account/           Profile, addresses, orders, orders/[orderNumber],
                       wishlist, ai-history
  (auth)/              login, register, forgot/reset password, verify-email
  admin/               ADMIN-only panel (guarded by middleware + layout)
    page.tsx           Dashboard; orders/, products/, inventory/, categories/,
                       coupons/, stories/, hero/ (slider CMS), banners/, homepage/,
                       appearance/, customers/, messages/ (contact inbox),
                       ai-settings/, settings/
  api/
    auth/[...nextauth] NextAuth handler
    ai/chat            Streaming AI chat (text stream; general + per-product)
    webhooks/razorpay  Razorpay webhook (signature-verified, idempotent)
  sitemap.ts / robots.ts          SEO (dynamic, DB-driven sitemap)
  manifest.ts                     PWA web manifest
  opengraph-image.tsx               Generated OG image (next/og)
  brand-icon/ brand-apple-icon/     Brand-default favicons (next/og routes; see §13)
  offline/             PWA offline fallback page (service worker in public/sw.js)
components/
  ui/                  shadcn primitives (do not hand-edit lightly)
  storefront/          Storefront components (product-card, cart-view, checkout-client, …)
  account/             Account components (address-form/manager, profile-form)
  admin/               Admin components (nav, page-header, product-form, *-manager, …)
  auth/                Auth forms + buttons
config/site.ts         Site metadata, nav, contact, social
lib/
  actions/             Server actions ("use server") — auth, account, checkout, reviews, wishlist
    admin/             Admin mutations — products, categories, coupons, stories, orders,
                       ai-settings (+ types.ts: AdminResult)
  ai/                  AI layer — provider (registry/seam), settings, retrieval (RAG seam),
                       prompts, chat (orchestration), search, recommendations (delegates), history
  recommendations/     Centralized recommendation service — events (tracking + signals),
                       service (all sections), intent (smart-search synonyms)
  queries/             Read helpers (catalog, products, wishlist, admin analytics, insights)
  validations/         Zod schemas (auth, account, checkout, review, admin)
  store/               Zustand stores (cart)
  prisma.ts            Prisma client singleton
  auth.ts / auth.config.ts   NextAuth (config is edge-safe; no Prisma in middleware)
  env.ts               Central env access + `isConfigured` feature flags
  format.ts            Money (paise) + date helpers
  shipping.ts          Shipping rules (client-safe)
  orders.ts            Order pricing, number gen, markOrderPaid (server)
  coupons.ts           Coupon validation + discount math
  razorpay.ts / groq.ts / cloudinary.ts / redis.ts / email.ts / emails.ts / seo.ts / rate-limit.ts / tokens.ts
prisma/
  schema.prisma        23 models (SQL-validated)
  migrations/          Prisma Migrate history
  seed.ts              Idempotent seed (admin, categories, products, coupons, stories)
scripts/db-check.ts    DB sanity report (counts + relational sample)
middleware.ts          Auth guards (/account, /admin) + security headers
types/                 Ambient types (next-auth.d.ts)
```

---

## 4. Coding Standards

- **Strict TypeScript.** No `any` unless unavoidable; prefer Prisma-generated and
  Zod-inferred types. Type server-action inputs as `unknown` and parse with Zod.
- **Server-first.** Default to React Server Components. Add `"use client"` only
  when you need state, effects, or browser APIs.
- **Never *call* a function exported from a `"use client"` module in a Server
  Component** — it throws in a production build ("Attempted to call X from the
  server but X is on the client"). Client components may only be *rendered* / have
  props passed. Pure helpers/types shared by both must live in a plain (non-client)
  module. Example: product form value mapping is in
  `lib/admin/product-form-values.ts` (server-safe), imported by both the edit page
  (server) and `components/admin/product-form.tsx` (client).
- **Server Actions** (`"use server"`) for mutations. Every exported member of a
  `"use server"` file must be an async function (type exports are fine).
- **Never trust the client for prices, stock, totals or roles.** Re-price and
  re-authorize on the server (see `lib/orders.ts#priceCart`).
- **Validate every external input with Zod** at the boundary.
- **Keep `lib/auth.config.ts` edge-safe** — no Prisma/bcrypt imports (it runs in
  middleware). Prisma-backed auth lives in `lib/auth.ts`.
- **Comments** only where they add real value (the "why", invariants, gotchas).
- Reuse existing components and helpers before writing new ones. Match the
  surrounding code's style, naming and density.

### Naming conventions
- **Files:** kebab-case (`checkout-client.tsx`, `order-summary-card.tsx`).
- **React components:** PascalCase. **Functions/vars:** camelCase. **Constants:**
  UPPER_SNAKE_CASE (e.g. `FREE_SHIPPING_THRESHOLD`).
- **Prisma models:** PascalCase singular; enums UPPER_SNAKE values.
- **Routes:** lowercase; dynamic segments `[slug]` / `[orderNumber]`; route groups
  `(storefront)`, `(account)`, `(auth)` (no URL impact).
- **Server actions:** verb-first (`createOrder`, `saveAddress`, `toggleWishlist`).

---

## 5. UI / UX Guidelines

- Mobile-first, fully responsive; design at 360px then scale up.
- Accessible by default: semantic HTML, labelled controls, keyboard support,
  visible focus, `aria-*` on icon-only buttons, sufficient contrast.
- Use shadcn/ui primitives + Tailwind tokens (`bg-primary`, `text-muted-foreground`,
  `border`, `accent`) — never hard-code hex in components; use theme variables.
- Rounded, soft cards (`rounded-xl`/`rounded-2xl`), generous spacing, calm green
  brand. Loading via `Skeleton`/`animate-pulse`; feedback via `sonner` toasts.
- Images via `next/image` with explicit `sizes`. Money via `formatPrice` (never
  raw division).

### Premium design language (added in the UI uplift — reuse these, don't reinvent)
- **Warm-gold accent**: `bg-gold` / `text-gold` / `text-gold-foreground` tokens
  (`app/globals.css`) for premium highlights only (best-seller badges, savings, stars,
  sparkles). Green stays the primary brand/action color.
- **Elevation**: `shadow-elev-1/2/3` (soft layered shadows) instead of flat `shadow-md`;
  pair `hover-lift` with an elevation class for card hover.
- **Motion is reduced-motion-gated**: `animate-fade-up`, the `[data-reveal]` scroll-reveal
  (via the `Reveal` component), `.shimmer`, and `BlurImage`'s blur-up are all suppressed under
  `prefers-reduced-motion: reduce`. Keep any new motion behind that gate.
- **Reuse**: `components/storefront/blur-image.tsx` (image blur-up, no CLS — keep aspect
  ratios), `reveal.tsx` (scroll reveal), `empty-state.tsx` (all empty states),
  `skeletons.tsx` (`ProductCardSkeleton`/`ProductGridSkeleton`/`SectionSkeleton`) + route
  `loading.tsx` files. Product gallery has a `Dialog` lightbox; header search uses
  `/api/search/suggestions` (typeahead). Don't use `useSearchParams` in layout-mounted client
  components (static-render deopt) — read `window.location` on mount instead.

### Color palette (brand = fresh nutrition green; defined in `app/globals.css`, OKLCH)
| Token        | Light                    | Role                         |
| ------------ | ------------------------ | ---------------------------- |
| `--primary`  | `oklch(0.57 0.14 150)` (~#16803c green) | Primary actions, brand |
| `--accent`   | `oklch(0.95 0.04 145)`   | Subtle green surfaces        |
| `--background`| `oklch(0.995 0.004 120)`| App background               |
| `--foreground`| `oklch(0.18 0.02 150)`  | Text                         |
| `--destructive`| `oklch(0.577 0.245 27)`| Errors/danger                |
| `--radius`   | `0.7rem`                 | Corner radius scale          |

Full light + `.dark` token sets live in `app/globals.css`. Dark mode via
`next-themes` (`ThemeProvider`).

---

## 6. Database Architecture

- **Neon PostgreSQL**, accessed two ways (see `prisma/schema.prisma` datasource):
  - `DATABASE_URL` — **pooled** (`-pooler` host) for app runtime / serverless.
  - `DIRECT_URL` — **direct** (non-pooler) for Prisma Migrate.
- Neon compute **scales to zero**; the first connection after idle can throw
  `P1001` (cold start). Retry once — it warms up.
- **23 domain models** across: Auth (User, Account, Session, VerificationToken,
  PasswordResetToken), Catalog (Category, Brand, Product, ProductVariant,
  ProductImage, Review), Customer (Address, Cart, CartItem, WishlistItem),
  Commerce (Coupon, Order, OrderItem), Stories (Story, StoryView), AI (AIChat,
  AIMessage, AISetting).
- **Money is stored as INTEGER paise** everywhere (₹1 = 100 paise) — Razorpay-ready,
  no float errors. Always use `lib/format.ts` helpers and `effectivePrice`.
- **Order snapshots:** `Order.shippingAddress` (JSON) and `OrderItem` fields
  (productName/variantLabel/image/price) snapshot values at purchase time so later
  catalog edits don't rewrite history.
- Indexed foreign keys throughout; unique constraints on slugs, SKUs, coupon codes,
  `orderNumber`, and natural keys (`[cartId, variantId]`, `[userId, productId]`).

### Database workflow
```bash
npm run db:generate   # prisma generate
npm run db:migrate    # prisma migrate dev (uses DIRECT_URL)
npm run db:push       # prisma db push (prototype only)
npm run db:seed       # tsx prisma/seed.ts (idempotent)
npm run db:studio     # prisma studio
npm run db:check      # scripts/db-check.ts — counts + relational sanity report
```

---

## 7. API & Server-Action Conventions

- **Mutations = Server Actions** in `lib/actions/*` (`"use server"`). Inputs typed
  `unknown`, parsed with Zod, returning a discriminated result, e.g.
  `{ ok: true, … } | { ok: false, error }` or `{ error?, success? }`.
- **Reads** in `lib/queries/*` or directly in RSC pages via Prisma.
- **Route Handlers** (`app/api/**/route.ts`) only for third-party integrations,
  webhooks (NextAuth, Razorpay webhook) and binary responses (invoice PDF). Webhooks
  verify signatures over the **raw** body and must be **idempotent** (order confirmation
  is a no-op once `stockDeducted`).
- **Auth in actions:** call `getCurrentUser()` / `requireUser()` from `lib/auth.ts`;
  never rely on client-sent identity. After writes, `revalidatePath(...)`.
- **Admin actions** live in `lib/actions/admin/*`, start with `await requireAdmin()`,
  and return the shared `AdminResult<T>` (`{ ok: true, data? } | { ok: false, error }`).
  Forms are RHF client components that call the action and toast the result. Prices
  are entered in **rupees** in the UI and converted to **paise** before the call;
  the server schema (`lib/validations/admin.ts`) validates paise authoritatively.
- **Errors:** return friendly messages to the UI; `console.error` details server-side.
- **Bulk actions (admin tables)** use a shared, reusable foundation: `useBulkSelection(ids)`
  (`lib/admin/use-bulk-selection.ts`, prunes stale ids), the floating `<BulkBar>`
  (`components/admin/bulk/bulk-bar.tsx`, built-in confirm dialog for destructive actions),
  `toastBulk` (`lib/admin/run-bulk.ts`) and client-side `downloadCsv` (`lib/admin/csv-export.ts`).
  Each module exposes one `bulk<Entity>Action(ids, action)` server action returning
  `AdminResult<BulkOutcome>` (`{ done, skipped, note? }`) that **reuses the existing single-record
  guards**. **Delete policy = deactivate (reversible) + safe hard-delete only** (no soft-delete
  column): categories with products and coupons used by orders are skipped/deactivated, customers
  are deleted only with zero orders (else deactivate; scoped to `role:USER` so admins are never
  touched). `<BulkBar>` takes an optional `children` slot for inline controls (e.g. the Orders
  status `<select>`). Wired into **Products, Categories, Coupons, Customers, Messages, Affiliates**
  (wave 1) and **Orders** (status update via `bulkUpdateOrderStatus`/`transitionOrderStatus`,
  sequential invoice PDF download, CSV export, shipping-label stub), **Returns** (approve/reject/
  mark-refunded via `bulkReturnAction` reusing `transitionReturnStatus`/`processRefund`; bulk refund
  settles to the original method and skips COD/manual), **Stories/Hero/Banners** (publish/unpublish/
  delete; the card managers keep their existing per-item drag/priority ordering) and **Reviews**
  (`/admin/reviews`, `products` permission — moderate: approve/hide via `isApproved` + delete +
  export; `bulkReviewAction` recomputes the product rating aggregate) and **Notifications**
  (`/admin/notifications`, `customers` permission — admin oversight of all in-app `Notification`
  rows: bulk mark read/unread/delete). To add a module: drop checkboxes + `<BulkBar>` into its
  (client) table and add a `bulk<Entity>Action`.

---

## 8. AI Integration Architecture (Groq) — implemented in M4

Everything AI lives under **`lib/ai/*`** with clean seams so the provider can be
swapped and RAG added later without touching callers.

- **Provider seam** (`lib/ai/provider.ts`): a small adapter registry keyed by
  `AIProviderId` (today only `"groq"`). `getModel(modelId)` returns a `LanguageModel`
  or `null`; `aiAvailable()` reports configuration. Adding OpenAI/Anthropic/Gemini =
  register one adapter. The low-level Groq client stays in `lib/groq.ts`.
- **Settings** (`lib/ai/settings.ts`): `getAISettings()` folds the single-row
  **`AISetting`** table over env defaults (model, temperature, maxTokens, system
  prompt, feature flags). `recordAIUsage(tokens)` meters usage. **The API key is
  never in the DB** — only in `GROQ_API_KEY`; model from `GROQ_MODEL`
  (default `llama-3.3-70b-versatile`). Never hardcode the model.
- **Retrieval seam (RAG-ready)** (`lib/ai/retrieval.ts`): `retrieveProductContext()`
  returns `ContextChunk[]` from keyword catalog lookup today. Swap the body for
  vector search later — callers (chat/product assistant) are unchanged.
- **Prompts** (`lib/ai/prompts.ts`): persona + system-prompt builders; honors the
  admin-configured system prompt override.
- **Chat orchestration** (`lib/ai/chat.ts`): `runAssistantStream()` resolves
  settings/flags, grounds with context, returns a `streamText` result, and exposes
  an `onFinish(text, tokens)` hook (used by the route for metering + history). The
  HTTP route (`app/api/ai/chat/route.ts`) returns `toTextStreamResponse()` (plain
  text stream, consumed via `fetch`/`ReadableStream` in `components/storefront/ai-chat.tsx`).
- **Search** (`lib/ai/search.ts`): `aiProductSearch()` extracts structured filters
  with **`generateText` + JSON parse** (NOT `generateObject` — see decisions), then a
  progressive query (category/price → phrase → tokens → price-only). Falls back to
  keyword search when AI is off/unavailable.
- **Recommendations** (`lib/ai/recommendations.ts`): deterministic, DB-driven
  (wishlist + order category affinity, topped up with best sellers) so it works with
  no key. Similar products use the existing related query; recently-viewed is a
  localStorage client component.
- **Persistence**: conversations for logged-in users in **`AIChat`/`AIMessage`**
  (`/account/ai-history` + transcript). Admin controls + usage at `/admin/ai-settings`.
- **Graceful degrade**: with no key (or AI disabled), the chat route returns a
  friendly plain-text message (`X-AI-Fallback: 1`), pages render, search keyword-falls-back.

---

## 8a. Admin roles & permissions (RBAC)

- **Two admin roles** (`Role` enum): `SUPER_ADMIN` (main admin — full access, manages
  admins + store settings + own credentials) and `ADMIN` (sub-admin — access limited to
  the sections in `User.permissions`). `USER` is a customer.
- **Permission keys** (`lib/permissions.ts`): `products, stories, orders, returns, categories,
  coupons, inventory, customers, ai, appearance`. A sub-admin only reaches a section if its key is in
  their `permissions` array; super admins always pass. Dashboard + Settings are available
  to every admin (the dashboard only renders widgets the admin is permitted to see).
- **Enforcement is layered & DB-fresh** (a stale JWT can't grant access):
  - `middleware.ts` — coarse gate: any admin (`ADMIN`/`SUPER_ADMIN`) may enter `/admin`.
  - `lib/auth.ts#getAdminUser` — loads role + permissions from the DB for the session user
    (returns null if not an admin or `isActive=false`). All admin authz derives from this.
  - Pages: `guardSection("key")` (`lib/admin-guard.ts`) redirects unauthorized sub-admins
    to `/admin`. Super-admin-only pages (`/admin/admins`, store settings) check `isSuperAdmin`.
  - Server actions: `requirePermission("key")` / `requireSuperAdmin()` (throw `FORBIDDEN`).
  - Nav (`admin-nav.tsx`) filters items by the same permissions.
- **Admin management** (`/admin/admins`, SUPER_ADMIN only): create/edit/activate/delete
  sub-admins (name, login email, password, phone, contact email, address, photo, permission
  checkboxes). Guards: can't delete/deactivate self or a super admin; emails are unique;
  deactivated admins can't sign in (checked in the credentials `authorize`).
- **Self-service + store settings** (`/admin/settings`): any admin can change their own
  email + password; SUPER_ADMIN can edit `StoreSetting` (support email/phone, address,
  socials, announcement). The storefront footer reads `getStoreSettings()` (DB) with a
  `config/site.ts` fallback.

## 8b. CMS (WordPress-style admin management) — phased

Goal: let admins manage visible site content without code. Delivered in additive phases;
all gated by the **`appearance`** permission (super admins always pass).

- **Hero Slider (done)** — `HeroSlide` model; admin `/admin/hero` with native HTML5
  drag-and-drop reorder, duplicate, schedule, publish toggle, live preview
  (`components/admin/hero-slider-manager.tsx`, `lib/actions/admin/hero.ts`,
  `lib/queries/home.ts`). Storefront `components/storefront/hero-slider.tsx` renders right
  after Stories **only when active slides exist** (degrades to the current homepage).
  - **Hero video pipeline** — all video delivery goes through **`lib/video.ts`** (client-safe;
    HLS/DASH/watermark seams documented there). `cldVideoVariant` = H.264 MP4, `c_limit`
    (**never upscales/server-crops** — CSS `object-cover` frames it; the old `w_1920,c_fill`
    upscale was the "blurry hero video" bug), adaptive 1080/720/480 rung picked client-side
    from viewport + network (Save-Data/2g/3g step down) in `banner-video.tsx`. Per-slide
    **quality profile** (`HeroSlide.videoQuality`: max/balanced/eco → `q_auto:best/good/eco`),
    **poster** (`videoPoster`: auto first frame, picked thumbnail frame, or custom upload) and
    **`videoMeta`** (Json: resolution/duration/size/codec/fps/bitrate captured from the direct
    Cloudinary upload response via `ImageUploadField`'s `onUploadInfo` + XHR progress %).
    **Deleting/replacing slide media destroys the Cloudinary assets** (original + derived +
    CDN-invalidated) via `lib/cloudinary.ts#destroyAssetByUrl` — guarded so an asset shared by
    a duplicated slide is kept, and scoped to the `nutriyet/` namespace only.
  - **Product Reveal Animation (done)** — optional premium packet-pour animation overlaid on
    the hero slider (packet fades in → jagged rip-strip tears off → packet tilts → makhana
    pieces fall/bounce/roll to rest via a tiny semi-implicit Euler integrator → hold → fade →
    loop). Config in the additive **`StoreSetting.heroReveal` JSON blob** (migration
    `hero_reveal`; `lib/hero-reveal.ts` resolver — client-safe, `heroRevealLive` = enabled +
    packet image set) with every timeline/physics constant in `lib/hero-reveal-config.ts` (one
    tunable sheet: TIMELINE, PHYSICS, clip-path tear geometry, built-in SVG makhana sprite,
    responsive STAGE presets). Storefront `components/storefront/hero-reveal/*`: the shell
    (`hero-reveal-overlay.tsx`, statically imported by the homepage) is `aria-hidden` +
    `pointer-events-none` + `contain:strict` so it never shifts layout or blocks slider
    swipe/arrows/CTAs; the rAF engine (`reveal-engine.tsx` + `physics.ts`) is a **lazy chunk**
    (`next/dynamic ssr:false`, armed on first in-view via the shared showcase `useInView`,
    paused off-screen/tab-hidden, per-frame writes to refs only — no React state per frame).
    Reduced-motion users get a static opened packet (engine chunk never loads); an
    ErrorBoundary→null keeps the hero from ever blanking. Homepage (`page.tsx`) wraps the
    slider in a `relative` div ONLY when live — disabled = markup byte-identical, and the
    overlay auto-picks the side away from right-aligned slide copy (small top-corner stage on
    mobile, bottom corner md+). Admin card on `/admin/hero`
    (`components/admin/hero-reveal-card.tsx`, `updateHeroReveal` in `lib/actions/admin/hero.ts`,
    `appearance` permission): enable toggle (Zod blocks enabling without a packet image),
    packet/piece `ImageUploadField`s (folder `hero-reveal`; replaced images are destroyed on
    Cloudinary), speed/delay/piece-count ranges, and a live preview Dialog rendering the real
    storefront overlay with the `preview` prop (forces armed/active, bypassing the in-view gate).
- **Banner Manager (done)** — `Banner` model + named-placement registry (`lib/banners.ts`:
  `homeTop`/`productsTop`/`categoryTop`); admin `/admin/banners` (create/edit, desktop+mobile
  images via `ImageUploadField`, link to product/category/URL, priority, schedule, publish
  toggle, duplicate, delete — `components/admin/banner-manager.tsx`,
  `lib/actions/admin/banners.ts`). Storefront `<BannerStrip position>`
  (`components/storefront/banner-strip.tsx`, reads `lib/queries/banners.ts#getBanners`) renders
  active in-schedule banners by priority and **renders nothing when empty** (fully additive). New
  placement = add a key to `BANNER_POSITIONS` + drop a `<BannerStrip position>` in. Banners
  support optional dark-mode images (`desktopImageDark`/`mobileImageDark`, light fallback),
  smart focal-point mobile crops (`cldUrl` `gravity:"auto"`/`dpr:"auto"`) and a responsive
  `<picture>` via the shared `components/storefront/banner-card.tsx`; the admin form has a live
  theme/viewport preview.
- **Homepage Section editor (done)** — every content section is editable, not just
  order/visibility. `HomeSection.content` (JSON) overrides typed defaults in
  `lib/home-content.ts`; `getHomeSectionsContent()` merges them. The 8 editable sections (hero,
  aiBanner, the catalog headings, whyChooseUs, testimonials) render from shared
  `components/storefront/home/*` components reused by the admin live preview
  (`components/admin/home-section-editor.tsx`). Edit/save/reset-to-default via
  `saveHomeSectionContent`/`resetHomeSectionContent`; homepage is identical until edited.
  stories/heroSlider keep their dedicated managers (editor kind `none`). The behavioral
  **`trending`** and **`combos`** (Shop by Goal) sections are registry-driven too — they appear
  in the Section Builder with the heading editor, drag-reorder and enable toggle like any other
  section (add a key to `HOME_SECTIONS` + content default + a keyed node in `page.tsx`).
- **3D Showcase (done)** — premium Apple/Tesla-style hero product showcase at the top of the
  homepage, **true WebGL** via `@react-three/fiber` + `drei` + `@react-three/postprocessing`
  (HDRI-style studio reflections built procedurally from `<Lightformer>`s — no external HDRI/CDN
  asset; a `MeshReflectorMaterial` mirror floor; PBR/clearcoat product plane; soft alpha-shaped
  contact shadow; idle float + cursor/gyro parallax + slow cinematic camera drift; subtle
  bloom/DoF/vignette; crossfade between products). Fully reduced-motion gated. **The whole WebGL
  stage is lazy** (`next/dynamic` `ssr:false`, mounts only once scrolled into view) so it never
  blocks first paint and shared First-Load JS stays ~103 kB; the render loop pauses off-screen /
  tab-hidden (IntersectionObserver + `frameloop`), is **perf-tiered** (mobile/low-power drops DoF,
  shadows, resolutions — lightweight heuristic, no `detect-gpu`), disposes textures on swap/unmount,
  and survives WebGL context loss (error boundary → flat fallback image). Engine:
  `components/storefront/showcase-3d.tsx` (SSR chrome + lazy boundary) + `components/storefront/showcase/*`
  (stage/scene/product-plane/lighting/floor/effects/environment/camera + hooks). **Catalog** of
  presets/flags stays in `lib/showcase.ts` (10 animations, 5 backgrounds, motion flags, 0-100 knobs);
  **all numeric look/motion constants** live in `lib/showcase-config.ts` (one tunable place). Admin
  `/admin/showcase` (`components/admin/showcase-manager.tsx`, `lib/actions/admin/showcase.ts`) —
  global enable (`StoreSetting.showcase3dEnabled`) + unlimited `ShowcaseItem` rows. **Admin uploads
  ONE image**: `components/admin/showcase-image-field.tsx` + `lib/showcase-image.ts` EXIF-correct it,
  remove the background **in-browser** (`@imgly/background-removal`, lazy-imported WASM; needs the
  `onnxruntime-web` peer dep), alpha-bbox auto-frame (center/pad, undistorted), and upload BOTH the
  original (→ `ShowcaseItem.image`) and the cutout (→ `ShowcaseItem.imagePng`); the stage prefers the
  cutout. Low-confidence removal falls back to the original (toggle + URL-paste keyless fallback).
  Featured-product link, animation/background, rotation/float/zoom sliders, native HTML5 drag-reorder,
  duplicate, publish toggle and a **live WebGL preview** (reuses the storefront component). Storefront
  reads `getActiveShowcase()`; renders nothing unless enabled with published items, so the homepage is
  unchanged by default.
- **Content pages (foundation done)** — storefront pages for every footer/nav link, all
  CMS-ready data models in place (admin editors are a later phase):
  - `/blog` + `/blog/[slug]` — `BlogPost` model, `lib/queries/blog.ts`; renders published
    posts (sanitized HTML), empty-state friendly, Article + Breadcrumb JSON-LD.
  - `/shipping`, `/privacy`, `/terms` — `ContentPage` model overrides the professional
    defaults in `lib/legal-content.ts` (shared `LegalPageView`); works with zero rows.
  - `/contact` — `ContactMessage` model; `submitContactMessage` (Zod + rate-limit + persist +
    best-effort email) via `components/storefront/contact-form.tsx`; business info, FAQ, map.
  - `/track` — public guest order tracking: `trackOrder(orderNumber, email)` matches the
    checkout email and returns a trimmed DTO + status timeline (no auth).
  - `/support` — help hub linking the above. Footer "Track Order" now points at `/track`.
- **Content admin editors (done)** — all gated by `appearance`:
  - **Blog** (`/admin/blog`, `components/admin/blog-manager.tsx`, `lib/actions/admin/blog.ts`):
    `BlogPost` CRUD (title/auto-slug, excerpt, HTML content, cover via `ImageUploadField`, author,
    tag, publish toggle, publish date) with the shared `<BulkBar>` (publish/unpublish/delete). Content
    is `sanitizeRichText`-sanitized on save; saves revalidate `/blog` + `/blog/[slug]` + sitemap.
  - **Legal** (`/admin/legal`, `legal-manager.tsx`, `lib/actions/admin/content.ts`): per-page editor
    for Shipping/Privacy/Terms — `saveContentPage` upserts a `ContentPage` override (sanitized);
    `resetContentPage` deletes it to fall back to the `lib/legal-content.ts` default. The editor
    pre-fills from the default HTML (`legalDefaultHtml`) and shows Custom/Default status.
  - **Contact inbox** — already shipped at `/admin/messages` (reply + status + delete + bulk).
- **Backlog (one phase per turn):** Navigation Builder (`MenuItem`); Footer Builder; Media Library
  (`MediaAsset` + Cloudinary); popups/ads.
- **CMS conventions:** reuse RBAC (`requirePermission("appearance")` / `guardSection`),
  `AdminResult` actions, Zod schemas in `lib/validations/admin.ts`, `ImageUploadField` +
  Cloudinary, `cldUrl` for delivery. Reordering uses native HTML5 DnD + a `reorder(ids[])`
  action (no DnD library). Singletons extend `StoreSetting`; lists are new additive models.

## 8c. Affiliate / Influencer Program (done)

A full referral-marketing program (Amazon-Associates / influencer style) layered additively on
orders. Gated by a new **`affiliates`** RBAC permission (`lib/permissions.ts`); super admins
always pass. Everything degrades to nothing when `StoreSetting.affiliateEnabled = false`.

- **Models** (`prisma/schema.prisma`): `Affiliate` (one per `User`, `@unique`; `code`, optional
  linked `Coupon`, role/status, per-affiliate commission override, payout details — UPI/bank),
  `AffiliateClick` (referral click log, anon/user, device/ipHash), `CommissionRule`
  (PRODUCT/CATEGORY/ROLE-scoped rate overrides, unique per scope tuple), `Commission`
  (one per order `@unique`, base/amount, lifecycle status, `matureAt`, `payoutId`, `meta` JSON
  audit of per-line math), `Payout` (`PAY-…` number, batches APPROVED commissions, method/reference),
  `MarketingAsset` (the marketing kit — banners/logos/captions). Enums: `AffiliateRole`
  (INFLUENCER/AFFILIATE/BRAND_AMBASSADOR/NUTRITIONIST/GYM_PARTNER/BLOGGER/YOUTUBE_CREATOR/
  INSTAGRAM_CREATOR), `AffiliateStatus`, `CommissionType` (PERCENT/FIXED), `CommissionStatus`
  (PENDING→APPROVED→PAID / CANCELLED), `CommissionScope`, `PayoutStatus`, `PayoutMethod`,
  `MarketingAssetType`. Settings live on `StoreSetting`: `affiliateEnabled`, `affiliateCookieDays`
  (default 30), `affiliateDefaultCommissionType/Value` (PERCENT 10%), `affiliateMinPayout` (₹500).
- **Attribution** (`lib/affiliate/attribution.ts`, `middleware.ts`): a `?ref=<code>` visit sets the
  edge `nut_ref` last-click cookie (cookie-only in middleware; click row logged by `/ref/[code]`
  route + the `AffiliateTracker` client beacon → `/api/affiliate/click`). At checkout
  (`lib/actions/checkout.ts#createOrder`) `resolveAttribution` picks the **coupon's affiliate first,
  else the cookie referral**, excludes self-referrals, and snapshots `Order.affiliateId`/`referralCode`.
- **Commission engine** (`lib/affiliate/commissions.ts`): `createOrderCommission` (called from
  `lib/orders.ts#confirmOrder`, idempotent via `orderId @unique`) computes **per line** = rate ×
  post-discount line value (PERCENT) or value × qty (FIXED), **excluding tax & shipping**. Rate
  precedence: **PRODUCT rule → CATEGORY rule → affiliate override → ROLE rule → store default**.
  Lifecycle: created **PENDING**; `setCommissionMature` (at DELIVERED) stamps `matureAt = delivered +
  returnWindowDays`; `matureCommissions()` flips due PENDING→APPROVED (payable) — invoked lazily
  on the affiliate dashboard + payout request and via an explicit admin "run maturation" action
  (no cron needed); `voidCommission` (at cancel/refund) → CANCELLED. Every transition notifies
  in-app (`lib/notifications.ts`) + emails (`lib/emails.ts`).
- **Public landing** (`/affiliate`, storefront route group): marketing page (hero with the live
  default commission rate, how-it-works, feature grid, FAQ) with a smart CTA → `/account/affiliate`
  (middleware sends logged-out visitors through login and back). Linked from the footer (Company →
  Affiliate Program) + sitemap; shows "applications paused" when `affiliateEnabled = false`.
- **Affiliate-facing** (`/account/affiliate`, `lib/actions/affiliate.ts`): apply form (role + pitch),
  dashboard (clicks/visitors/orders/revenue/conversion, balances, monthly series, referral link +
  QR via `/api/affiliate/qr`, coupon, marketing kit), payout-details form, request-payout
  (gated by `affiliateMinPayout`). Sidebar entry in `components/account/account-sidebar.tsx`.
- **Commission approval is automatic**, not manual: `Commission` is created PENDING on order
  confirm; `matureCommissions()` flips it PENDING→APPROVED once the order is DELIVERED and its
  return window has passed (lazy-swept on the affiliate dashboard + payout request + an admin
  "Run maturation" button). Cancel/refund voids it. The admin **Commissions** page
  (`/admin/affiliates/commissions`, `getAdminCommissions`) is for *visibility + edge cases*:
  status-filtered list with PENDING/APPROVED/PAID/CANCELLED totals, plus manual `approveCommission`
  (force-mature early) and `cancelCommission` (fraud/adjustment — releases from any open payout),
  both notifying the affiliate.
- **Payout lifecycle**: affiliate `requestPayout` (≥ `affiliateMinPayout`, default ₹500, set in
  Settings) batches APPROVED commissions into a `Payout` (REQUESTED). Admin **approves / rejects
  (with reason) / marks paid (method + reference)** at `/admin/affiliates/payouts`. Reject releases
  the commissions back to the available pool. **Every payout transition (approved/rejected/paid)
  sends an in-app notification + email** (`payoutUpdateEmail`/`payoutEmail`). Payout history
  (number, status, method, reference, amount, date) shows on both the affiliate dashboard and admin.
- **Admin** (`/admin/affiliates`, `lib/actions/admin/affiliates.ts`, `lib/queries/affiliate.ts`):
  list/detail (approve/reject/suspend/reactivate, **delete** — `deleteAffiliate`, only for
  inactive SUSPENDED/REJECTED/PENDING affiliates and blocked while a payout is in progress;
  cascades clicks/commissions/payouts, SET NULLs referred orders, deletes-if-unused-else-
  deactivates the coupon, leaves the User account intact — set per-affiliate commission), `commissions`
  (management + manual approve/cancel), `rules` (commission rules manager), `payouts`
  (approve/reject/mark-paid + run-maturation), `settings`, `marketing-kit`
  (`MarketingAsset` CRUD, upload via `/api/admin/affiliate-asset`), `analytics`, CSV `export`.
- **Conventions:** reuses `AdminResult` actions, Zod (`lib/validations/affiliate.ts`),
  `requirePermission("affiliates")`/`guardSection`, Cloudinary upload + `cldUrl`, in-app
  notifications. Display labels are client-safe in `lib/affiliate/labels.ts` (type-only Prisma
  imports). Renders nothing when disabled or empty (fully additive — homepage/checkout unchanged
  for non-referred orders).

## 8d. Marketing Hub (phase 1 — core)

Multi-channel campaign system at **`/admin/marketing`**, gated by the **`marketing`** RBAC
permission. Built modular so Push/WhatsApp/SMS and recurring/automation slot in later.

- **Models** (`prisma/schema.prisma`, migration `marketing_hub`): `Campaign` (type, status, channels[],
  content title/body/imageUrl/ctaText/ctaUrl, `segmentType`+`segmentConfig` JSON targeting, optional
  `productId`/`couponId` (plain ids, no FK), `scheduledFor`/`recurrence`/`sentAt`, and analytics
  counters audienceSize/sent/delivered/open/click/conversion/revenue), `CampaignEvent` (OPEN/CLICK/
  CONVERSION log), `CampaignTemplate` (built-in + custom), `AudienceSegment` (saved audiences). Enums:
  `CampaignType`, `CampaignStatus`, `CampaignChannel`, `SegmentType`.
- **lib/marketing/**: `channels.ts` (client-safe labels; `CHANNEL_LIVE` = all channels selectable),
  `audience.ts` (`resolveAudience`/`countAudience` — 9 segment types over existing User/Order/
  WishlistItem/Cart/Affiliate data; Recipient carries `phone` = user.phone ?? latest address phone),
  `deliver.ts` (`dispatchCampaign` via a per-channel **adapter registry**; In-App→`notify`, Email→
  `marketingEmail`+`sendEmail`, Push/WhatsApp/SMS→`providers.ts`; `dispatchDueCampaigns` for cron),
  `providers.ts` (**env-gated channel providers** — `sendPush` (Web Push/VAPID via `web-push`, prunes
  dead subs), `sendWhatsApp` (Meta Cloud API), `sendSMS` (Twilio); each no-ops until its keys are set,
  same keyless philosophy as email), `ai.ts` (`generateCampaignContent` via the Groq seam — generateText
  + JSON parse, heuristic fallback), `templates.ts` (built-ins, `ensureBuiltInTemplates` idempotent),
  `conversion.ts` (`recordCampaignConversion` — credits a campaign from the `nut_campaign` cookie,
  called best-effort in `createOrder`).
- **Channels**: In-App + Email always work; **Push/WhatsApp/SMS are real adapters, env-gated**
  (`isConfigured.webPush/whatsapp/sms`). Web Push: `PushSubscription` model + `/api/push/(un)subscribe`
  + additive SW `push`/`notificationclick` handlers (`public/sw.js`, VERSION bumped — fetch/cache
  invariant untouched) + an account opt-in (`components/account/push-optin.tsx`, renders only when VAPID
  is configured + supported). Env keys (`.env.example`): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/
  `VAPID_SUBJECT`, `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_ID`, `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM`.
  Compose shows a "needs setup" hint for any selected-but-unconfigured channel (those recipients are skipped).
- **Delivery is cron-ready**: "Send now" dispatches immediately; **scheduled** campaigns set
  `status=SCHEDULED`+`scheduledFor` and are processed by `GET/POST /api/cron/marketing` (guarded by
  `CRON_SECRET`, wired in `vercel.json`). **Schedule is `0 3 * * *` (daily) — the max frequency the
  Vercel Hobby plan allows; on Pro, bump it to `*/5 * * * *` for near-real-time, or point an external
  cron (cron-job.org) at the endpoint with the `CRON_SECRET` bearer.** Tracking: `/api/marketing/open/[id]` (1×1 pixel →
  OPEN) and `/api/marketing/click/[id]` (CLICK + sets attribution cookie → redirect). Email links are
  click-wrapped; conversions/revenue accrue from orders placed within the 7-day cookie window.
- **Recurring campaigns** (`Campaign.recurrence` = DAILY/WEEKLY/MONTHLY, null = one-off; set in Compose's
  Repeat selector + first-run schedule): a recurring campaign is a **series parent** — it stays
  SCHEDULED, and each due fire (in `dispatchDueCampaigns`) **spawns a one-off child snapshot** that's
  dispatched for its own per-occurrence analytics/history, then the parent is re-armed via
  `nextRun(recurrence, from)` (which skips missed windows). Cancel stops the series. One-off scheduled
  campaigns still dispatch in place → SENT.
- **Automation rules** (`AutomationRule` + `AutomationLog`, migration `marketing_automation`):
  trigger-based flows that send themselves — `WELCOME` / `ABANDONED_CART` / `WINBACK` / `POST_PURCHASE`,
  each with a `delayHours`, channels and content (+ optional coupon). `lib/marketing/automation.ts#runAutomations`
  (called by the same cron, after campaign dispatch) computes eligibility from existing user/order/cart/
  OrderEvent data, **dedups via `AutomationLog @@unique([ruleId, key])`** (key = userId, or orderId for
  post-purchase) so each recipient gets a rule once, and delivers via in-app + email (catch-up bounds
  avoid blasting old users on first enable; per-run cap). Admin **Automations** tab manages rules
  (enable toggle, trigger, delay h/d, channels, AI-assisted content, coupon) + a manual "Run now".
- **Admin UI** (`lib/actions/admin/marketing.ts`, `lib/queries/marketing.ts`): tabbed
  (`MarketingTabs`) — **Overview** (sent/delivered/opened/clicked/conversions/revenue + recent),
  **Campaigns** (list + history, bulk delete/cancel via the shared `<BulkBar>`, per-row send/
  schedule/duplicate/resend/cancel), **Compose** (`campaign-editor.tsx` — rich content + image,
  **AI assist**, channel toggles, audience targeting with a **live recipient count**, attach product/
  coupon, send-now / schedule / save-draft), **Segments** (saved `AudienceSegment` CRUD with live
  counts), **Templates** (built-in + custom CRUD). Sent campaigns are immutable (duplicate/resend
  instead).
- **Conventions:** reuses `AdminResult`/`BulkOutcome`, Zod (`lib/validations/marketing.ts`),
  `requirePermission("marketing")`, `notify`/`sendEmail`, the Groq provider seam, `ImageUploadField`.
  Degrades gracefully — Email no-ops to console without Resend, AI falls back to a heuristic without Groq.

## 8e. Conversion Optimization (Growth — Phase 1)

Signup-conversion features layered additively on the storefront, all admin-toggleable and gated so
the site is unchanged when off. Config lives in the additive **`StoreSetting.growth` JSON blob**
(`lib/growth-settings.ts#resolveGrowth`/`getGrowthSettings`, same zero-migration pattern as
`pwa`/`seo`): `quizEnabled`, `welcomePopupEnabled`, `stickyBarEnabled`, `trustEnabled`,
`couponCode` (default `WELCOME20`), `couponPercent` (default 20), + popup/sticky copy. Migration
`growth_conversion`.

- **AI Health Score Quiz** (`/quiz`, `components/storefront/quiz/*`): 6-question assessment
  (`lib/quiz/questions.ts` — single source of truth, client-safe) → `scoreQuiz` (`lib/quiz/score.ts`,
  pure/deterministic 0–100 + band + rule-based recommendations; **not** medical) → result screen
  (dependency-free SVG `ScoreGauge`, premium animated stepper, reduced-motion gated). Flow is
  **quiz-first, signup-to-unlock** (highest converting): `completeQuiz` (server action) scores +
  persists a `HealthQuizResult` keyed by the `nut_anon` cookie (set in-action if absent) + optional
  Groq summary enhancement (rule-based fallback), returns a teaser; the full report + coupon unlock
  after `quizSignup` (additive action — creates user + claims the result by id/anon + grants the
  coupon + `signIn`, leaving the existing register flow untouched). `claimQuizForCurrentUser` runs on
  `/account` load to claim pending anon results for the Google/normal-register paths (idempotent).
  Dashboard **"My Health Score"** card (`components/account/my-health-score.tsx`).
- **Smart Welcome Popup** (`components/storefront/growth/welcome-popup.tsx`): first-time + logged-out
  only, never on checkout/quiz/auth, once per 24h (localStorage), triggers after 10s OR 40% scroll.
- **Sticky Offer Bar** (`offer-bar.tsx`): dismissible (24h), Get Coupon + Take Assessment. Renders in
  normal flow at the very top (NOT fixed — never fights the sticky header).
- **Trust Section** (`trust-section.tsx` + `lib/queries/trust.ts`): static product-promise badges +
  **real** DB stats (orders delivered / verified reviews + avg rating / returning customers) shown
  ONLY above a credibility threshold — **never fabricated**. Injected below the hero on the homepage.
- **Welcome coupon** is a shared public `Coupon` (PERCENT, perUserLimit 1) kept in sync on admin save
  + `ensureWelcomeCoupon`; `revealWelcomeCoupon` surfaces + copies it and records the claim.
- **Analytics**: new `UserEventType` values `QUIZ_START`/`QUIZ_COMPLETE`/`QUIZ_SIGNUP`/`COUPON_CLAIM`/
  `POPUP_VIEW`/`POPUP_CONVERT`/`STICKY_CLICK` (client-fired ones added to the `/api/track` allowlist;
  quiz-complete/signup/coupon fire server-side). Surfaced in a **Conversion & growth** section on
  `/admin/insights` (`lib/queries/conversion.ts`, additive — existing analytics untouched).
- **Admin control** (`/admin/growth`, `appearance` permission): toggles + coupon code/percent + copy
  (`components/admin/growth-manager.tsx`, `lib/actions/admin/growth.ts`, revalidates layout+home).

## 9. Security Rules

- **All secrets in env vars** (`.env`, gitignored). Never print, log, or commit
  secrets. `.env.example` documents every key with safe placeholders.
- **Passwords** hashed with bcrypt; credential auth via NextAuth.
- **Authorization** enforced server-side: `middleware.ts` guards `/account`
  (logged-in) and `/admin` (ADMIN role); actions re-check ownership (e.g. address
  and order queries filter by `userId`).
- **Payment integrity:** verify Razorpay payment + webhook signatures with HMAC and
  constant-time comparison (`lib/razorpay.ts`); re-price orders server-side.
- **Input validation** with Zod on every boundary; sanitize CMS/admin-authored
  HTML before rendering with `lib/sanitize.ts#sanitizeRichText` (`sanitize-html`).
  Do **not** use `isomorphic-dompurify` in server components — it pulls in `jsdom`,
  whose transitive ESM dep breaks the production build under Node 21.
- **Security headers** set in middleware (X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy).
- **Rate limiting** via Upstash where abuse is possible (auth, AI) — no-op fallback
  when Redis isn't configured.

---

## 10. Performance Requirements

- Prefer RSC + static generation; keep client bundles small (current First Load JS
  ~102 kB shared). Use Server Actions over client fetch waterfalls.
- `next/image` with correct `sizes`; lazy-load below the fold; `next/script`
  `lazyOnload` for third-party (Razorpay checkout).
- Cache catalog reads via Redis where hot; paginate lists. Avoid N+1 — use Prisma
  `include`/`select` deliberately and select only needed columns.
- Target: fast TTFB on Neon pooled connection; Lighthouse ≥ 90 mobile (M5 goal).

---

## 11. Environment Variables

Copy `.env.example` → `.env`. **Every integration has a keyless fallback**, so the
app runs end-to-end with blanks (mock checkout, console-logged emails, "AI not
configured", no-op cache). Feature availability is centralized in
`lib/env.ts#isConfigured`.

Groups: **App** (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_NAME`) · **DB**
(`DATABASE_URL`, `DIRECT_URL`) · **Auth** (`AUTH_SECRET`/`NEXTAUTH_SECRET`,
`NEXTAUTH_URL`, `AUTH_GOOGLE_ID/SECRET`) · **Email** (`RESEND_API_KEY`, `EMAIL_FROM`)
· **Payments** (`RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`)
· **Media** (`CLOUDINARY_*`) · **AI** (`GROQ_API_KEY`, `GROQ_MODEL`) · **Cache**
(`UPSTASH_REDIS_REST_URL/TOKEN`) · **Admin bootstrap** (`ADMIN_EMAIL`,
`ADMIN_PASSWORD`, used by the seed).

---

## 12. Milestones

**Completed**
- **M0 — Foundation:** scaffold, full Prisma schema (23 models), service-client
  libs with keyless fallbacks, branded green storefront shell (header/footer/landing).
- **M1 — Storefront + Auth + Products:** catalog list/detail, categories, search,
  product gallery/reviews/wishlist, full auth (register, login, Google, email verify,
  password reset), account area (profile, addresses, orders list, wishlist).
- **DB live:** Neon connected, `init` migration applied, seed loaded (admin, 7
  categories, 12 products, 30 variants, 24 images, 3 coupons, 3 stories, AISetting).
- **M2 — Cart → Checkout → Payments → Orders:** Zustand cart, server-side re-pricing
  & stock validation (`lib/orders.ts`), coupon validation (`lib/coupons.ts`),
  `createOrder`/`verifyPayment` actions, Razorpay live flow **and** keyless mock flow,
  idempotent webhook, `/checkout`, `/checkout/success`, order detail page, confirmation email.

- **M3 — Admin panel:** ADMIN-gated `/admin` shell (sidebar + mobile sheet),
  dashboard (revenue/orders/customers/products KPIs, recent orders, low-stock, top
  products), order management (list/filter/search/detail + status transitions with
  stock restock), product CRUD (variants, images-by-URL, nutrition facts, flags),
  inventory quick-edit, category/coupon/story management, customer list + detail,
  AI settings (edit `AISetting`), site settings (integration status).

- **M4 — AI (Groq):** provider-agnostic AI layer (`lib/ai/*`), streaming chat
  assistant (`/assistant` + `/api/ai/chat`), per-product inline assistant grounded
  in product context, natural-language product search (intent → filters, keyword
  fallback), DB-driven recommendations (personalized + similar + recently-viewed),
  chat history for logged-in users (`AIChat`/`AIMessage`) with transcript view,
  admin usage metering. Graceful degrade with no key; verified with and without one.

- **M5 — Stories / Cloudinary / images:** immersive Instagram-style **stories
  viewer** (full-screen overlay, segmented progress, auto-advance for images +
  video, tap/keyboard nav, product CTA, view tracking); **real Cloudinary uploads**
  in the admin image manager (`ImageUploadField` — file upload when configured, URL
  paste fallback otherwise) for product/category/story media; Cloudinary delivery
  optimization via `lib/cld.ts` (`f_auto,q_auto`).

- **M6 — SEO / PWA / Analytics / Notifications / Deploy:** dynamic `sitemap.xml` +
  `robots.txt`; Organization/WebSite/Breadcrumb JSON-LD (plus existing Product);
  generated `icon`/`apple-icon`/`opengraph-image` via `next/og`; PWA `manifest` +
  conservative service worker + `/offline`; pluggable privacy-analytics (no-op
  fallback); order status-change emails; AI chat rate-limiting (Upstash, fail-open);
  `DEPLOYMENT.md`. **All M0–M6 complete — production-ready.**

**Status: feature-complete (M0–M6).** Next work is operational: deploy to Vercel per
`DEPLOYMENT.md`, then iterate (RAG, more analytics, A/B, etc.).

See `PROGRESS.md` for the live tracker (status, blockers, next task).

---

## 13. Known Decisions

- Money as **integer paise**; format only at the edge.
- **Keyless fallbacks** everywhere via `isConfigured` — the app must always run with
  blank keys.
- **Cart is client-side** (Zustand + localStorage); the server is authoritative for
  pricing/stock at checkout. (DB `Cart`/`CartItem` models exist for future
  server-synced carts.)
- **Shipping:** free ≥ ₹499 subtotal, else flat ₹49 (`lib/shipping.ts` holds the keyless
  defaults). These are now admin-configurable global defaults (see Pricing & tax below).
- **Pricing & tax engine** (`lib/pricing.ts`, client-safe, single source of truth):
  **GST is inclusive** — a product's listed price already contains GST at its rate, so the
  tax line is the component *extracted* from the price and the payable total is unchanged
  (Razorpay amount unaffected). **Shipping = the highest per-product delivery charge** in the
  cart (one shipment), free once the subtotal reaches the threshold. `computeBreakdown(lines,
  settings, discount)` returns `{ subtotal, discount, tax, shipping, total }` and is used by
  the cart, checkout, product page **and** server-side order pricing so they always agree.
  Per-product overrides live on `Product.gstRate` / `Product.deliveryCharge` (null = use the
  store default). GST default + seller `gstin` are edited at `/admin/appearance` → Tax (GST);
  **all shipping settings live at a dedicated `/admin/shipping`** (`appearance` permission):
  `defaultShippingFee` (standard/default), `freeShippingThreshold`, `freeShippingEnabled`
  (master free-delivery switch) and configurable `localDeliveryFee`/`expressDeliveryFee`/
  `codFee`. Shipping rule: **product override wins → else default; highest across the cart
  (never summed); free when enabled & subtotal ≥ threshold**. The breakdown shows on PDP,
  cart, checkout, order summary card, track, the confirmation email and the printable tax
  invoice (`/account/orders/[orderNumber]/invoice`), with **"Free Delivery" + "You saved ₹XX
  on shipping"** (engine returns `shippingSaved`, persisted on `Order.shippingSaved`).
- **Cart/checkout pricing is server-authoritative.** The client cart (localStorage) is only an
  optimistic placeholder; `previewOrderPricing` (`lib/actions/checkout.ts`) re-prices from the
  DB (`priceCart` + `computeBreakdown`) and the client renders that result, so admin delivery/
  GST values always win and stale cart fields can't mislead. `createOrder` uses the same engine
  so the displayed total always equals what's charged.
- **Order numbers:** `NUT-YYMMDD-XXXXXX` (nanoid, unambiguous alphabet).
- Stock is decremented when an order is **confirmed** — at the PAID transition for
  online, at order placement for COD (payment still PENDING). The `Order.stockDeducted`
  flag (not `paymentStatus`) is the single signal for both **confirm-idempotency**
  (`confirmOrder` no-ops once set) and **restock-on-cancel** (cancel/return/refund restocks
  once when `stockDeducted`, then clears it). `markOrderPaid` is a thin wrapper over
  `confirmOrder(id, { paymentStatus: "PAID", payment })`.
- **Order workflow & cancellation** (Amazon/Flipkart-style). Fulfilment stages
  (`OrderStatus`): PENDING → APPROVED → PROCESSING → PACKED → SHIPPED → OUT_FOR_DELIVERY →
  DELIVERED, plus CANCELLED and RETURNED (future-ready); PAID/REFUNDED retained for legacy.
  `confirmOrder` **leaves a placed order at PENDING** (it no longer jumps to PROCESSING) so it
  awaits admin approval and stays customer-cancellable. **Single source of truth**:
  `lib/order-status.ts` (flow, labels, badge variants, `isCustomerCancellable` = status is
  PENDING, `ADMIN_STATUS_OPTIONS`, `CLOSED_STATUSES`) + `lib/orders.ts#transitionOrderStatus`
  (restock by `stockDeducted`, paymentStatus derivation, appends an `OrderEvent`, stores
  `Order.cancelReason`). Admin `updateOrderStatus` and the customer `cancelOrder`
  (`lib/actions/account.ts`, PENDING-only guard, owner-scoped) both delegate to it. The
  **timeline** is the append-only `OrderEvent` table (status + note + actor + timestamp),
  rendered by `components/storefront/order-timeline.tsx` on the customer and admin order pages;
  the customer cancel button (`cancel-order-button.tsx`, confirm dialog + reason) shows only
  while cancellable. Notifications via `orderStatusEmail` cover APPROVED/SHIPPED/OUT_FOR_DELIVERY/
  DELIVERED/CANCELLED (with reason)/RETURNED.
- **Cash on Delivery**: `Order.paymentMethod` (`RAZORPAY`/`COD`) + `Order.codFee`. COD is
  configured at `/admin/shipping` (`StoreSetting.codEnabled/codFee/codMinOrder/codMaxOrder`;
  `codPincodes` reserved for a future allowlist). Availability (`isCodAvailable`) and the fee
  are **recomputed server-side** in `previewOrderPricing`/`createOrder` — never trusted from
  the client; a COD-but-unavailable request is rejected. COD orders skip Razorpay, are placed
  via `confirmOrder(..., { paymentStatus: "PENDING" })`, and flip to PAID only when the admin
  marks them DELIVERED. The COD fee is an optional 4th term in `computeBreakdown` (engine stays
  pure); online totals/Razorpay `amount` are unchanged.
- **Invoices**: one persistent `Invoice` per order (`ensureInvoice`, idempotent; created at
  confirmation and lazily on first view for legacy orders). Number `INV-<FY>-<seq>` (Indian
  Apr–Mar FY + DB `autoincrement seq` → collision-free; concurrent create guarded by
  `orderId @unique` + P2002). Seller details are snapshotted on the invoice row. The **PDF** is
  rendered on demand from the immutable order+invoice snapshot via `@react-pdf/renderer`
  (`lib/pdf/invoice-pdf.tsx`) at `GET /api/invoices/[orderNumber]` (owner or `orders`-permitted
  admin; `?download=1` → attachment), and attached best-effort to the confirmation email. The
  PDF route is `runtime = "nodejs"`; `next.config.ts` lists `@react-pdf/renderer` in
  `serverExternalPackages`. Money in the PDF is ASCII (`Rs. …`) since Helvetica lacks ₹.
- **Returns & refunds** (Amazon/Flipkart-style; a **separate lifecycle layered on orders** — a
  delivered order stays `DELIVERED` while the return progresses through its own status). Models:
  `ReturnRequest` (RMA-YYMMDD-XXXXXX, `media[]` proof, `refundAmount`/`refundedAmount`,
  `refundMethod`/`refundStatus`/`refundRef`, pickup + `adminNotes` + `rejectionReason`),
  `ReturnRequestItem` (per-item qty → **partial refunds**), `ReturnEvent` (append-only audit log),
  `CreditNote` (mirrors `Invoice`: `CN-<FY>-<seq>`, seller snapshot, idempotent `ensureCreditNote`),
  `Notification` (in-app bell). Status config + engine mirror the order ones:
  `lib/return-status.ts` (`RETURN_FLOW`, labels, `isReturnTerminal`, `canCustomerCancelReturn`) +
  `lib/returns.ts` (`getReturnEligibility`, `transitionReturnStatus`, `processRefund`). **Eligibility**:
  `StoreSetting.returnsEnabled`/`returnWindowDays` (default 7, edited at `/admin/shipping`) gated by
  per-product `Product.returnable`/`returnWindowDays` **and** per-category `Category.returnable`;
  only `DELIVERED`, in-window, not-already-returned items (eligibility computed from the latest
  `DELIVERED` OrderEvent). **Payments**: prepaid+`ORIGINAL` → `lib/razorpay.ts#refundPayment`
  (`payments.refund`, keyless mock id); COD/manual → admin records `RefundMethod` (UPI/Bank/…) +
  reference. `processRefund` restocks returned qty (once, guarded by `stockDeducted`); a full-order
  return closes the order `RETURNED` + `paymentStatus REFUNDED`; partial leaves the order open. Every
  transition emails (`returnStatusEmail`) **and** notifies in-app (`lib/notifications.ts#notify`).
  **Customer**: `lib/actions/returns.ts` (request/cancel/submit-info), proof upload at
  `POST /api/returns/upload` (any signed-in user, images+video, `nutriyet/returns`), UI at
  `/account/returns(/[returnNumber])` (`return-request-button`, `return-timeline`,
  `return-media-upload`, `return-customer-actions`) + the request button on the order page; the
  **notification bell** (`components/account/notification-bell.tsx`) mounts in the storefront header
  for signed-in users (layout fetches `getNotifications`/`getUnreadCount`). **Admin** (`returns`
  RBAC permission): `lib/actions/admin/returns.ts` (review/approve/reject/request-info/
  schedule-pickup/add-note/process-refund), `/admin/returns` list (status/date/customer/payment
  filters + **CSV** at `/admin/returns/export` via `lib/csv.ts`) + detail (proof gallery, audit log,
  internal notes, `return-actions`). **Credit-note PDF** (`lib/pdf/credit-note-pdf.tsx`) at
  `GET /api/credit-notes/[returnNumber]` (owner or `returns` admin). All sections render nothing /
  hide when empty or `returnsEnabled=false`.
- Admin **product image management is URL-based** for now; real Cloudinary uploads
  land in M5. Product edits preserve variant/image ids (cart links survive) and
  delete only the variants/images the admin removed.
- Admin actions enforce **slug/code uniqueness** and refuse to delete a category
  with products or a coupon already used by orders (the coupon is deactivated instead).
- **Cloudinary uploads are signed + go DIRECT from the browser** (`ImageUploadField`
  → `POST /api/admin/upload-signature` → `https://api.cloudinary.com/v1_1/<cloud>/auto/upload`).
  The admin-gated signature route (`lib/cloudinary.ts#signUpload`, signs folder +
  timestamp only) returns a short-lived signature; the file bytes then upload straight
  to Cloudinary and **never pass through the serverless function**. This is required
  because Vercel caps a function's request body at ~4.5 MB — routing media (especially
  hero/banner **videos**) through the app made every real video fail with "Upload
  failed". Images are still downscaled client-side (`prepareBlob`) before the direct
  upload; videos go untouched (client cap 100 MB = Cloudinary free-plan video limit).
  `ImageUploadField` always accepts a pasted URL (keyless fallback). The older
  server-buffered route (`app/api/admin/upload/route.ts#POST` → `uploadImage`, base64
  data URI) still exists and is used only by `showcase-image-field.tsx` (small cutout
  images). Optimize delivery with `cldUrl()`/`cldVideo()` from `lib/cld.ts` (no-op for
  non-Cloudinary URLs).
- **Stories viewer** (`components/storefront/stories-viewer.tsx`) is the storefront
  rail's click target; images auto-advance via rAF (5 s), videos via `ended`. Views
  are recorded best-effort (`lib/actions/stories.ts`). Story media can be any host,
  so the viewer/rail use plain `<img>` (not `next/image`) to avoid `remotePatterns`.
- **AI provider + RAG are seams, not hardcoded**: provider via `lib/ai/provider.ts`
  registry, retrieval via `lib/ai/retrieval.ts` (`ContextChunk[]`). Business logic
  stays out of routes (`lib/ai/chat.ts`/`search.ts`).
- **Recommendation engine** is a centralized service in `lib/recommendations/` — the
  single source of truth for every reco section (no duplicated logic). `service.ts`:
  `recommendedForYou`, `similarProducts`, `frequentlyBoughtTogether`,
  `customersAlsoBought`, `trending`, `bestSellers`, `complementaryForCart`,
  `productCombos`. All **rule-based + DB-driven today** (work with no AI key) and isolated
  so a future provider (embeddings / vector search / LLM re-rank) slots in without touching
  callers — same seam philosophy as the AI provider. `lib/ai/recommendations.ts#getRecommendations`
  is a thin back-compat wrapper over `recommendedForYou`. **Behavior tracking** feeds it:
  the additive `UserEvent` log (`lib/recommendations/events.ts#trackEvent` + `getUserSignals`)
  — privacy-preserving (session userId or an anon `nut_anon` cookie; no PII). Client signals go
  through `POST /api/track` (rate-limited) via `components/storefront/behavior-tracker.tsx`
  (`BehaviorTracker` / `trackClient`); WISHLIST_ADD and PURCHASE are recorded server-side from
  their authoritative actions. Reco strips reuse `components/storefront/reco-section.tsx`
  (`RecoSection`, with optional `source` → RECO_CLICK analytics via `reco-click-area.tsx`).
  **Smart search** is keyless: `lib/recommendations/intent.ts#expandSearchTerms` maps goals
  ("weight loss" → flax/chia/makhana…) and `smartKeywordSearch` (in `lib/ai/search.ts`) unions
  literal + intent matches — used as the fallback at every level of `aiProductSearch`. **Admin
  AI Insights** (`/admin/insights`, `ai` permission, `lib/queries/insights.ts`) reports most
  viewed/purchased/cart-added, top searches, FBT pairs, reco click-rate and repeat-purchase rate
  from real `UserEvent` + order data. Sections render nothing when empty (cold-start safe).
- **Advanced analytics** (`lib/queries/analytics.ts#getRangeAnalytics`, additive companion to the
  fixed-window BI in `lib/queries/bi.ts`): admin-chosen range (today/yesterday/7d/30d/custom ≤366d)
  vs the same-length previous window — conversion **funnel** (visitors→product views→cart adds→
  checkout starts→purchases, "tracking new" pending flags), KPI cards with deltas, geo (cities by
  revenue), device/traffic-source breakdowns, weak converters, cart recovery. Outputs are plain
  JSON (Redis-cache safe) and degrade to zeros on fresh tracking. Tracking: `UserEvent` gained
  `PAGE_VIEW`/`CHECKOUT_START` types + `device` (server-derived from UA via `lib/ua.ts`) and
  `referrer` (external hostname only, no PII) — fed by `VisitTracker` (one PAGE_VIEW per browser
  session, storefront layout) and the checkout page through the rate-limited `/api/track`.
  `UserEvent` has **no pruning yet**; add a retention/rollup job when volume warrants. Insights
  page adds `RangeFilter` (searchParams), `LiveStrip` (45s-poll of a guarded server action, pauses
  when tab hidden), CSV export (`/admin/insights/export`, `?section=`) and a branded PDF report
  (`/admin/insights/report`, `lib/pdf/analytics-pdf.tsx`); AI summary/Q&A is grounded in the
  selected range's facts.
- **Advanced engagement analytics** (4 additive `/admin/insights` sections; all keyless, degrade
  to empty states, and never touch the existing charts/KPIs):
  - **Customer Journey Analytics** (`lib/queries/journey.ts#getJourneyAnalytics`,
    `components/admin/insights/journey-section.tsx`): 11-stage funnel (Visitor→Landing→Homepage→
    Category→Product→Search→Add-to-cart→Checkout→Payment→Order success→Returning customer) with
    per-stage users / conversion% / drop-off% / exit-rate / avg-time-to-next and previous-period
    delta. Computed per unique-shopper "session" from one bounded `UserEvent` fetch; browse stages
    (category/search) are marked optional so they don't distort the main-path conversion base.
    URL-driven filters (device / traffic source / product / state / city). AI drop-off diagnosis via
    `generateJourneyDiagnosis` (Groq seam + rule-based fallback). Needs new event types (below).
  - **Website Heatmap Analytics** (`lib/queries/engagement.ts#getHeatmapAnalytics`,
    `heatmap-section.tsx`): engagement score 0-100 per `data-heat` section (registry in
    `lib/heat-sections.ts`), with clicks / click-rate / hovers(desktop) / taps(mobile) / avg
    time-in-view, plus per-page scroll-depth (25/50/75/100%) and time-on-page. Data is
    **pre-aggregated** into daily `HeatStat` counters (one row per day×page×section×device) by the
    `/api/heat` beacon — no per-interaction rows, tiny at any traffic. AI best/worst + UI/CTA
    suggestions via `generateHeatmapInsights`. Add tracking to a new area = drop `data-heat="<key>"`
    on it + add the key to `HEAT_SECTIONS`.
  - **Rage-click detection** (`getRageClicks`, `rage-section.tsx`): 3+ rapid clicks in one spot →
    a `RAGE_CLICK` event (element label = nearest `data-heat` key or control descriptor); grouped by
    element+path with previous-period delta. AI explains the top issue inside the heatmap card.
  - **Session Replay** (`getSessionReplays`/`getSessionReplay`, `replay-section.tsx` +
    `replay-panel.tsx`): **anonymized, sampled** (25%) recordings — normalized cursor/scroll/click
    coordinates + page paths ONLY (never DOM content, text or keystrokes, so passwords/payment/PII
    can't be captured by construction). Stored in `SessionRecording` (JSON page chunks, appended per
    page via `/api/replay`, size/page caps, 30-day retention pruned lazily on admin read). The player
    is **dependency-free** (schematic viewport + rAF cursor/click/scroll timeline, scrub + speed).
  - **Tracking**: `UserEventType` gains `HOME_VIEW` / `PAYMENT_START` / `RAGE_CLICK`; `UserEvent`
    gains `path` / `city` / `region` (coarse platform geo via `lib/geo.ts` — Vercel IP-city/region
    headers, no IP stored). Client engine is **lazy** (`components/storefront/engagement-tracker.tsx`
    dynamic-imports `engagement-engine.ts` after idle → shared First-Load JS stays ~103 kB); it
    batches ONE `/api/heat` + one `/api/replay` beacon per page (sendBeacon on leave), all listeners
    passive, fail-silent. `JourneyTracker` logs `HOME_VIEW`; checkout logs `PAYMENT_START`. Both new
    beacon routes are Zod-validated, rate-limited (`limiters.api`) and fail-open. Migration
    `analytics_tracking` (event cols) + `journey_heatmap_replay` (`HeatStat`, `SessionRecording`,
    enum values).
  - **Accuracy invariants (do not regress):** (1) **One shopper = one id.** A durable client id
    (`lib/client-id.ts`, localStorage `nut_cid`) is minted synchronously and sent as `cid` on every
    `/api/track` + `/api/replay` beacon; the server prefers it over the cookie. This exists because
    concurrent first-load beacons used to each mint a different anon id before the httpOnly cookie
    landed, fragmenting one shopper into many "sessions" and collapsing the funnel (Landing showed
    ~4%). Never revert to cookie-only identity. (2) **The engagement engine must start promptly** —
    `engagement-tracker.tsx` loads it right after first paint AND on first interaction (pointerdown/
    keydown/scroll/touch). The earlier requestIdleCallback/2.5s delay meant the click listener
    attached seconds late, so early clicks were lost while impressions kept accruing (add-to-cart:
    "31 views / 0 clicks" despite 114 CART_ADDs). (3) **Impressions use IO threshold `[0, 0.5]`** so
    large/below-fold sections (footer, hero) get counted fairly. (4) **Confidence gating**
    (`lib/analytics-confidence.ts`): heatmap sections are scored/ranked only above
    `minSectionImpressions` (25) — below that `score` is `null` and they render "Collecting data",
    never crowned #1; AI journey/heatmap builders return **"Not enough data yet"** below
    `minJourneySessions` (30) / `minHeatmapImpressions` (150), and `heatFacts` never sends an
    unscored (null) section to the model. UI shows a "Low confidence" badge + shortfall note.
- **Groq `llama-3.3-70b-versatile` does NOT support the `json_schema` response
  format**, so AI SDK `generateObject` fails on it. We use `generateText` + a
  defensive JSON parse for structured search instead — also keeps us model/provider
  agnostic. Don't reintroduce `generateObject` without checking model support.
- Chat streams as **plain text** (`toTextStreamResponse`) consumed via `fetch`, not
  the `useChat`/UIMessage protocol — robust across AI SDK versions. Friendly
  fallbacks/limits carry an `X-AI-Fallback: 1` header so the client renders their
  message inline instead of erroring.
- **Favicon is metadata-driven, not file-convention.** App-Router file conventions
  (`app/favicon.ico`/`icon.tsx`/`apple-icon.tsx`) override `metadata.icons`, so an
  admin-uploaded favicon never showed. They were removed; the brand default is generated at
  `app/brand-icon/route.tsx` + `app/brand-apple-icon/route.tsx` (`next/og`), and root
  `generateMetadata().icons` points at `StoreSetting.favicon` (normalized through `cldFavicon`
  → real square PNG at 48/96/192/180 for `icon`/`shortcut`/`apple`) or the brand routes. The
  versioned Cloudinary URL cache-busts the tab automatically. Don't re-add
  `app/favicon.ico`/`app/icon.*` (they'd override the admin favicon again).
  - **Classic `/favicon.ico` path is served dynamically** (browsers, bookmarks and Google
    Search fetch it directly, *independent* of the `<link rel="icon">` tags — without it the
    path 404s and those contexts show a blank/stale icon). `next.config.ts` `rewrites()`
    (`beforeFiles`) maps `/favicon.ico` → `app/api/favicon/route.ts`, which **proxies the bytes**
    of `cldFavicon(favicon,48)` (fallback `/brand-icon`), `force-dynamic`. Serve via the
    rewrite+route, **never** an `app/favicon.ico` file.
  - **PWA/Android install icon**: `app/manifest.ts` is `async` + `force-dynamic` and its
    `icons` come from `StoreSetting.favicon` via `cldFavicon` (32/180/192/512, brand-route
    fallback) — not hardcoded. So the tab, the classic path, apple-touch and the installed-app
    icon all track the admin favicon; `force-dynamic` means no build-time bake to go stale.
- **SEO & Social Share Manager** (`/admin/seo`, `appearance` permission) — admin CMS for all
  site-wide SEO/social metadata; **extends** the existing pipeline (doesn't replace it). Extended
  config lives in a single additive **`StoreSetting.seo` JSON blob** (no per-field migrations);
  core fields (siteName/metaTitle/metaDescription/ogImage/favicon/primary socials) stay in their
  own columns and remain editable from Appearance too. **`lib/seo-settings.ts#getSeoSettings()`**
  is the single resolver — folds columns + blob over `config/site.ts` defaults into a fully-resolved
  `SeoSettings` used by both the root `generateMetadata`/`generateViewport` (title, description,
  keywords, canonical, OG type/locale/image, Twitter card, `verification` google/bing/pinterest/
  yandex, `fb:app_id`, theme color, robots index) **and** the admin live previews. Analytics
  (GA4/GTM/Meta Pixel) inject via `components/seo-scripts.tsx` (`SeoScripts`/`SeoNoscript`, each
  self-gates on its ID, additive to the env-gated Plausible `<Analytics/>`). Save
  (`lib/actions/admin/seo.ts#updateSeoSettings`) writes columns + blob then `revalidatePath("/",
  "layout")` so metadata refreshes **without a redeploy**. Flagship UI (`components/admin/seo-manager.tsx`
  + `components/admin/seo/*`): tabbed editor (Global / Social / Search & Analytics / Links),
  **live multi-platform preview** (Google Search + Discover, WhatsApp, Facebook, LinkedIn, X,
  Telegram, Discord, Instagram DM, Gmail — `social-previews.tsx`), soft validation warnings,
  unsaved-changes guard + save indicator, Reset-to-defaults, and a **URL Tester**
  (`fetchUrlPreview` server action, SSRF-guarded to the site origin, scrapes a page's real
  OG/Twitter/title tags). Validation schema: `lib/validations/seo.ts`; shared client-safe preview
  types: `lib/seo-preview.ts`. **Backlog (Phase 2):** per-page / per-product / per-blog SEO
  overrides (models + wiring), per-section share-image manager, schema on/off toggles, editable
  robots.txt/sitemap body.
- **OG image** is still generated at the edge via `next/og` `ImageResponse`
  (`app/opengraph-image.tsx`); `siteConfig.ogImage` points at `/opengraph-image`.
- **`cldUrl`** supports `gravity` (`g_auto` smart focal point) and `dpr` (`dpr_auto`) on top of
  `f_auto,q_auto,w,h,c_fill|fit` — used for responsive, non-stretching banner crops.
- **Service worker is intentionally conservative** (`public/sw.js`): network-first for
  navigations with an `/offline` fallback, cache-first for static assets, and it
  **never** intercepts `/api`, `/admin`, `/account`, `/checkout`, or auth. Registered
  in **production only** (`components/service-worker-register.tsx`, which also calls
  `registration.update()` so a corrected SW propagates promptly).
  - **Critical invariant (`isCacheable`):** the SW must **only ever cache or serve a clean
    same-origin 200** (`response.ok && type === "basic" && !redirected`). It must pass
    redirects/opaque/non-OK responses straight through, never caching them. Reason: an alias
    host (e.g. `www`) that 307-redirects to the primary apex must be allowed to redirect — a
    prior version cached/returned the cross-origin `opaqueredirect`, which **blanked
    `www.nutriyet.in`** on browsers that had the SW installed on that origin (SW + Cache are
    per-origin and survive redeploys). Bump `VERSION` when changing SW behavior so `activate`
    purges old caches. Don't reintroduce unconditional `cache.put`.
- **Analytics is dependency-free + pluggable**: a `<Script>` is injected only when
  `NEXT_PUBLIC_ANALYTICS_SRC` + `_DOMAIN` are set (Plausible/Umami-style), else nothing.
- **Rate limiting** uses `lib/rate-limit.ts` (Upstash) and **fails open** — wired into
  `/api/ai/chat` (429 + friendly message when exceeded; no-op without Redis).

---

## 14. Deployment Process

- Target host: **Vercel** (M5). Set all env vars in the project dashboard; point
  `DATABASE_URL`/`DIRECT_URL` at Neon; configure the Razorpay webhook to
  `/api/webhooks/razorpay` with `RAZORPAY_WEBHOOK_SECRET`.
- Build: `npm run build`. Prisma client is generated on install/build. Apply
  migrations with `prisma migrate deploy` in the release step.
- Pre-deploy gate (run locally and in CI): `typecheck` → `lint` → `build`.

---

## 15. Development Workflow

```bash
npm run dev         # Next dev (Turbopack)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # production build
```

**Definition of done for every milestone:** typecheck ✅ · lint ✅ · production
build ✅ · runtime smoke ✅ — fix issues before moving on. Extend existing
architecture; do not rewrite completed, working modules without cause. Keep
`CLAUDE.md` and `PROGRESS.md` current as the project evolves.
