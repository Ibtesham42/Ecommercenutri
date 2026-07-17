# AI Marketing Automation (Social) — `docs/social-automation.md`

> Auto-generates and publishes social content (Instagram-first) from the product
> catalog, on a rotating 4-week strategy, with zero daily manual captioning.
> Admin surface: **`/admin/social`** (RBAC key `social`). Mirrors the Marketing
> Hub's due-queue + keyless-fallback patterns — see `docs/marketing.md`.

## What it does

An admin picks products + a schedule and turns automation on. A free scheduler
(GitHub Actions cron) then, every ~30 min:

1. **Plans** the day's due slots (morning/evening) into `SocialPost` rows,
   generating unique copy from real product data.
2. **Publishes** any scheduled posts whose time has arrived to Instagram via the
   Meta Graph API (or a mock publish when not yet connected).

Everything degrades gracefully: no Groq key → deterministic template copy; no
Instagram token → drafts + simulated publish; DB error → safe defaults.

## Content strategy (single source of truth)

`lib/social/strategy.ts` is a client-safe catalog of the **4-week × morning/evening**
plan. Week is derived from the day of the month (1–4), then repeats:

| Week | Morning pillar | Evening pillar |
| --- | --- | --- |
| 1 | Product Knowledge | Healthy Snacking |
| 2 | Target Audience | Why Nutriyet |
| 3 | Lifestyle | Recipes & Serving |
| 4 | Community | Customer Stories |

Each pillar carries rotating **angles**; `angleAt(slot, n)` cycles them so
successive posts stay fresh. UI, planner and analytics all read this one module.

## Generation & safety (`lib/social/ai.ts`)

`generateSocialPost()` mirrors `lib/marketing/ai.ts`: `aiAvailable()` guard +
deterministic fallback, `getModel(getAISettings().model)`, one `generateText`
call, defensive JSON parse (never `generateObject` — the Groq model has no
`json_schema`). Output: `hook`, `caption`, `captionLong`, `cta`, `hashtags[]`,
`altText`, `contentHash`.

**Two safety layers against unsupported health claims:**
- The system prompt is fed **only** DB product facts and forbids inventing
  nutrition numbers or making medical/disease claims.
- `stripBannedClaims()` removes any banned word/phrase (configurable in Settings)
  that slips through.

**Uniqueness:** recent hooks + recently-used hashtags are injected into the prompt
to avoid repetition; exact-duplicate content is rejected via `contentHash` (djb2).

## Creative engine (`lib/social/creative/`)

Post covers used to be a bare product photo with a Cloudinary URL-transform
text layer on top ("a product photo with text added"). They're now a fully
composed premium creative rendered with `next/og` (`ImageResponse`, i.e.
satori + resvg — already a project dependency, used for the OG/favicon images)
instead of Cloudinary URL chains:

