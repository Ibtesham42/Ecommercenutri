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
  (account)/           Authenticated customer area (middleware-gated)
    account/           Profile, addresses, orders, orders/[orderNumber],
                       wishlist, ai-history
  (auth)/              login, register, forgot/reset password, verify-email
  admin/               ADMIN-only panel (guarded by middleware + layout)
    page.tsx           Dashboard; orders/, products/, inventory/, categories/,
                       coupons/, stories/, customers/, ai-settings/, settings/
  api/
    auth/[...nextauth] NextAuth handler
    ai/chat            Streaming AI chat (text stream; general + per-product)
    webhooks/razorpay  Razorpay webhook (signature-verified, idempotent)
  sitemap.ts / robots.ts          SEO (dynamic, DB-driven sitemap)
  manifest.ts                     PWA web manifest
  icon.tsx / apple-icon.tsx / opengraph-image.tsx   Generated images (next/og)
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
                       prompts, chat (orchestration), search, recommendations, history
  queries/             Read helpers (catalog, products, wishlist, admin analytics)
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
- **Route Handlers** (`app/api/**/route.ts`) only for third-party integrations and
  webhooks (NextAuth, Razorpay webhook). Webhooks verify signatures over the **raw**
  body and must be **idempotent** (`markOrderPaid` is a no-op once `PAID`).
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

## 9. Security Rules

- **All secrets in env vars** (`.env`, gitignored). Never print, log, or commit
  secrets. `.env.example` documents every key with safe placeholders.
- **Passwords** hashed with bcrypt; credential auth via NextAuth.
- **Authorization** enforced server-side: `middleware.ts` guards `/account`
  (logged-in) and `/admin` (ADMIN role); actions re-check ownership (e.g. address
  and order queries filter by `userId`).
- **Payment integrity:** verify Razorpay payment + webhook signatures with HMAC and
  constant-time comparison (`lib/razorpay.ts`); re-price orders server-side.
- **Input validation** with Zod on every boundary; sanitize rich text with
  `isomorphic-dompurify` where rendered as HTML.
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
- **Shipping:** free ≥ ₹499 subtotal, else flat ₹49 (`lib/shipping.ts`, single source
  of truth shared by cart, checkout UI, and order pricing).
- **Order numbers:** `NUT-YYMMDD-XXXXXX` (nanoid, unambiguous alphabet).
- Stock is decremented at the **PAID** transition (guarded `updateMany`), not at
  cart/PENDING. Admin cancelling/refunding a previously-paid order **restocks** it
  (once — guarded against double restock by the open→closed transition check).
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
- **Groq `llama-3.3-70b-versatile` does NOT support the `json_schema` response
  format**, so AI SDK `generateObject` fails on it. We use `generateText` + a
  defensive JSON parse for structured search instead — also keeps us model/provider
  agnostic. Don't reintroduce `generateObject` without checking model support.
- Chat streams as **plain text** (`toTextStreamResponse`) consumed via `fetch`, not
  the `useChat`/UIMessage protocol — robust across AI SDK versions. Friendly
  fallbacks/limits carry an `X-AI-Fallback: 1` header so the client renders their
  message inline instead of erroring.
- **Icons/OG are generated at the edge** via `next/og` `ImageResponse` (`app/icon.tsx`,
  `apple-icon.tsx`, `opengraph-image.tsx`) — no binary asset files. `siteConfig.ogImage`
  points at the generated `/opengraph-image` route.
- **Service worker is intentionally conservative** (`public/sw.js`): network-first for
  navigations with an `/offline` fallback, cache-first for static assets, and it
  **never** intercepts `/api`, `/admin`, `/account`, `/checkout`, or auth. Registered
  in **production only** (`components/service-worker-register.tsx`).
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
