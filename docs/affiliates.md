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
`nut_ref` last-click cookie (cookie-only in middleware; click row logged by
`/ref/[code]` route + the `AffiliateTracker` client beacon → `/api/affiliate/click`).
At checkout (`createOrder`) `resolveAttribution` picks the **coupon's affiliate first,
else the cookie referral**, excludes self-referrals, and snapshots
`Order.affiliateId`/`referralCode`.

## Commission engine (`lib/affiliate/commissions.ts`)

- `createOrderCommission` (called from `lib/orders.ts#confirmOrder`, idempotent via
  `orderId @unique`) computes **per line** = rate × post-discount line value (PERCENT) or
  value × qty (FIXED), **excluding tax & shipping**. Rate precedence: **PRODUCT rule →
  CATEGORY rule → affiliate override → ROLE rule → store default**.
- **Approval is automatic:** created **PENDING**; `setCommissionMature` (at DELIVERED)
  stamps `matureAt = delivered + returnWindowDays`; `matureCommissions()` flips due
  PENDING→APPROVED (payable) — invoked lazily on the affiliate dashboard + payout request
  + an admin "Run maturation" button (no cron needed); `voidCommission` (at cancel/refund)
  → CANCELLED. Every transition notifies in-app + emails.
- Admin **Commissions** page (`/admin/affiliates/commissions`) is for *visibility + edge
  cases*: status-filtered list with totals, manual `approveCommission` (force-mature
  early) and `cancelCommission` (fraud/adjustment — releases from any open payout).

## Payouts

Affiliate `requestPayout` (≥ `affiliateMinPayout`) batches APPROVED commissions into a
`Payout` (REQUESTED). Admin **approves / rejects (with reason) / marks paid (method +
reference)** at `/admin/affiliates/payouts`. Reject releases the commissions back to the
pool. Every transition sends in-app notification + email (`payoutUpdateEmail`/
`payoutEmail`). History shows on both dashboards.

## Surfaces

- **Public landing** `/affiliate` (storefront group): marketing page with the live default
  commission rate, how-it-works, FAQ, smart CTA → `/account/affiliate` (login-aware).
  Footer link + sitemap; "applications paused" when disabled.
- **Affiliate-facing** `/account/affiliate` (`lib/actions/affiliate.ts`): apply form
  (role + pitch), dashboard (clicks/visitors/orders/revenue/conversion, balances, monthly
  series, referral link + QR via `/api/affiliate/qr`, coupon, marketing kit),
  payout-details form, request-payout. Sidebar entry in `account-sidebar.tsx`.
- **Admin** (`/admin/affiliates`, `lib/actions/admin/affiliates.ts`,
  `lib/queries/affiliate.ts`): list/detail (approve/reject/suspend/reactivate, per-
  affiliate commission, **delete** — `deleteAffiliate`, only for inactive SUSPENDED/
  REJECTED/PENDING affiliates, blocked while a payout is in progress; cascades clicks/
  commissions/payouts, SET NULLs referred orders, deletes-if-unused-else-deactivates the
  coupon, leaves the User intact), `commissions`, `rules`, `payouts` (+ run-maturation),
  `settings`, `marketing-kit` (`MarketingAsset` CRUD, upload via
  `/api/admin/affiliate-asset`), `analytics`, CSV `export`.

## Conventions

Reuses `AdminResult` actions, Zod (`lib/validations/affiliate.ts`),
`requirePermission("affiliates")`/`guardSection`, Cloudinary + `cldUrl`, in-app
notifications. Display labels are client-safe in `lib/affiliate/labels.ts` (type-only
Prisma imports). Renders nothing when disabled or empty.
