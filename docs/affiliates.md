# Affiliate / Influencer Program

> Part of the [Nutriyet docs](../CLAUDE.md#documentation-index). Gated by the
> **`affiliates`** RBAC permission; everything degrades to nothing when
> `StoreSetting.affiliateEnabled = false`.

A full referral-marketing program (Amazon-Associates / influencer style) layered
additively on orders.

## Models (`prisma/schema.prisma`)

- `Affiliate` (one per `User`, `@unique`; `code`, optional linked `Coupon`, role/status,
  per-affiliate commission override, payout details — UPI/bank), `AffiliateClick`
  (referral click log, anon/user, device/ipHash), `CommissionRule`
  (PRODUCT/CATEGORY/ROLE-scoped rate overrides, unique per scope tuple), `Commission`
  (one per order `@unique`, base/amount, lifecycle status, `matureAt`, `payoutId`, `meta`
  JSON audit of per-line math), `Payout` (`PAY-…` number, batches APPROVED commissions,
  method/reference), `MarketingAsset` (marketing kit — banners/logos/captions).
- Enums: `AffiliateRole` (INFLUENCER/AFFILIATE/BRAND_AMBASSADOR/NUTRITIONIST/GYM_PARTNER/
  BLOGGER/YOUTUBE_CREATOR/INSTAGRAM_CREATOR), `AffiliateStatus`, `CommissionType`
  (PERCENT/FIXED), `CommissionStatus` (PENDING→APPROVED→PAID / CANCELLED),
  `CommissionScope`, `PayoutStatus`, `PayoutMethod`, `MarketingAssetType`.
- Settings on `StoreSetting`: `affiliateEnabled`, `affiliateCookieDays` (default 30),
  `affiliateDefaultCommissionType/Value` (PERCENT 10%), `affiliateMinPayout` (₹500).

## Attribution

`lib/affiliate/attribution.ts` + `middleware.ts`: a `?ref=<code>` visit sets the edge
`nut_ref` last-click cookie (lowercased) **plus `nut_ref_at` (click epoch ms)** —
contract in the edge-safe `lib/affiliate/ref-cookie.ts`. Cookie-only in middleware; the
click row is logged by the `/ref/[code]` route (same-site `?to=` only — no open
redirect) + the `AffiliateTracker` client beacon → `/api/affiliate/click`, deduped per
visitor (anon id, or hashed IP for cookieless hits) per 24h.
The browser keeps the cookies 365 days (the setting's max); the **real window
`affiliateCookieDays` is enforced at checkout** against `nut_ref_at`, so the admin
setting takes effect immediately (pre-timestamp cookies are accepted — they were
browser-capped at 30 days). At checkout (`createOrder`) `resolveAttribution` picks the
**coupon's affiliate first, else the in-window cookie referral** (APPROVED affiliates
only), excludes self-referrals, and snapshots `Order.affiliateId`/`referralCode`.

## Commission engine (`lib/affiliate/commissions.ts`)

- `createOrderCommission` (called from `lib/orders.ts#confirmOrder`, idempotent via
  `orderId @unique`; skipped if the affiliate is no longer APPROVED at confirm time)
  computes **per line** = rate × post-discount line value (PERCENT, capped at 100%) or
  value × qty (FIXED, capped at the line value), **excluding shipping/COD fee**. Item
  prices are GST-inclusive, so the base includes GST (nothing is added on top). A
  line-allocated discount (`OrderItem.discount`, Spin & Win) stays on its line; an
  order-level coupon is spread pro rata. `meta` freezes the per-line math incl.
  `orderItemId`. Rate precedence: **PRODUCT rule → CATEGORY rule → affiliate override →
  ROLE rule → store default**.
- **Refunds:** `processRefund` (returns) calls `syncCommissionWithRefunds` — each
  refunded unit comes off at its line's frozen per-unit commission (recomputed from
  `meta`, idempotent across partial refunds); a whole-order refund voids it. PAID
  commissions are never clawed back automatically.
- **Approval is automatic:** created **PENDING**; `setCommissionMature` (at DELIVERED)
  stamps `matureAt = delivered + returnWindowDays`; `matureCommissions()` flips due
  PENDING→APPROVED (payable) — **held while the order has a return in progress**, and
  status-guarded per row so a concurrent cancel is never undone — invoked lazily on the affiliate dashboard + payout request
  + an admin "Run maturation" button (no cron needed); `voidCommission` (at cancel/refund)
  → CANCELLED and released from any open payout (whose amount is re-derived by
  `syncPayoutAmount`). Every transition notifies in-app + emails.
- Admin **Commissions** page (`/admin/affiliates/commissions`) is for *visibility + edge
  cases*: status-filtered list with totals (incl. a *Refunded after payout* review filter), manual `approveCommission` (force-mature
  early) and `cancelCommission` (fraud/adjustment — releases from any open payout).

## Commission base & policy (current behaviour — changes need owner approval)

