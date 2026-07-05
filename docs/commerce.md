# Commerce — Pricing, Orders, COD, Invoices, Returns

> Part of the [Nutriyet docs](../CLAUDE.md#documentation-index).

## Pricing & tax engine (`lib/pricing.ts`, client-safe, single source of truth)

- **GST is inclusive** — a product's listed price already contains GST at its rate; the
  tax line is the component *extracted* from the price and the payable total is unchanged
  (Razorpay amount unaffected).
- **Shipping = the highest per-product delivery charge** in the cart (one shipment),
  free once the subtotal reaches the threshold. Rule: **product override wins → else
  default; highest across the cart (never summed); free when enabled & subtotal ≥ threshold.**
- `computeBreakdown(lines, settings, discount)` returns `{ subtotal, discount, tax,
  shipping, total }` (+ optional COD fee 4th term, + `shippingSaved`) and is used by the
  cart, checkout, product page **and** server-side order pricing so they always agree.
- Per-product overrides: `Product.gstRate` / `Product.deliveryCharge` (null = store default).
  GST default + seller `gstin`: `/admin/appearance` → Tax (GST). **All shipping settings
  live at `/admin/shipping`** (`appearance` permission): `defaultShippingFee`,
  `freeShippingThreshold`, `freeShippingEnabled`, `localDeliveryFee`/`expressDeliveryFee`/
  `codFee`. Keyless defaults in `lib/shipping.ts` (free ≥ ₹499, else flat ₹49).
- Breakdown shows on PDP, cart, checkout, order summary, track, confirmation email and the
  printable tax invoice, with **"Free Delivery" + "You saved ₹XX on shipping"**
  (`shippingSaved`, persisted on `Order.shippingSaved`).

## Server-authoritative checkout

- **Cart is client-side** (Zustand + localStorage) and only an optimistic placeholder;
  `previewOrderPricing` (`lib/actions/checkout.ts`) re-prices from the DB (`priceCart` +
  `computeBreakdown`) and the client renders that result — admin delivery/GST values always
  win. `createOrder` uses the same engine so the displayed total always equals what's charged.
- Never trust the client for prices, stock, totals or roles (see `lib/orders.ts#priceCart`).
- Coupon validation + discount math: `lib/coupons.ts`.
- **Order numbers:** `NUT-YYMMDD-XXXXXX` (nanoid, unambiguous alphabet).

## Stock & order confirmation

- Stock is decremented when an order is **confirmed** — at the PAID transition for online,
  at order placement for COD (payment still PENDING). The **`Order.stockDeducted` flag**
  (not `paymentStatus`) is the single signal for both **confirm-idempotency**
  (`confirmOrder` no-ops once set) and **restock-on-cancel** (cancel/return/refund restocks
  once when `stockDeducted`, then clears it). `markOrderPaid` is a thin wrapper over
  `confirmOrder(id, { paymentStatus: "PAID", payment })`.

## Order workflow & cancellation (Amazon/Flipkart-style)

- Fulfilment stages (`OrderStatus`): PENDING → APPROVED → PROCESSING → PACKED → SHIPPED →
  OUT_FOR_DELIVERY → DELIVERED, plus CANCELLED and RETURNED; PAID/REFUNDED retained for
  legacy. `confirmOrder` **leaves a placed order at PENDING** (awaits admin approval,
  stays customer-cancellable).
- **Single source of truth:** `lib/order-status.ts` (flow, labels, badge variants,
  `isCustomerCancellable` = PENDING, `ADMIN_STATUS_OPTIONS`, `CLOSED_STATUSES`) +
  `lib/orders.ts#transitionOrderStatus` (restock by `stockDeducted`, paymentStatus
  derivation, appends an `OrderEvent`, stores `Order.cancelReason`). Admin
  `updateOrderStatus` and customer `cancelOrder` (PENDING-only, owner-scoped) both delegate.
- **Timeline** = append-only `OrderEvent` table (status + note + actor + timestamp),
  rendered by `components/storefront/order-timeline.tsx` on customer and admin order pages.
  Customer cancel button shows only while cancellable.
- Status emails (`orderStatusEmail`): APPROVED / SHIPPED / OUT_FOR_DELIVERY / DELIVERED /
  CANCELLED (with reason) / RETURNED.

## Cash on Delivery

- `Order.paymentMethod` (`RAZORPAY`/`COD`) + `Order.codFee`. Configured at `/admin/shipping`
  (`StoreSetting.codEnabled/codFee/codMinOrder/codMaxOrder`; `codPincodes` reserved for a
  future allowlist).
- Availability (`isCodAvailable`) and the fee are **recomputed server-side** in
  `previewOrderPricing`/`createOrder` — never trusted from the client; COD-but-unavailable
  is rejected. COD orders skip Razorpay, are placed via
  `confirmOrder(..., { paymentStatus: "PENDING" })`, and flip to PAID when the admin marks
  them DELIVERED. Online totals / Razorpay `amount` are unchanged by COD config.

## Payments (Razorpay)

- Verify payment + webhook signatures with HMAC and constant-time comparison
  (`lib/razorpay.ts`); webhook verifies over the **raw** body and is **idempotent**
  (order confirmation is a no-op once `stockDeducted`). Keyless mock flow exists for dev.

## Invoices

- One persistent `Invoice` per order (`ensureInvoice`, idempotent; created at confirmation,
  lazily on first view for legacy orders). Number `INV-<FY>-<seq>` (Indian Apr–Mar FY +
  DB `autoincrement seq`; concurrent create guarded by `orderId @unique` + P2002). Seller
  details snapshotted on the invoice row.
- **PDF** rendered on demand from the immutable order+invoice snapshot via
  `@react-pdf/renderer` (`lib/pdf/invoice-pdf.tsx`) at `GET /api/invoices/[orderNumber]`
  (owner or `orders`-permitted admin; `?download=1` → attachment); attached best-effort to
  the confirmation email. Route is `runtime = "nodejs"`; `next.config.ts` lists
  `@react-pdf/renderer` in `serverExternalPackages`. Money in PDFs is ASCII (`Rs. …`)
  since Helvetica lacks ₹.

## Returns & refunds (separate lifecycle layered on orders)

- A delivered order stays `DELIVERED` while the return progresses through its own status.
- **Models:** `ReturnRequest` (RMA-YYMMDD-XXXXXX, `media[]` proof, `refundAmount`/
  `refundedAmount`, `refundMethod`/`refundStatus`/`refundRef`, pickup + `adminNotes` +
  `rejectionReason`), `ReturnRequestItem` (per-item qty → **partial refunds**),
  `ReturnEvent` (append-only audit log), `CreditNote` (mirrors Invoice: `CN-<FY>-<seq>`,
  idempotent `ensureCreditNote`), `Notification` (in-app bell).
- **Engine:** `lib/return-status.ts` (`RETURN_FLOW`, labels, `isReturnTerminal`,
  `canCustomerCancelReturn`) + `lib/returns.ts` (`getReturnEligibility`,
  `transitionReturnStatus`, `processRefund`).
- **Eligibility:** `StoreSetting.returnsEnabled`/`returnWindowDays` (default 7, edited at
  `/admin/shipping`) gated by per-product `Product.returnable`/`returnWindowDays` **and**
  per-category `Category.returnable`; only `DELIVERED`, in-window, not-already-returned
  items (window computed from the latest DELIVERED OrderEvent).
- **Refund payments:** prepaid+`ORIGINAL` → `lib/razorpay.ts#refundPayment`
  (`payments.refund`, keyless mock id); COD/manual → admin records `RefundMethod`
  (UPI/Bank/…) + reference. `processRefund` restocks returned qty (once, guarded by
  `stockDeducted`); a full-order return closes the order `RETURNED` + `paymentStatus
  REFUNDED`; partial leaves the order open.
- Every transition emails (`returnStatusEmail`) **and** notifies in-app
  (`lib/notifications.ts#notify`).
- **Customer:** `lib/actions/returns.ts` (request/cancel/submit-info), proof upload at
  `POST /api/returns/upload` (signed-in, images+video, `nutriyet/returns`), UI at
  `/account/returns(/[returnNumber])` + request button on the order page. Notification bell
  (`components/account/notification-bell.tsx`) mounts in the storefront header.
- **Admin** (`returns` permission): `lib/actions/admin/returns.ts` (review/approve/reject/
  request-info/schedule-pickup/add-note/process-refund), `/admin/returns` list (filters +
  CSV at `/admin/returns/export`) + detail (proof gallery, audit log, notes).
- **Credit-note PDF** (`lib/pdf/credit-note-pdf.tsx`) at
  `GET /api/credit-notes/[returnNumber]` (owner or `returns` admin).
- All sections render nothing / hide when empty or `returnsEnabled=false`.
