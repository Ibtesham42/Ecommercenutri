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
shop the prize product → one-tap apply at checkout. A win made before signing in is
held for `claimWindowHours` via an httpOnly `nut_spin` cookie (only its sha256 is
stored); it is claimed when the shopper returns to `/spin` (login `callbackUrl=/spin`)
**or** lands on `/account` (`SpinOfferCard`). Email sign-up keeps the callback:
login → `/register?callbackUrl=/spin` → the verification link carries `next=/spin` →
`/verify-email` continues to `/login?callbackUrl=/spin`. Without a callback every
auth link behaves exactly as before.

**Verified claims.** Claiming needs a **verified email** (`emailVerified`, never a
phone-login placeholder address) **or a verified phone** (`phoneVerified` — a phone
merely saved on the profile doesn't count). Enforced server-side inside the claim
transaction (`isVerifiedClaimant`, error `UNVERIFIED`). Verified signed-in shoppers
are claimed instantly; an unverified account may still spin, but its win is held
`AWARDED` on the account until it verifies. `/spin` then shows a verify-to-claim panel:
email me a verification link (`sendSpinVerificationEmail`, the standard token + email,
returns to `/spin`), verify my phone (profile OTP, only where SMS is enabled), and
"I've verified — claim". Note: Google sign-ins don't get `emailVerified` from Auth.js,
so they verify by the email link or phone like everyone else.

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
**Reserved stock.** Every outstanding offer (claimed, coupon active, unused,
unexpired) reserves one unit of its product: `loadReservations` → the surplus is
reduced before weighting, both for new spins and at claim, and a fully promised
product isn't offered. Claims are serialised by a transaction-scoped advisory lock so
the reservation count includes every earlier claim.

Stock is re-checked at **claim** against the campaign's *current* approved list. A
sold-out or withdrawn prize moves to another approved, in-stock product at the **same
%** (`SpinResult.reassignedFromProductId`; `/spin` tells the shopper). No approved
replacement → `PRIZE_UNAVAILABLE`: the transaction rolls back, the win stays held, and
the shopper can retry until the claim deadline. Checkout re-checks stock again
(`priceCart`). The browser only ever sees
the tier percents — never weights or stock. The admin editor previews per-product
chances with the same functions.

**Eligibility** is stored as variant IDs. New campaigns pre-select the approved
list (`APPROVED_ELIGIBILITY` name/size matcher) for the admin to review — names are
a hint only, never the stored rule.

**Money: GST and refunds (Spin & Win orders only).** `validateCoupon` returns
`lineDiscounts` for spin coupons (`lineScopedAllocation`: the discount split per cart
line, largest-remainder rounding, never more than a line earned or is worth).
`computeBreakdown(…, lineDiscounts)` then extracts GST per line from what was
actually paid, so only the eligible line's taxable value drops; `createOrder` stores
each line's share in `OrderItem.discount`. Returns refund
`unitPrice × qty − share of the line discount` (`lib/return-refund.ts`, cumulative so
partial returns add up to exactly what was paid); `ReturnRequestItem.discount` records
it and the credit note shows "Less: Spin & Win offer discount". **Every other coupon
is unchanged**: proportional GST, `OrderItem.discount = 0`, refunds of unit price × qty.

**One live order per offer** (`lib/spin/checkout-guard.ts`). Under the coupon row
lock, an open order (PENDING, payment PENDING, stock not deducted) younger than 30
minutes holds the offer: a retry of the *same* online checkout reopens its Razorpay
payment; anything else is refused with a clear message. An older open order is
ignored only when verified unpaid (no gateway order, or Razorpay reports only failed
payments); a captured payment is reconciled via `markOrderPaid`; authorised, refunded,
unknown or API-error states keep the offer held. Nothing is ever cancelled by the
guard. An order with a captured-but-unconfirmed payment (manual review) always holds
it. `confirmOrder`'s atomic usage-limit claim remains the last line of defence.

**Abuse controls.** One spin per account per campaign (`@@unique([campaignId, userId])`);
replays return the existing result (no re-rolls); claims are a conditional
`updateMany` on `status: AWARDED` in a transaction (loser rolls back its coupon);
`maxClaims` is one atomic increment compared with the row's live value at write
time. New anonymous spins: **3 per browser and 50 per IP per day**
(`limiters.spinBrowser`/`spinIp`, `lib/spin/limits.ts`), checked only right before a
new spin is created; a missing/malformed browser id falls back to a hashed IP + UA
key (never stored with the spin). Upstash is fail-open, so without Redis there are no
anonymous limits. Residual: a client that mints a fresh browser id per spin is held
only by the per-IP cap — and still needs a separate verified account per claim.
Spin transactions use `TX_OPTIONS` (maxWait 5 s, timeout 15 s) and `withTxRetry`
(re-runs only on deadlock/serialization aborts, 3 attempts).

**Lifecycle rules.** Pausing (`isActive=false`) stops new spins and keeps history;
already-claimed offers stay valid until they expire. Campaigns with spins can't be
deleted. The newest live campaign is the one played.

**Analytics** (`UserEventType`): `SPIN_ENTRY` (client, entry tap) · `SPIN_START`,
`SPIN_WIN`, `SPIN_AUTH`, `SPIN_CLAIM`, `SPIN_REDEEM` (server-side only).

**Tests.** Unit: `lib/spin/*.test.ts`, `lib/spin-financials.test.ts`,
`lib/coupons-line-scoped.test.ts`, `lib/actions/spin.test.ts`,
`lib/actions/admin/spin.test.ts`. Database (`*.int.test.ts`, skipped unless
`SPIN_TEST_DATABASE_URL` points at **localhost**; `lib/test/local-db-env.ts` refuses
other hosts and blanks every live key): `service.int` (claim flow, verification,
reserves), `orders.int` (real `createOrder` → GST → returns → credit note) and
`concurrency.int` — **true parallel** races (duplicate spins/claims, claim caps, stock
allocation, duplicate orders/coupon use, a real deadlock) that assert, via
`pg_stat_activity`, that the requests really overlapped. Run them one file at a time
against a disposable multi-connection Postgres (e.g. the `embedded-postgres` npm
package), never PGlite (single connection):

```bash
SPIN_TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5434/spin_test?sslmode=disable&connection_limit=30" \
  npx vitest run lib/spin --no-file-parallelism
```

### Spin & Win — deploy & rollback runbook

**Deploy order.** Migrations first, then code:
1. `prisma migrate status` against production, and a drift check:
   `prisma migrate diff --from-url "$DIRECT_URL" --to-migrations prisma/migrations --shadow-database-url <throwaway> --exit-code`.
2. `prisma migrate deploy` — `spin_win` then `spin_win_integrity`. Both are additive
   only (new tables/enums/nullable or defaulted columns); old code runs fine on the new
   schema.
3. Deploy the code. Leave every campaign **inactive** until the eligible variant list
   has been checked against the live catalogue.

**Turn it off (no deploy).** In `/admin/spin`, pause the campaign: no new spins or
entry points, history kept, claimed offers stay valid. To also stop **claimed offers**
from being redeemed, deactivate the personal coupons (they're hidden from
`/admin/coupons`):

```sql
-- Stops redemption of every unused Spin & Win offer. Reversible (set back to true).
UPDATE "Coupon" SET "isActive" = false
WHERE id IN (SELECT "couponId" FROM "SpinResult" WHERE "couponId" IS NOT NULL)
  AND "usedCount" = 0;
```

Orders already paid with an offer are unaffected; their per-line discount drives
GST and refunds as recorded.

**Code rollback.** Roll the code back, never the schema. Older code ignores the new
columns (`Coupon.ownerUserId/variantIds/saleMode`, `OrderItem.discount`,
`ReturnRequestItem.discount`, `SpinResult.reassignedFromProductId`). Before rolling
back to code that predates line-scoped coupons, deactivate spin coupons first (SQL
above): old code would treat a `SPIN-` code as a whole-cart, anyone-can-use coupon.
Returns on spin orders requested after a rollback would refund the full line price
(old behaviour), so check `OrderItem.discount` when refunding those manually.

**Analytics enum.** `SPIN_ENTRY`, `SPIN_START`, `SPIN_WIN`, `SPIN_AUTH`, `SPIN_CLAIM`,
`SPIN_REDEEM` were added to `UserEventType`. **Never drop enum values**: Postgres can't
drop a value without rebuilding the type, and existing `UserEvent` rows reference
them. Old code simply never writes them; analytics queries filtering by type are
unaffected.

**Never** run `prisma migrate reset` or `db push --accept-data-loss` against
production, and don't delete `SpinResult`/`SpinCampaign` rows that coupons or orders
still reference (`SpinCampaign` is `onDelete: Restrict`).
