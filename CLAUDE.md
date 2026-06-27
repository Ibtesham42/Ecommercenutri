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
- **Permission keys** (`lib/permissions.ts`): `products, stories, orders, categories,
  coupons, inventory, customers, ai`. A sub-admin only reaches a section if its key is in
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
  stories/heroSlider keep their dedicated managers (editor kind `none`).
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
- **Backlog (one phase per turn):** admin editors for Blog/Legal/Contact-inbox; Navigation
  Builder (`MenuItem`); Footer Builder; Media Library (`MediaAsset` + Cloudinary); popups/ads.
- **CMS conventions:** reuse RBAC (`requirePermission("appearance")` / `guardSection`),
  `AdminResult` actions, Zod schemas in `lib/validations/admin.ts`, `ImageUploadField` +
  Cloudinary, `cldUrl` for delivery. Reordering uses native HTML5 DnD + a `reorder(ids[])`
  action (no DnD library). Singletons extend `StoreSetting`; lists are new additive models.

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
- Admin **product image management is URL-based** for now; real Cloudinary uploads
  land in M5. Product edits preserve variant/image ids (cart links survive) and
  delete only the variants/images the admin removed.
- Admin actions enforce **slug/code uniqueness** and refuse to delete a category
  with products or a coupon already used by orders (the coupon is deactivated instead).
- **Cloudinary uploads are signed + server-side** (`lib/actions/admin/upload.ts` →
  `lib/cloudinary.ts#uploadImage`): the client sends a base64 data URI to a server
  action; no unsigned preset needed. `ImageUploadField` shows a file picker when
  configured and always accepts a pasted URL (keyless fallback). Optimize delivery
  with `cldUrl()` from `lib/cld.ts` (no-op for non-Cloudinary URLs). Server-action
  body limit is 12 MB (`next.config.ts`) to fit image data URIs.
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
  `generateMetadata().icons` points at `StoreSetting.favicon` (normalized through `cldUrl`
  f_auto so any asset is delivered as an image) or the brand routes. The versioned Cloudinary
  URL cache-busts the tab automatically. Don't re-add `app/favicon.ico`/`app/icon.*`.
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
