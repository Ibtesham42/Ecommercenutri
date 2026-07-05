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
