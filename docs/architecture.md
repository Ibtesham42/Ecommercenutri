# Architecture — Folder Structure, Database, Environment

> Part of the [Nutriyet docs](../CLAUDE.md#documentation-index). Detailed reference —
> the always-needed essentials live in `CLAUDE.md`.

## Folder structure

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
    affiliate/         Affiliate program landing
    quiz/              AI Health Score quiz (growth)
    b2b/               B2B inquiries
  (account)/           Authenticated customer area (middleware-gated)
    account/           Profile, addresses, orders, orders/[orderNumber],
                       wishlist, ai-history, returns, affiliate
  (auth)/              login, register, forgot/reset password, verify-email
  survey/              Public link-only bilingual survey (own layout, noindex)
  admin/               ADMIN-only panel (guarded by middleware + layout)
    page.tsx           Dashboard; orders/, products/, inventory/, categories/,
                       coupons/, stories/, hero/ (slider CMS), banners/, homepage/,
                       showcase/, blog/, legal/, appearance/, seo/, shipping/,
                       customers/, messages/, b2b/, notifications/, reviews/,
                       affiliates/, marketing/, growth/, survey/, insights/,
                       ai-settings/, admins/, settings/
  api/
    auth/[...nextauth] NextAuth handler
    ai/chat            Streaming AI chat (text stream; general + per-product)
    webhooks/razorpay  Razorpay webhook (signature-verified, idempotent)
    track/ heat/ replay/  Analytics beacons (Zod + rate-limited, fail-open)
    invoices/ credit-notes/  PDF routes (owner/admin gated)
    cron/marketing     Scheduled campaign dispatch (CRON_SECRET)
  sitemap.ts / robots.ts          SEO (dynamic, DB-driven sitemap)
  manifest.ts                     PWA web manifest (dynamic, admin favicon)
  opengraph-image.tsx             Generated OG image (next/og)
  brand-icon/ brand-apple-icon/   Brand-default favicons (next/og routes)
  offline/             PWA offline fallback page (service worker in public/sw.js)
components/
  ui/                  shadcn primitives (do not hand-edit lightly)
  storefront/          Storefront components (product-card, cart-view, checkout-client,
                       hero-slider, hero-reveal/, showcase/, quiz/, growth/, …)
  account/             Account components (address-form/manager, profile-form, …)
  admin/               Admin components (nav, page-header, product-form, *-manager, bulk/, …)
  auth/                Auth forms + buttons
  survey/              Public survey form
config/site.ts         Site metadata, nav, contact, social (fallbacks)
lib/
  actions/             Server actions ("use server") — auth, account, checkout, reviews,
                       wishlist, returns, affiliate, quiz, survey, contact, b2b, track
    admin/             Admin mutations (products, hero, banners, marketing, …
                       + types.ts: AdminResult)
  ai/                  AI layer — provider (registry/seam), settings, retrieval (RAG seam),
                       prompts, chat (orchestration), search, recommendations, history
  recommendations/     Centralized reco service — events (tracking), service, intent
  marketing/           Campaign channels/audience/delivery/providers/automation
  affiliate/           Attribution + commission engine + labels
  queries/             Read helpers (catalog, products, home, admin analytics, insights, …)
  validations/         Zod schemas (auth, account, checkout, review, admin, survey, …)
  store/               Zustand stores (cart)
  pdf/                 @react-pdf/renderer documents (invoice, credit note, analytics)
  prisma.ts            Prisma client singleton
  auth.ts / auth.config.ts   NextAuth (config is edge-safe; no Prisma in middleware)
  env.ts               Central env access + `isConfigured` feature flags
  format.ts            Money (paise) + date helpers
  pricing.ts           GST + shipping breakdown engine (client-safe)
  orders.ts / order-status.ts / returns.ts / return-status.ts / coupons.ts
  permissions.ts / admin-guard.ts   RBAC
  survey.ts / hero-reveal.ts / showcase.ts / growth-settings.ts / seo-settings.ts /
  pwa-settings.ts / legal-content.ts / home-content.ts / banners.ts   Feature catalogs/settings
  razorpay.ts / groq.ts / cloudinary.ts / redis.ts / email.ts / emails.ts / seo.ts /
  rate-limit.ts / tokens.ts / cld.ts / video.ts / csv.ts / sanitize.ts / geo.ts / ua.ts
prisma/
  schema.prisma        Domain models (SQL-validated)
  migrations/          Prisma Migrate history
  seed.ts              Idempotent seed (admin, categories, products, coupons, stories)
scripts/db-check.ts    DB sanity report (counts + relational sample)
middleware.ts          Auth guards (/account, /admin) + security headers + ?ref cookie
types/                 Ambient types (next-auth.d.ts)
docs/                  Feature documentation (this folder)
.claude/skills/        Project skills (admin-module, verify-release)
```

## Database

- **Neon PostgreSQL**, accessed two ways (see `prisma/schema.prisma` datasource):
  - `DATABASE_URL` — **pooled** (`-pooler` host) for app runtime / serverless.
  - `DIRECT_URL` — **direct** (non-pooler) for Prisma Migrate.
- Neon compute **scales to zero**; the first connection after idle can throw
  `P1001` (cold start). Retry once — it warms up.
- Domain model groups: Auth (User, Account, Session, VerificationToken,
  PasswordResetToken), Catalog (Category, Brand, Product, ProductVariant,
  ProductImage, Review), Customer (Address, Cart, CartItem, WishlistItem,
  Notification), Commerce (Coupon, Order, OrderItem, OrderEvent, Invoice,
  ReturnRequest, ReturnRequestItem, ReturnEvent, CreditNote), Stories
  (Story, StoryView), AI (AIChat, AIMessage, AISetting), CMS (HeroSlide, Banner,
  HomeSection, ShowcaseItem, BlogPost, ContentPage, ContactMessage, StoreSetting),
  Affiliate (Affiliate, AffiliateClick, CommissionRule, Commission, Payout,
  MarketingAsset), Marketing (Campaign, CampaignEvent, CampaignTemplate,
  AudienceSegment, AutomationRule, AutomationLog, PushSubscription), Analytics
  (UserEvent, HeatStat, SessionRecording), Growth (HealthQuizResult),
  Survey (SurveyResponse).
- **Money is stored as INTEGER paise** everywhere (₹1 = 100 paise). Always use
  `lib/format.ts` helpers and `effectivePrice`.
- **Order snapshots:** `Order.shippingAddress` (JSON) and `OrderItem` fields
  (productName/variantLabel/image/price) snapshot values at purchase time.
- Indexed foreign keys throughout; unique constraints on slugs, SKUs, coupon codes,
  `orderNumber`, and natural keys (`[cartId, variantId]`, `[userId, productId]`).
- **StoreSetting is a singleton row** (`id: "singleton"`). New feature config: either
  additive scalar columns or an additive **JSON blob** column (`seo`, `pwa`, `growth`,
  `heroReveal`) resolved over code defaults by a `lib/<feature>-settings.ts`-style
  module (Blob type → `Required<Blob>` settings → DEFAULTS → pure `resolve()` →
  `get()` with defaults-on-error). Blobs need no per-field migrations.

### Database workflow

```bash
npm run db:generate   # prisma generate
npm run db:migrate    # prisma migrate dev (uses DIRECT_URL)
npm run db:push       # prisma db push (prototype only)
npm run db:seed       # tsx prisma/seed.ts (idempotent)
npm run db:studio     # prisma studio
npm run db:check      # scripts/db-check.ts — counts + relational sanity report
```

## Environment variables

Copy `.env.example` → `.env`. **Every integration has a keyless fallback**, so the
app runs end-to-end with blanks (mock checkout, console-logged emails, "AI not
configured", no-op cache). Feature availability is centralized in
`lib/env.ts#isConfigured`.

Groups: **App** (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_NAME`) · **DB**
(`DATABASE_URL`, `DIRECT_URL`) · **Auth** (`AUTH_SECRET`/`NEXTAUTH_SECRET`,
`NEXTAUTH_URL`, `AUTH_GOOGLE_ID/SECRET`) · **Email** (`RESEND_API_KEY`, `EMAIL_FROM`)
· **Payments** (`RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`)
· **Media** (`CLOUDINARY_*`) · **AI** (`GROQ_API_KEY`, `GROQ_MODEL`) · **Cache**
(`UPSTASH_REDIS_REST_URL/TOKEN`) · **Push/WhatsApp/SMS**
(`NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`,
`WHATSAPP_TOKEN`/`WHATSAPP_PHONE_ID`, `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM`)
· **Cron** (`CRON_SECRET`) · **Analytics** (`NEXT_PUBLIC_ANALYTICS_SRC`/`_DOMAIN`)
· **Admin bootstrap** (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, used by the seed).

## Milestone history

M0 foundation → M1 storefront+auth → M2 cart/checkout/payments → M3 admin →
M4 AI (Groq) → M5 stories/Cloudinary → M6 SEO/PWA/analytics/deploy — all complete;
then Admin RBAC, CMS phases (hero/banners/homepage/showcase/blog/legal), affiliates,
marketing hub, growth/conversion, engagement analytics, consumer survey. See
`PROGRESS.md` (live tracker) and `CHANGELOG.md` (history).
