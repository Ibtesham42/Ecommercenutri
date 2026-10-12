# Growth — Conversion Optimization, Health Quiz, Consumer Survey

> Part of the [Nutriyet docs](../CLAUDE.md#documentation-index).

## Conversion optimization (Phase 1)

Signup-conversion features layered additively on the storefront, all admin-toggleable —
the site is unchanged when off. Config lives in the additive **`StoreSetting.growth`
JSON blob** (`lib/growth-settings.ts#resolveGrowth`/`getGrowthSettings`, zero-migration
pattern like `pwa`/`seo`): `quizEnabled`, `welcomePopupEnabled`, `stickyBarEnabled`,
`trustEnabled`, `couponCode` (default `WELCOME20`), `couponPercent` (default 20), +
popup/sticky copy. Migration `growth_conversion`.

- **AI Health Score Quiz** (`/quiz`, `components/storefront/quiz/*`): 6-question
  assessment (`lib/quiz/questions.ts` — single source of truth, client-safe) →
  `scoreQuiz` (`lib/quiz/score.ts`, pure/deterministic 0–100 + band + rule-based
  recommendations; **not** medical) → result screen (dependency-free SVG `ScoreGauge`,
  animated stepper, reduced-motion gated).
  Flow is **quiz-first, signup-to-unlock**: `completeQuiz` (server action) scores +
  persists a `HealthQuizResult` keyed by the `nut_anon` cookie (set in-action if absent)
  + optional Groq summary enhancement (rule-based fallback), returns a teaser; the full
  report + coupon unlock after `quizSignup` (additive action — creates user + claims the
  result + grants the coupon + `signIn`, leaving the register flow untouched).
  `claimQuizForCurrentUser` runs on `/account` load to claim pending anon results for
  Google/normal-register paths (idempotent). Dashboard "My Health Score" card
  (`components/account/my-health-score.tsx`).
- **Smart Welcome Popup** (`components/storefront/growth/welcome-popup.tsx`): first-time
  + logged-out only, never on checkout/quiz/auth, once per 24h (localStorage), triggers
  after 10s OR 40% scroll.
- **Sticky Offer Bar** (`offer-bar.tsx`): dismissible (24h), Get Coupon + Take
  Assessment. Renders in normal flow at the very top (NOT fixed — never fights the
  sticky header).
- **Trust Section** (`trust-section.tsx` + `lib/queries/trust.ts`): static
  product-promise badges + **real** DB stats (orders delivered / verified reviews + avg
  rating / returning customers) shown ONLY above a credibility threshold — **never
  fabricated**. Injected below the hero on the homepage.
- **Welcome coupon** is a shared public `Coupon` (PERCENT, perUserLimit 1) kept in sync
  on admin save + `ensureWelcomeCoupon`; `revealWelcomeCoupon` surfaces + copies it and
  records the claim.
- **Analytics:** `UserEventType` values `QUIZ_START`/`QUIZ_COMPLETE`/`QUIZ_SIGNUP`/
  `COUPON_CLAIM`/`POPUP_VIEW`/`POPUP_CONVERT`/`STICKY_CLICK` (client-fired ones in the
  `/api/track` allowlist; quiz-complete/signup/coupon fire server-side). Surfaced in a
  **Conversion & growth** section on `/admin/insights` (`lib/queries/conversion.ts`).
- **Admin control** (`/admin/growth`, `appearance` permission): toggles + coupon
  code/percent + copy (`components/admin/growth-manager.tsx`,
  `lib/actions/admin/growth.ts`, revalidates layout+home).

## Consumer Survey (bilingual, link-only)

"Consumer Awareness & Healthy Snacking Survey" at **`/survey`** — a **link-only** public
page (own branded layout with the store logo, OUTSIDE the storefront route group — no
header/nav/footer, `robots noindex`, never linked from the user-facing site or sitemap).

- **Catalog:** question/section/option definitions live in **`lib/survey.ts`**
  (client-safe single source of truth; option KEYS are stored, labels render EN + HI).
  The form (`components/survey/survey-form.tsx`), the Zod schema
  (`lib/validations/survey.ts`, enums derived from the catalog) and admin analytics all
  read it — labels/options live in exactly one place.
- **Submissions:** `lib/actions/survey.ts#submitSurveyResponse` (anonymous, IP
  rate-limited; contact name/mobile/email kept only when Q17 opt-in = yes) into the
  `SurveyResponse` model (typed columns + String[] for multi-selects, migration
  `survey`). A localStorage flag soft-guards duplicates (with "Fill again").
- **Admin** at `/admin/survey` (`customers` permission, nav "Survey"): copy/open
  **share-link** card (link built from the live request host — the only place the URL
  surfaces), KPIs (total / last-7d / opt-ins% / cities), responses-over-time bars,
  per-question option breakdowns with counts+percentages (multi-select % base =
  respondents), top-cities chips, expandable raw-response list and **CSV export**
  (`/admin/survey/export`, English labels).
- Stats aggregate in JS over one bounded fetch (`lib/queries/survey.ts`) — fine at
  survey scale, keys stay in lockstep with the catalog.

## Spin & Win

Opt-in discount wheel at **`/spin`** (noindex). Entry points are explicit only —
a quiet band on the homepage (under the top banner) and on `/offers`, rendered by
`components/storefront/spin/spin-entry.tsx` only while a campaign is live. **Never a popup.**

**Flow.** Spin → result (server-decided) → sign in/up → offer claimed to the account →
shop the prize product → one-tap apply at checkout. Signed-in shoppers are claimed
instantly. A win made before signing in is held for `claimWindowHours` via an
httpOnly `nut_spin` cookie (only its sha256 is stored); it is claimed when the
shopper returns to `/spin` (login `callbackUrl=/spin`) **or** lands on `/account`
(`SpinOfferCard`, mirroring the quiz claim — covers email sign-up, which returns to
login without a callback).

**Data.** `SpinCampaign` (config, admin `/admin/spin`, `coupons` permission) and
`SpinResult` (one per spin; `AWARDED → CLAIMED → REDEEMED`, or `EXPIRED`). Migration
`spin_win` is purely additive.

**Redemption = the coupon engine.** A claim mints a personal `Coupon`
(`SPIN-XXXXXXXX`, `usageLimit 1`, `perUserLimit 1`, `ownerUserId`, `variantIds`,
`saleMode`, campaign min-order/max-discount, `offerValidDays` expiry). Checkout,
`previewOrderPricing`, `createOrder` and `confirmOrder`'s atomic usage-limit claim
handle it unchanged; `confirmOrder` then marks the spin `REDEEMED` (best-effort,
after commit). Spin coupons are hidden from `/admin/coupons`. One coupon per order,
so spin offers never combine with another coupon.

New `Coupon` columns (defaults keep every existing coupon identical):
- `ownerUserId` — only that user may redeem (others get the generic "not valid").
- `variantIds` — **line-scoped**: discount applies only to those variants' lines
  (`lib/coupons.ts#lineScopedDiscount`, rounded per unit, capped by `maxDiscount`).
- `saleMode` (line-scoped only) — `BEST_OF` (default for spin: customer pays the lower
  of sale price and MRP − %, never both), `EXCLUDE` (skip sale lines), `STACK`.

**Prize selection** (`lib/spin/selection.ts`, pure + tested; server-only):
1. Candidate variants: in the campaign's eligible list, variant + product active,
   `stock > minStock` (the reserve).
2. Product weight = `min(Σ(stock − minStock), weightCap)` — high stock is offered
   more, low stock proportionally less, at/below reserve never.
3. Discount tier drawn independently by its weight (`prizes` JSON, resolved by
   `lib/spin/config.ts#resolvePrizes`). Crypto RNG.
Stock is re-checked at **claim** (sold-out prize → moved to another in-stock eligible
product at the same %) and again at checkout (`priceCart`). The browser only ever sees
the tier percents — never weights or stock. The admin editor previews per-product
chances with the same functions.

**Eligibility** is stored as variant IDs. New campaigns pre-select the approved
list (`APPROVED_ELIGIBILITY` name/size matcher) for the admin to review — names are
a hint only, never the stored rule.

**Abuse controls.** One spin per account per campaign (`@@unique([campaignId, userId])`);
replays return the existing result (no re-rolls); claims are a conditional
`updateMany` on `status: AWARDED` in a transaction (loser rolls back its coupon);
campaign `maxClaims` uses the guarded-increment pattern; new anonymous spins are
rate-limited per IP and per anon id (`limiters.spin`, 4/day), claims per user.
Residual: anonymous visitors on fresh IPs can spin more than once, but can still
claim only one offer per account.

**Lifecycle rules.** Pausing (`isActive=false`) stops new spins and keeps history;
already-claimed offers stay valid until they expire. Campaigns with spins can't be
deleted. The newest live campaign is the one played.

**Analytics** (`UserEventType`): `SPIN_ENTRY` (client, entry tap) · `SPIN_START`,
`SPIN_WIN`, `SPIN_AUTH`, `SPIN_CLAIM`, `SPIN_REDEEM` (server-side only).

**Tests.** `lib/spin/*.test.ts`, `lib/coupons-line-scoped.test.ts`,
`lib/actions/admin/spin.test.ts` (unit); `lib/spin/service.int.test.ts` runs the
claim/replay/race/expiry/cap/stock flow against a real Postgres when
`SPIN_TEST_DATABASE_URL` points at **localhost** (it refuses any other host).
