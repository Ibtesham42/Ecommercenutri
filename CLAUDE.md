# Nutriyet — Project Guide (CLAUDE.md)

> Production-grade, AI-powered health & nutrition e-commerce platform for **nutriyet.in**.
> This file holds only the guidance every session needs. Feature detail lives in
> **`docs/`** (see the [Documentation index](#documentation-index)) — read the relevant
> doc before working on a feature area.

## 1. Project overview

Nutriyet is India's AI-assisted nutrition marketplace (makhana, dry fruits, seeds,
protein, healthy snacks, wellness). Fast SEO-friendly storefront + AI nutrition
assistant, Razorpay payments, Instagram-style stories, full account + admin experience.

- **Live domain:** nutriyet.in · **Host:** Vercel · **Repo:** `D:\AnacondaProj\Ecommerce`
  (a Next.js app at the repo root, inside an otherwise Python/ML workspace).
- **Package manager:** npm (`.npmrc` sets `legacy-peer-deps=true` for React 19 — keep it).
- **Status:** feature-complete (M0–M6) + RBAC, CMS, affiliates, marketing hub, growth,
  engagement analytics, survey. Live tracker: `PROGRESS.md`; history: `CHANGELOG.md`.

## 2. Tech stack

| Concern        | Choice                                                              |
| -------------- | ------------------------------------------------------------------- |
| Framework      | **Next.js 15** (App Router, RSC, Server Actions, Turbopack dev)     |
| Language       | **TypeScript** (strict)                                             |
| UI             | **Tailwind CSS v4** + **shadcn/ui** (Radix primitives)              |
| State (client) | **Zustand** (cart, persisted to localStorage)                       |
| ORM / DB       | **Prisma 6** + **Neon PostgreSQL** (pooled `DATABASE_URL` + direct `DIRECT_URL`) |
| Auth           | **NextAuth v5 (Auth.js)** — Google OAuth + Credentials, JWT session |
| Email          | **Resend** · Payments: **Razorpay** · Media: **Cloudinary**         |
| AI             | **Groq** via **Vercel AI SDK v6** (`llama-3.3-70b-versatile`)       |
| Cache / limits | **Upstash Redis** (`@upstash/ratelimit`, fail-open)                 |
| Validation     | **Zod v4** · Forms: **React Hook Form** · Toasts: **sonner** · Icons: **lucide-react** |

### Pinned-version decisions (do not undo without a reason)
- **Next.js 15, not 16** (spec requires 15; 16 is breaking).
- **Prisma 6, not 7** — dev machine runs Node 21.1.0 (EOL); Prisma 7 requires
  Node 20.19+/22.12+/24+. Move to Node LTS first, then bump.
- **shadcn initialized with `-b radix`** — the default Base UI build has no `asChild`.

## 3. Layout (short map — full tree in `docs/architecture.md`)

```
app/(storefront) (account) (auth) survey/ admin/ api/     Route groups + panels
components/{ui,storefront,account,admin,auth,survey}/     UI by surface
lib/            actions/ (server actions; admin/ has AdminResult), queries/, ai/,
                recommendations/, marketing/, affiliate/, validations/, pdf/, store/
                + one file per concern (pricing, orders, auth, env, cld, video, …)
prisma/         schema + migrations + idempotent seed
middleware.ts   /account + /admin guards, security headers, ?ref cookie
docs/           Feature docs · .claude/skills/  Project skills
```

## 4. Coding standards

- **Strict TypeScript.** No `any` unless unavoidable; prefer Prisma-generated and
  Zod-inferred types. Type server-action inputs as `unknown`, parse with Zod.
- **Server-first.** Default to RSC; `"use client"` only for state/effects/browser APIs.
- **Never *call* a function exported from a `"use client"` module in a Server
  Component** — it throws in production builds. Client components may only be rendered.
  Shared pure helpers/types live in plain modules (e.g. `lib/admin/product-form-values.ts`).
- **Server Actions** (`"use server"`) for mutations; every export must be async.
  **Reads** in `lib/queries/*` or directly in RSC pages.
- **Route Handlers** only for third-party integrations, webhooks and binary responses.
  Webhooks verify signatures over the **raw** body and must be **idempotent**.
- **Never trust the client** for prices, stock, totals or roles — re-price/re-authorize
  server-side (`lib/orders.ts#priceCart`, `previewOrderPricing`).
- **Validate every external input with Zod** at the boundary. Sanitize CMS/admin HTML
  with `lib/sanitize.ts#sanitizeRichText` (`sanitize-html`; NOT `isomorphic-dompurify` —
  its `jsdom` dep breaks the production build under Node 21).
- **Auth in actions:** `getCurrentUser()` / `requireUser()` from `lib/auth.ts`; admin
  actions start with `requirePermission("key")`. After writes, `revalidatePath(...)`.
- **Keep `lib/auth.config.ts` edge-safe** — no Prisma/bcrypt (it runs in middleware).
- **Errors:** friendly messages to the UI; `console.error` details server-side.
- Reuse existing components/helpers before writing new ones; match surrounding style.
- **Comments** only where they add real value (the "why", invariants, gotchas).

### Naming
Files kebab-case · components PascalCase · functions/vars camelCase · constants
UPPER_SNAKE_CASE · Prisma models PascalCase singular, enums UPPER_SNAKE · routes
lowercase with `[slug]`/`(group)` · server actions verb-first (`createOrder`).

## 5. UI / UX essentials

- Mobile-first (design at 360px), accessible (semantic HTML, labels, keyboard, focus,
  `aria-*` on icon buttons), theme tokens only (`bg-primary`, `text-muted-foreground`,
  `border`, `accent`) — never hard-code hex. Dark mode via `next-themes`.
- Brand: deep pine-teal `--primary oklch(0.55 0.15 168)` (matches the logomark, hue 176);
  warm-gold accent (`bg-gold`/`text-gold`) for premium highlights only. Full token sets
  in `app/globals.css`.
- Premium language: `shadow-elev-1/2/3` (+`hover-lift`), `rounded-xl/2xl`, `animate-fade-up`,
  `Reveal` (`[data-reveal]` scroll-reveal), `.shimmer`, `BlurImage` (blur-up, no CLS),
  `EmptyState`, `skeletons.tsx` + route `loading.tsx`. **All motion is
  reduced-motion-gated** — keep new motion behind the same gate.
- Money via `formatPrice` (never raw division). Images via `next/image` with `sizes`
  (stories/story rail use plain `<img>` deliberately — any-host media).
- Don't use `useSearchParams` in layout-mounted client components (static-render deopt) —
  read `window.location` on mount instead.

## 6. Core conventions

- **Money is INTEGER paise** everywhere (₹1 = 100 paise); format only at the edge.
- **Keyless fallbacks everywhere** via `lib/env.ts#isConfigured` — the app must always
  run with blank keys (mock checkout, console emails, "AI not configured", no-op cache).
- **Cart is client-side** (Zustand); the server re-prices authoritatively at checkout.
  Pricing/tax/shipping breakdown comes from `lib/pricing.ts#computeBreakdown` everywhere.
- **Stock deducts on order confirm**; `Order.stockDeducted` is the single idempotency +
  restock signal. Order/return lifecycles each have a status single-source-of-truth
  (`lib/order-status.ts`, `lib/return-status.ts`) + engine (`transitionOrderStatus`,
  `transitionReturnStatus`). Details: `docs/commerce.md`.
- **Admin actions** return `AdminResult<T>`; RBAC keys in `lib/permissions.ts`; pages
  `guardSection("key")`, actions `requirePermission("key")`. Details: `docs/admin.md`,
  workflow: `admin-module` skill.
- **StoreSetting is a singleton row**; new feature config = additive column or JSON blob
  resolved over code defaults (`growth`/`pwa`/`seo`/`heroReveal` pattern —
  `docs/architecture.md`).
- **Feature catalogs are client-safe single-source-of-truth modules** (quiz questions,
  survey questions, showcase presets, hero-reveal config) — UI, validation and analytics
  all read the same catalog; store option KEYS, render labels.
- **Rate limiting** via `lib/rate-limit.ts` (Upstash, fail-open) on auth/AI/public
  submission endpoints.

## 7. Critical invariants — DO NOT REGRESS

1. **Service worker `isCacheable`:** only cache/serve clean same-origin 200s; pass
   redirects through; bump `VERSION` on SW changes. A violation once blanked
   `www.nutriyet.in`. (`docs/seo-pwa.md`)
2. **Favicon is metadata-driven:** never re-add `app/favicon.ico`/`app/icon.*` — they
   override the admin-uploaded favicon. `/favicon.ico` is served by rewrite → route.
3. **Groq `llama-3.3-70b-versatile` doesn't support `json_schema`** — use `generateText`
   + defensive JSON parse, never `generateObject`. Chat streams plain text
   (`toTextStreamResponse`), fallbacks carry `X-AI-Fallback: 1`.
4. **Analytics identity:** one shopper = one id (`nut_cid` client id preferred over
   cookie); engagement engine starts on first paint AND first interaction; impression IO
   threshold `[0, 0.5]`; confidence gating before ranking/AI. (`docs/analytics.md`)
5. **Cloudinary uploads go DIRECT from the browser** (signed) — never route media bytes
   through serverless (4.5 MB cap breaks video uploads).
6. **Hero videos never upscale/server-crop** (`c_limit` + CSS `object-cover`).
7. Neon **cold start** can throw `P1001` on first touch — retry once.

## 8. Database workflow

```bash
npm run db:generate | db:migrate | db:push | db:seed | db:studio | db:check
```
Migrations use `DIRECT_URL`; runtime uses the pooled URL. Additive migrations are cheap
and routine — name them after the feature (`hero_reveal`, `survey`).

## 9. Development workflow & definition of done

```bash
npm run dev · typecheck · lint · build
```

**Definition of done for every change:** typecheck ✅ · lint ✅ · production build ✅ ·
runtime smoke ✅ (drive the affected flow; verify disabled/keyless states render
unchanged). Shared First-Load JS budget: **~103 kB** — heavy client features must be
lazy chunks. Use the `verify-release` skill for the full gate + smoke recipes.
Commit + push only after everything passes. Deploy per `DEPLOYMENT.md`.

**Doc maintenance:** when a major feature lands or architecture changes, update the
relevant `docs/*.md` (and `PROGRESS.md`/`CHANGELOG.md`); update THIS file only for
globally relevant rules (stack, conventions, invariants); update a skill only when its
workflow changes. Don't update files unnecessarily; never duplicate content across docs.

## Documentation index

| Doc | Covers |
| --- | ------ |
| `docs/architecture.md` | Full folder tree, DB models + workflow, StoreSetting/JSON-blob pattern, env vars, milestones |
| `docs/commerce.md` | Pricing/GST/shipping engine, checkout authority, order workflow, COD, invoices, returns & refunds |
| `docs/admin.md` | RBAC roles/permissions/enforcement, admin form conventions, bulk-action foundation |
| `docs/ai.md` | Provider/RAG seams, chat streaming, AI search, recommendation engine, AI insights |
| `docs/analytics.md` | Range analytics, journey funnel, heatmap, rage clicks, session replay, accuracy invariants |
| `docs/cms.md` | Hero slider + video + Product Reveal, banners, homepage editor, 3D showcase, blog/legal/contact/track, stories |
| `docs/affiliates.md` | Affiliate program: attribution, commission engine, payouts, admin |
| `docs/marketing.md` | Marketing Hub: campaigns, channels (push/WhatsApp/SMS), cron, recurrence, automations |
| `docs/growth.md` | Conversion features (quiz/popup/bar/trust/coupon) + bilingual consumer survey |
| `docs/social-automation.md` | AI Marketing Automation Hub: 4-week content strategy, AI generation + claim-safety, planner/publisher, Instagram Graph API, GitHub Actions cron, `/admin/social` |
| `docs/seo-pwa.md` | SEO manager, favicon system, service worker/PWA, Cloudinary upload + delivery |
| `docs/jnv-smart-class.md` | JNV Smart Class Portal: isolated education module (`/admin/jnv` RBAC-gated admin, unlisted `/jnv` no-login student portal) — schema, isolation model, routes |
| `docs/guides/marketing-hub.md` | Non-technical admin user guide for the Marketing Hub |
| `docs/guides/push-notifications.md` | Web Push (VAPID) setup & operations |
| `DEPLOYMENT.md` | Vercel deploy, env vars, Razorpay webhook, migrate deploy |
| `PROGRESS.md` / `CHANGELOG.md` | Live tracker / history |

**Skills** (`.claude/skills/`): `admin-module` — add/extend an admin section end-to-end ·
`verify-release` — the project verification gate + smoke-test recipes.
