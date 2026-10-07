import { customAlphabet } from "nanoid";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { effectivePrice, formatPrice } from "@/lib/format";
import { refundPayment } from "@/lib/razorpay";
import { orderConfirmationEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/email";
import { ensureInvoice, getInvoiceData } from "@/lib/invoices";
import { isClosed } from "@/lib/order-status";
import { trackEvent } from "@/lib/recommendations/events";
import {
  createOrderCommission,
  setCommissionMature,
  voidCommission,
} from "@/lib/affiliate/commissions";
import type { CheckoutItem } from "@/lib/validations/checkout";
import { withDbRetry } from "@/lib/db-retry";

export {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  shippingFor,
} from "@/lib/shipping";

const orderId = customAlphabet("ACDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

/**
 * Thrown inside confirmOrder's transaction when the order can't actually be
 * fulfilled (stock ran out, or a limited coupon was exhausted, between
 * checkout-time validation and confirmation). Throwing inside the transaction
 * rolls back every write the transaction made so far — the atomic
 * `stockDeducted` claim, any partial stock decrements, and the coupon
 * increment — so the order is left exactly as it was before confirmOrder was
 * called, never in a half-confirmed state.
 */
export class OrderFulfillmentError extends Error {
  constructor(
    public readonly reason: "INSUFFICIENT_STOCK" | "COUPON_LIMIT_REACHED",
    message: string,
  ) {
    super(message);
    this.name = "OrderFulfillmentError";
  }
}

/** Human-friendly, unique-enough order number, e.g. NUT-260625-A1B2C3. */
export function generateOrderNumber(): string {
  const d = new Date();
  const stamp = `${d.getFullYear().toString().slice(2)}${String(
    d.getMonth() + 1,
  ).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `NUT-${stamp}-${orderId()}`;
}

export type PricedLine = {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  image: string | null;
  unitPrice: number; // paise (effective price)
  quantity: number;
  lineTotal: number; // paise
  gstRate: number | null; // product GST override; null = store default
  deliveryCharge: number | null; // paise product override; null = store default
};

export type PricedCart =
  | { ok: true; lines: PricedLine[]; subtotal: number }
  | { ok: false; error: string };

/**
 * Re-price the cart from the database. The client is never trusted for prices
 * or stock — only for variant ids + quantities. Validates availability.
 */
export async function priceCart(input: CheckoutItem[]): Promise<PricedCart> {
  if (input.length === 0) return { ok: false, error: "Your cart is empty." };

  // Merge repeated variants: checked line-by-line, two lines of 3 against a
  // stock of 5 would each pass here and only fail at confirm — after a
  // Razorpay payment has already been captured.
  const merged = new Map<string, number>();
  for (const i of input) merged.set(i.variantId, (merged.get(i.variantId) ?? 0) + i.quantity);
  const items = [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));

  // This is often the first DB touch of a checkout — one retry here covers
  // a cold Neon connection before the rest of the checkout flow runs.
  const variants = await withDbRetry(() =>
    prisma.productVariant.findMany({
      where: { id: { in: items.map((i) => i.variantId) } },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            isActive: true,
            gstRate: true,
            deliveryCharge: true,
            images: {
              where: { isMain: true },
              take: 1,
              select: { url: true },
            },
          },
        },
      },
    }),
  );

  const byId = new Map(variants.map((v) => [v.id, v]));
  const lines: PricedLine[] = [];

  for (const item of items) {
    const v = byId.get(item.variantId);
    if (!v || !v.isActive || !v.product.isActive) {
      return { ok: false, error: "An item in your cart is no longer available." };
    }
    if (v.stock < item.quantity) {
      return {
        ok: false,
        error: `Only ${v.stock} left of ${v.product.name} (${v.weightLabel}).`,
      };
    }
    const unitPrice = effectivePrice(v.price, v.discountPrice);
    lines.push({
      variantId: v.id,
      productId: v.product.id,
      productName: v.product.name,
      variantLabel: v.weightLabel,
      image: v.product.images[0]?.url ?? null,
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
      gstRate: v.product.gstRate,
      deliveryCharge: v.product.deliveryCharge,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  return { ok: true, lines, subtotal };
}

/**
 * Confirm a placed order: decrement stock, mark the coupon used, set the payment
 * status, record the "Order placed" timeline event, then (best-effort) generate
 * the invoice and email the customer with the PDF.
 *
 * The fulfilment `status` is intentionally left at PENDING — the order awaits
 * admin approval and stays customer-cancellable until then (Amazon/Flipkart-style).
 *
 * Used by both flows: online (`paymentStatus: "PAID"`) and COD
 * (`paymentStatus: "PENDING"`, collected at delivery). Idempotent via the
 * `stockDeducted` flag — the correct signal since COD confirms while still
 * PENDING, so a payment-status guard would double-decrement.
 */
export async function confirmOrder(
  id: string,
  opts: {
    paymentStatus: "PAID" | "PENDING";
    payment?: { paymentId: string; signature?: string };
  },
): Promise<void> {
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id },
        select: { id: true, couponId: true },
      });
      if (!existing) throw new Error("ORDER_NOT_FOUND");

      // Claim the confirmation ATOMICALLY before doing any of the side-effects.
      // The success page and the Razorpay webhook race by design; a read-then-write
      // check on `stockDeducted` passes in both under Read Committed, which would
      // double-decrement stock and double-count the coupon. A conditional update
      // makes the loser block on the row lock, re-evaluate, and match 0 rows.
      const claim = await tx.order.updateMany({
        where: { id, stockDeducted: false },
        data: {
          stockDeducted: true,
          paymentStatus: opts.paymentStatus,
          razorpayPaymentId: opts.payment?.paymentId,
          razorpaySignature: opts.payment?.signature,
        },
      });
      if (claim.count === 0) return null; // already confirmed by the other caller

      const items = await tx.orderItem.findMany({ where: { orderId: id } });

      // Decrement stock for each line (guarded against going negative). The
      // guard's `count` must be checked — a 0-row update means the guard
      // rejected it (stock insufficient), and that must abort the whole
      // confirmation rather than silently leaving the order "confirmed" with
      // less stock reserved than it was sold.
      for (const line of items) {
        if (!line.variantId) continue;
        const decremented = await tx.productVariant.updateMany({
          where: { id: line.variantId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (decremented.count === 0) {
          throw new OrderFulfillmentError(
            "INSUFFICIENT_STOCK",
            "One or more items in this order are no longer available in the quantity requested.",
          );
        }
      }

      if (existing.couponId) {
        const coupon = await tx.coupon.findUnique({
          where: { id: existing.couponId },
          select: { usageLimit: true },
        });
        if (coupon?.usageLimit != null) {
          // Same pattern as the stock guard above: re-check the limit against
          // the row's CURRENT value at write time (not the value `validateCoupon`
          // saw at preview time), so two orders racing for the last slot can't
          // both succeed.
          const claimed = await tx.coupon.updateMany({
            where: { id: existing.couponId, usedCount: { lt: coupon.usageLimit } },
            data: { usedCount: { increment: 1 } },
          });
          if (claimed.count === 0) {
            throw new OrderFulfillmentError(
              "COUPON_LIMIT_REACHED",
              "The coupon on this order just reached its usage limit.",
            );
          }
        } else {
          await tx.coupon.update({
            where: { id: existing.couponId },
            data: { usedCount: { increment: 1 } },
          });
        }
      }

      const updated = await tx.order.findUniqueOrThrow({
        where: { id },
        include: { items: true, user: { select: { email: true, name: true } } },
      });

      // Seed the timeline with the placement event.
      await tx.orderEvent.create({
        data: { orderId: id, status: "PENDING", note: "Order placed", actor: "system" },
      });

      return updated;
    });
  } catch (err) {
    if (err instanceof OrderFulfillmentError) {
      // The transaction above has already rolled back in full — the
      // `stockDeducted` claim, any stock decrements, and the coupon increment
      // never committed. The order is exactly as it was before this call.
      await recordFulfillmentFailure(id, err, opts.payment);
    }
    throw err;
  }

  if (!order) return;

  // Best-effort: ensure the invoice exists, then email the customer with the PDF
  // attached. Never block order completion on invoice/email failures.
  try {
    const invoice = await ensureInvoice(order.id);
    if (order.user?.email) {
      const mail = orderConfirmationEmail({ ...order, invoiceNumber: invoice.invoiceNumber });
      let attachments: { filename: string; content: Buffer }[] | undefined;
      try {
        const data = await getInvoiceData(order.id);
        if (data) {
          const { renderInvoiceBuffer } = await import("@/lib/pdf/invoice-pdf");
          attachments = [
            { filename: `${invoice.invoiceNumber}.pdf`, content: await renderInvoiceBuffer(data) },
          ];
        }
      } catch (e) {
        console.error("[orders] invoice PDF render failed:", e);
      }
      await sendEmail({
        to: order.user.email,
        ...mail,
        ...(attachments ? { attachments } : {}),
      });
    }
  } catch (err) {
    console.error("[orders] post-confirm (invoice/email) failed:", err);
  }

  // Record purchase signals for the recommendation service (best-effort).
  for (const item of order.items) {
    if (item.productId) {
      await trackEvent({ type: "PURCHASE", userId: order.userId, productId: item.productId });
    }
  }

  // Create the affiliate commission (PENDING) if this order was referred. Idempotent
  // and best-effort — never blocks order completion.
  await createOrderCommission(order.id);
}

/**
 * Called after confirmOrder's transaction rolls back due to an
 * OrderFulfillmentError. Two distinct, deliberately conservative outcomes —
 * never a refund, never a new order, never leaving the order looking
 * "confirmed" when it isn't:
 *
 * - No real payment was captured (COD, or the keyless mock flow): safe to
 *   cancel the order outright. Nothing was charged.
 * - A Razorpay payment WAS already captured (`opts.payment` present, from
 *   verifyPayment or the webhook): never auto-cancel or auto-refund here —
 *   that risks a mismatched Razorpay/ledger state if this runs twice (e.g. a
 *   webhook retry). Preserve the payment reference on the order and leave its
 *   status/paymentStatus untouched so it's easy to find and resolve manually
 *   (stock was never decremented for it, so a later retry can still succeed
 *   on its own if stock is replenished). Full detail goes to the server log,
 *   not to the order record — this note is visible to the customer on their
 *   order timeline.
 */
async function recordFulfillmentFailure(
  orderId: string,
  err: OrderFulfillmentError,
  payment?: { paymentId: string; signature?: string },
): Promise<void> {
  if (payment) {
    // verifyPayment and every webhook retry land here for the same payment —
    // record (and show the customer) the manual-review note only once.
    const already = await prisma.order.findFirst({
      where: { id: orderId, razorpayPaymentId: payment.paymentId },
      select: { id: true },
    });
    if (already) return;
    console.error(
      `[orders] order ${orderId} received a captured payment (${payment.paymentId}) but could not be ` +
        `auto-confirmed (${err.reason}): ${err.message}. Needs manual review — stock/coupon were NOT ` +
        `deducted, no refund was issued.`,
    );
    await prisma.order.update({
      where: { id: orderId },
      data: {
        razorpayPaymentId: payment.paymentId,
        razorpaySignature: payment.signature,
      },
    });
    await prisma.orderEvent.create({
      data: {
        orderId,
        status: "PENDING",
        note: "We're finalising the details of your order. If anything needs your attention, our team will contact you shortly.",
        actor: "system",
      },
    });
    return;
  }

  console.error(`[orders] order ${orderId} could not be confirmed (${err.reason}): ${err.message}`);
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "CANCELLED", paymentStatus: "FAILED", cancelReason: err.message },
  });
  await prisma.orderEvent.create({
    data: { orderId, status: "CANCELLED", note: err.message, actor: "system" },
  });
}

/** Transition an order to PAID (online payment). Thin wrapper over confirmOrder. */
export async function markOrderPaid(
  id: string,
  payment?: { paymentId: string; signature?: string },
): Promise<void> {
  return confirmOrder(id, { paymentStatus: "PAID", payment });
}

/**
 * Full refund (minus anything already refunded through returns) of a captured
 * Razorpay payment when a PAID order is closed. Exactly-once: the PAID→REFUNDED
 * flip is claimed atomically before any money moves, so a concurrent close
 * (admin + customer, double submit) sees a non-PAID order and skips. If Razorpay
 * rejects the refund the claim is reverted to PAID — never label an order
 * refunded when no money moved — and the order is flagged for a manual refund.
 */
async function refundOnClose(order: {
  id: string;
  orderNumber: string;
  total: number;
  razorpayPaymentId: string | null;
}): Promise<{ ok: boolean; note: string | null } | null> {
  const claim = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: "PAID" },
    data: { paymentStatus: "REFUNDED" },
  });
  if (claim.count === 0) return null; // another close already handled the payment

  const prior = await prisma.returnRequest.aggregate({
    where: { orderId: order.id, refundStatus: "COMPLETED" },
    _sum: { refundedAmount: true },
  });
  const amount = order.total - (prior._sum.refundedAmount ?? 0);
  if (amount <= 0) return { ok: true, note: null }; // fully refunded via returns already

  if (!order.razorpayPaymentId) {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID" } });
    console.error(`[orders] ${order.orderNumber} closed while PAID but has no payment id — refund manually`);
    return { ok: false, note: "Refund pending — our team will process it and confirm by email." };
  }

  try {
    const r = await refundPayment(order.razorpayPaymentId, amount);
    return {
      ok: true,
      note: `Refund of ${formatPrice(amount)} issued to your original payment method (ref ${r.id}). It usually reflects in 5–7 working days.`,
    };
  } catch (err) {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID" } });
    console.error(`[orders] auto-refund failed for ${order.orderNumber} — refund manually:`, err);
    return { ok: false, note: "Refund pending — our team will process it and confirm by email." };
  }
}

export type TransitionedOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  cancelReason: string | null;
  user: { email: string | null; name: string | null };
};

/**
 * Move an order to a new fulfilment status with the right side-effects — the
 * single source of truth shared by the admin status picker and customer cancel.
 *
 * - Restocks inventory when entering a closed state (CANCELLED/RETURNED/REFUNDED)
 *   from an open one, keyed off `stockDeducted` (so COD orders restock correctly),
 *   and clears the flag so it can't double-restock.
 * - Derives `paymentStatus`: a paid order that's cancelled/returned → REFUNDED;
 *   a COD order delivered → PAID (cash collected). Otherwise unchanged.
 * - Appends an OrderEvent (timeline) and stores the cancellation reason.
 *
 * Returns the updated order for the caller to send a notification, or null if
 * the status was unchanged. Authorization/allowed-transition checks live in the
 * callers (admin vs customer).
 */
export async function transitionOrderStatus(
  orderId: string,
  status: OrderStatus,
  opts: { reason?: string | null; actor: "customer" | "admin" | "system" },
): Promise<TransitionedOrder | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.status === status) return null; // no-op

  const closing = isClosed(status);
  const reason = opts.reason?.trim() || null;

  // Closing a prepaid order must actually return the money, not just relabel
  // it — the cancellation email tells the customer a refund was initiated.
  const prepaidClose =
    closing && order.paymentStatus === "PAID" && order.paymentMethod === "RAZORPAY";
  const refund = prepaidClose ? await refundOnClose(order) : null;

  // undefined = leave the column alone (a concurrent close owns the payment).
  let paymentStatus: PaymentStatus | undefined = order.paymentStatus;
  if (prepaidClose) {
    paymentStatus = refund ? (refund.ok ? "REFUNDED" : "PAID") : undefined;
  } else if (closing) {
    // COD (cash refunds are handled manually / via the returns flow).
    if (order.paymentStatus === "PAID") paymentStatus = "REFUNDED";
  } else if (
    status === "DELIVERED" &&
    order.paymentMethod === "COD" &&
    order.paymentStatus === "PENDING"
  ) {
    paymentStatus = "PAID";
  }

  const wantsRestock = closing && !isClosed(order.status) && order.stockDeducted;

  const updated = await prisma.$transaction(async (tx) => {
    // Same race as confirmOrder in reverse: two concurrent closes (admin click
    // + customer cancel, or a double submit) would both see stockDeducted=true
    // and restock twice. Claim the flag conditionally and only restock if THIS
    // transaction is the one that flipped it.
    let restock = false;
    if (wantsRestock) {
      const claim = await tx.order.updateMany({
        where: { id: orderId, stockDeducted: true },
        data: { stockDeducted: false },
      });
      restock = claim.count > 0;
    }
    if (restock) {
      for (const item of order.items) {
        if (!item.variantId) continue;
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
    const o = await tx.order.update({
      where: { id: orderId },
      data: {
        status,
        paymentStatus,
        ...(status === "CANCELLED" ? { cancelReason: reason } : {}),
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        cancelReason: true,
        user: { select: { email: true, name: true } },
      },
    });
    await tx.orderEvent.create({
      data: { orderId, status, note: reason, actor: opts.actor },
    });
    if (refund?.note) {
      await tx.orderEvent.create({
        data: { orderId, status, note: refund.note, actor: "system" },
      });
    }
    return o;
  });

  // Affiliate commission lifecycle (best-effort, after the tx): set maturity on
  // delivery, void on cancellation/return/refund.
  if (status === "DELIVERED") {
    await setCommissionMature(orderId, new Date());
  } else if (closing) {
    await voidCommission(orderId);
  }

  return updated;
}