- **`looks.ts`** — the LOOK catalog (`EDITORIAL`, `LUXURY_MINIMAL`,
  `ORGANIC_WELLNESS`, `MODERN_D2C`, `APPLE_MINIMAL`, `RECIPE_EDU`,
  `HEALTH_FACT`, `INFOGRAPHIC`), rotated by `pickLook()` the same way
  `styles.ts` rotates writing styles — independent of both the content pillar
  and the content style, so three independent rotations keep the feed from
  ever repeating. `RECIPE_EDU` is marked `sequential: true` and excluded from
  the rotation unless the caller passes `sequentialContent: true` (only when
  the post's content STYLE is `RECIPE`) — it numbers `benefits` as steps
  ("1. ... 2. ..."), which only reads naturally for an actual serving idea.
- **`icons.tsx`** — a small hand-drawn icon set (leaf, sparkles, droplet,
  flame, shield-check, check), NOT lucide-react. lucide's icons rendered
  completely blank inside satori — its components are `forwardRef`-wrapped
  and call `useContext` (`LucideProvider`/`LucideContext`), which satori's
  minimal JSX evaluator doesn't support the way a real DOM render does; it
  fails silently (no crash, no icon) rather than throwing. Plain functions
  returning raw `<svg>`/`<path>` elements — no `forwardRef`, no context, no
  hooks — work natively. Any future icon needs to follow this same pattern,
  not import from an icon library.
- **`primitives.tsx`** — the shared design-system pieces every look composes
  differently: `GlassCard` (translucent fill + hairline border + shadow —
  resvg's blur/backdrop-filter support is inconsistent, so "glass" is faked
  with layering, not real blur), `BenefitChip` / `IconStatCard` (icon + label,
  pill vs. grid-card treatments), `CtaPill`, `OrganicBlob` (radial-gradient
  soft shapes, not `filter:blur`, for the same reason), `Watermark`
  (typographic wordmark lockup + optional connected IG handle — not a fetched
  logo image, so it always renders and never clashes).
- **`render.tsx`** — one JSX layout function per look, rendered to a PNG via
  `ImageResponse`. Real typography hierarchy (Fraunces/Hanken Grotesk — the
  SITE's actual brand fonts, loaded as static WOFF files in `lib/social/fonts/`
  since satori needs non-variable font data; the old Cloudinary engine had to
  substitute Playfair/Montserrat because Cloudinary doesn't support Fraunces —
  that limitation no longer applies). Every satori `<div>` with more than one
  child needs an explicit `display` (flex/none) or rendering throws.
- **`platforms.ts`** — per-platform canvas sizes (Feed 1080×1350, Square,
  Story 1080×1920, Facebook, LinkedIn, Pinterest); the planner/admin currently
  always render at `FEED`.
- **`compose.ts`** — the pipeline both the planner and admin actions call:
  Cloudinary prepares a trimmed/rounded product cutout (`e_trim` + `c_fit` +
  `r_24` + `f_png` for genuine transparent corners) → fetched server-side
  (via the classic `https` module, not `fetch`/undici — deliberately, some
  sandboxed environments have flaky undici connectivity) → embedded as a data
  URI in the satori tree → rendered → uploaded to Cloudinary
  (`nutriyet/social/generated`) so `imageUrls` stays a plain public URL like
  every other post image. Degrades like every other social feature: no
  Cloudinary configured → ships the plain product photo, exactly like before
  this engine existed.
- **On-image content**: the AI (`lib/social/ai.ts`) now also returns
  `benefits: string[]` (3-5 short badge phrases, grounded in the real product
  facts the same way `headline`/`support` are — never an invented claim), used
  as the benefit-chip row / step list on the cover.

## Data model (`prisma/schema.prisma`)

- **`SocialPost`** — one generated post through its lifecycle (`DRAFT →
  PENDING_APPROVAL → SCHEDULED → PUBLISHING → PUBLISHED / FAILED / CANCELLED`).
  `productId` is a plain id (no FK, like `Campaign`). `imageUrls[]` is carousel-
  ready (`[0]` = cover). `contentHash` dedups. Analytics counters are nullable.
- **`SocialCampaign`** — run config: `productIds[]`, `platforms[]`, `mode`
  (`AUTO_PUBLISH`/`MANUAL_APPROVAL`/`DRAFT`), `morningTime`/`eveningTime` (HH:mm
  IST), `days[]`, `maxPerDay`, `startsAt`/`endsAt`.
- **`SocialTemplate`** — per-pillar prompt guidance (idempotent built-ins via
  `ensureBuiltInSocialTemplates`).
- **`SocialAccount`** — connected IG account metadata (single row). **The access
  token is never stored here — it lives in env.**
- **`StoreSetting.social`** JSON blob — global defaults (brand voice, schedule,
  mode, default hashtags, banned words, carousel). Resolved by
  `lib/social/settings.ts#getSocialSettings` (growth-settings pattern, additive,
  zero-migration).

## Pipeline

- `lib/social/planner.ts#planDuePosts(now)` — for each enabled campaign in window
  and today's weekday, fills the morning/evening slots (up to `maxPerDay`). IST-
  aware scheduling, product + angle rotation, recent-content injection. Idempotent:
  never a second post per campaign+daypart+IST-day; skips duplicate `contentHash`.
  Status derives from the campaign `mode`.
- `lib/social/publish.ts#publishDuePosts(now)` — claims `SCHEDULED → PUBLISHING`
  atomically (conditional `updateMany`, so a double-fired cron can't double-post),
  publishes, records `externalId`/`permalink` or `error`. `publishPostNow(id)`
  backs the admin "Publish now".
- `lib/social/instagram.ts#publishToInstagram()` — Meta Graph API: single image
  (`/{ig}/media` container → `/media_publish`) or carousel (N child containers →
  `CAROUSEL` parent → publish). Keyless → mock success. Caption/hashtag capped.

## Scheduling (free, laptop-independent)

- **Endpoint:** `GET|POST /api/cron/social` — runs `planDuePosts` then
  `publishDuePosts`. Guarded by `CRON_SECRET` (`Authorization: Bearer <secret>`);
  open when unset (dev). Mirrors `/api/cron/marketing`.
- **Trigger:** `.github/workflows/social-cron.yml` — GitHub Actions cron every
  30 min (Vercel Hobby crons are once/day, so this covers separate morning +
  evening times). Needs repo secrets `SITE_URL` + `CRON_SECRET`. The endpoint is
  idempotent, so drift/extra runs are safe. `cron-job.org` pointed at the same
  URL is an equivalent alternative.

## Admin (`/admin/social`)

Guarded once in `layout.tsx` (`guardSection("social")`). Tabs: **Dashboard**
(stats + connect card + Generate / Plan / Run-cycle), **Calendar** (4-week
strategy + upcoming), **Queue** (drafts + approvals; edit/regenerate/approve/
publish/reject/delete + bulk), **Scheduled**, **Published**, **Failed**,
**Campaigns**, **Analytics** (published-by-pillar, best time, top products,
engagement), **Templates**, **Settings**. Actions in `lib/actions/admin/social.ts`
return `AdminResult` and start with `requirePermission("social")`.

## Setup (real publishing)

1. Convert the Instagram account to **Business/Creator** and link it to a
   **Facebook Page**.
2. Create a Meta app with the Instagram Graph API; get a **long-lived access
   token** and the **IG user id**.
3. Set env: `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ID` (optional
   `INSTAGRAM_API_VERSION`, default `v21.0`). The Graph host is auto-detected
   from the token — `IGAA…` (Instagram Login) → `graph.instagram.com`, else
   `graph.facebook.com`; override with `INSTAGRAM_API_BASE` if needed. Legacy key
   names `INSTA_AUTOGRAPH_TOKEN` / `INSTAGRAM_ACCOUNT_ID` are accepted as aliases.
4. Set `CRON_SECRET` (deployment env) and add `SITE_URL` + `CRON_SECRET` as
   **GitHub repo secrets** so the Action can trigger the endpoint.

Until step 3, the whole flow works with simulated publishing so it's fully
testable. See `DEPLOYMENT.md` for the env/secret checklist.

## Competitor Intelligence (`/admin/social/intelligence`)

Market research inside the hub: **learn from the market, never copy** — every
AI prompt hard-forbids reproducing competitor captions/creatives; only patterns,
trends and opportunities are extracted, and suggested content is always original.

- **Data model:** `Competitor` (admin watchlist; 9 Indian healthy-snacking
  defaults seeded idempotently by `ensureDefaultCompetitors`), `CompetitorSignal`
  (admin-recorded observations of *public* content — own words, public permalink,
  rough engagement, topic tags; nothing scraped, no ToS bypass),
  `IntelligenceReport` (`COMPETITOR_PROFILE` / `MARKET_TRENDS` / `CONTENT_GAPS`,
  cached via `@@unique([kind, periodKey])`), `ContentIdea` (scored ideas, one
  batch per IST day via `batchDate`).
- **Engine:** `lib/intelligence/engine.ts#runIntelligenceCycle` — refreshes stale
  profiles (priority-first, 3/run), weekly + monthly `MARKET_TRENDS`, weekly
  `CONTENT_GAPS`, then the daily ideas batch. Everything is idempotent/cached so
  the every-30-min cron is near-free; generation starts only after the
  configured IST `runHour`.
- **AI:** `lib/intelligence/ai.ts` — same seam as `lib/social/ai.ts`
  (`aiAvailable()` guard, `generateText` + defensive JSON parse, deterministic
  keyless fallbacks). Ideas are scored 0–100 on 7 dimensions (originality, brand
  voice, educational, trust, share, save, SEO); only ideas ≥ `minIdeaScore`
  (default 90) are badged "Recommended".
- **Settings:** `StoreSetting.intelligence` JSON blob →
  `lib/intelligence/settings.ts` (enabled, runHour, competitorRefreshDays,
  ideasPerBatch, minIdeaScore).
- **Admin:** Intelligence tab → dashboard (weekly/monthly insights, seasonal +
  festival opportunities, trend heatmap, engagement comparison, gap report, top
  themes, idea preview, competitor overview), `/competitors` (CRUD + pause +
  priority + signal recorder + per-competitor re-analysis), `/ideas` (score
  breakdown, shortlist/dismiss, **Use** → generates a fresh original draft into
  the Queue via `createDraftFromIdea`). Actions in `lib/actions/admin/intelligence.ts`
  (`requirePermission("social")`, `AdminResult`).
- **Cron:** `GET|POST /api/cron/intelligence` (CRON_SECRET-guarded), triggered
  as a second step of `.github/workflows/social-cron.yml`.