| Item | Treatment today |
| --- | --- |
| Item price | Counted. Prices are **GST-inclusive**, so the base **includes GST** (none is added on top or stripped out). |
| Coupon / order discount | **Excluded** — order-level coupons are spread pro rata over lines; Spin & Win line discounts stay on their line. |
| Shipping, COD fee | **Excluded.** |
| Rate | PERCENT of the line's post-discount value (capped at 100%), or FIXED per unit (capped at the line value). Rounded to the paisa per line. |
| Unpaid / failed / abandoned checkout | **No commission** — created only when the order is confirmed (`confirmOrder`). |
| Cancellation before payout | Commission **CANCELLED**, released from any open payout. |
| Partial refund before payout | Reduced by the refunded units at their frozen per-unit commission (`syncCommissionWithRefunds`). Full refund → CANCELLED. |
| Return still open | Maturation **held** until the return is resolved. |
| Refund **after** payout (commission PAID) | **Nothing deducted, no negative balance.** The commission stays PAID and is listed under *Refunded after payout* on `/admin/affiliates/commissions` (+ a review flag on the affiliate's page) for a manual decision. `REFUNDED_AFTER_PAYOUT` in `lib/queries/affiliate.ts`. |
| Self-referral | Never credited (own link or own coupon). |
| Suspended affiliate | Keeps PENDING/APPROVED commission (it still matures; shown on their suspended page). **Earns nothing new** (attribution + confirm-time check), coupon deactivated, **can't request payouts**. An open payout is **on hold**: approve / mark-paid are refused unless the admin gives an explicit override reason (recorded); reject needs none. Reactivation lifts the hold but never auto-approves, duplicates or re-releases the payout — it still goes through approve → mark paid once. |
| Minimum payout | `StoreSetting.affiliateMinPayout` (paise), editable in rupees at `/admin/affiliates/settings` — currently **₹30** in production. |

## Payouts

Affiliate `requestPayout` (≥ `affiliateMinPayout`, valid payout details required — UPI
ID / account + IFSC validated per method) claims the APPROVED unassigned commissions
and sizes the `Payout` (REQUESTED) from what it actually claimed, in one transaction —
a concurrent second request claims nothing and rolls back. State machine at
`/admin/affiliates/payouts`: **REQUESTED → (approve) APPROVED → (mark paid) PAID**, or
→ REJECTED from any open state (releases commissions). **Mark paid only from
APPROVED/PROCESSING, requires the transfer reference (UTR / UPI txn id)** and an
explicit "money was sent" confirmation in the UI; it re-derives the amount from the
payout's still-APPROVED commissions and flips only those to PAID, once. There is no
automated payout rail — the admin transfers money outside the app and records it.
Every transition sends in-app notification + email. History shows on both dashboards.

**Audit trail** (`lib/affiliate/payout-audit.ts`, no schema change): every request, approve,
reject, mark-paid, suspension hold / reactivation and override appends a timestamped,
attributed line (`[YYYY-MM-DD HH:MM UTC · admin email] …`) to `Payout.notes`, shown as
"History" on the admin payouts page. Affiliates never see raw notes — only the rejection
reason via `payoutRejectionReason`.

## Surfaces

- **Public landing** `/affiliate` (storefront group): marketing page with the live default
  commission rate, how-it-works, FAQ, smart CTA → `/account/affiliate` (login-aware).
  Footer link + sitemap; "applications paused" when disabled.
- **Affiliate-facing** `/account/affiliate` (`lib/actions/affiliate.ts`): apply form
  (role + pitch) with the live program terms (`getEarningTerms`), dashboard (earnings:
  pending / ready / in payout / paid; activity: clicks, visitors, referred orders,
  customers, referred sales, conversion; per-order commission state in plain language,
  monthly series, referral link + QR via `/api/affiliate/qr`, coupon, marketing kit),
  payout-details form, request-payout (confirm dialog). **All order/sales counts derive
  from non-cancelled Commission rows** — an order stamped with an affiliate at checkout
  but never confirmed (abandoned/failed payment) never counts. Sidebar entry in `account-sidebar.tsx`.
- **Admin** (`/admin/affiliates`, `lib/actions/admin/affiliates.ts`,
  `lib/queries/affiliate.ts`): list/detail (status-guarded: approve PENDING/REJECTED
  (reactivates an existing coupon), reject PENDING, suspend APPROVED, reactivate
  SUSPENDED; detail shows payouts + heuristic **review flags** — shared payout details,
  buyer concentration, cancel rate, clicks-per-network — never auto-enforced; per-
  affiliate commission, **delete** — `deleteAffiliate`, only for inactive SUSPENDED/
  REJECTED/PENDING affiliates, blocked while a payout is in progress; cascades clicks/
  commissions/payouts, SET NULLs referred orders, deletes-if-unused-else-deactivates the
  coupon, leaves the User intact), `commissions`, `rules`, `payouts` (+ run-maturation),
  `settings`, `marketing-kit` (`MarketingAsset` CRUD; **uploads go browser → Cloudinary
  directly** — `/api/admin/affiliate-asset` only issues a signature pinned to
  `nutriyet/marketing` + `allowed_formats`, never receives bytes; rules (types, 25 MB) in
  `lib/affiliate/marketing-upload-rules.ts`; `verifyMarketingUpload` re-checks the stored
  bytes/format via the Admin API and deletes rejects, on upload and again on save; pasted
  URLs still work), `analytics`, CSV `export`.

## Conventions

Reuses `AdminResult` actions, Zod (`lib/validations/affiliate.ts`),
`requirePermission("affiliates")`/`guardSection`, Cloudinary + `cldUrl`, in-app
notifications. Display labels are client-safe in `lib/affiliate/labels.ts` (type-only
Prisma imports). Renders nothing when disabled or empty.
