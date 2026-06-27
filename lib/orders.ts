import { customAlphabet } from "nanoid";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { effectivePrice } from "@/lib/format";
import { orderConfirmationEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/email";
import { ensureInvoice, getInvoiceData } from "@/lib/invoices";
import { isClosed } from "@/lib/order-status";
import type { CheckoutItem } from "@/lib/validations/checkout";

export {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  shippingFor,
} from "@/lib/shipping";

const orderId = customAlphabet("ACDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

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
export async function priceCart(items: CheckoutItem[]): Promise<PricedCart> {
  if (items.length === 0) return { ok: false, error: "Your cart is empty." };

  const variants = await prisma.productVariant.findMany({
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
  });

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
  const order = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) throw new Error("ORDER_NOT_FOUND");
    if (existing.stockDeducted) return null; // already confirmed

    // Decrement stock for each line (guarded against going negative).
    for (const line of existing.items) {
      if (!line.variantId) continue;
      await tx.productVariant.updateMany({
        where: { id: line.variantId, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
    }

    if (existing.couponId) {
      await tx.coupon.update({
        where: { id: existing.couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

    const updated = await tx.order.update({
      where: { id },
      data: {
        paymentStatus: opts.paymentStatus,
        stockDeducted: true,
        razorpayPaymentId: opts.payment?.paymentId,
        razorpaySignature: opts.payment?.signature,
      },
      include: { items: true, user: { select: { email: true, name: true } } },
    });

    // Seed the timeline with the placement event.
    await tx.orderEvent.create({
      data: { orderId: id, status: "PENDING", note: "Order placed", actor: "system" },
    });

    return updated;
  });

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
}

/** Transition an order to PAID (online payment). Thin wrapper over confirmOrder. */
export async function markOrderPaid(
  id: string,
  payment?: { paymentId: string; signature?: string },
): Promise<void> {
  return confirmOrder(id, { paymentStatus: "PAID", payment });
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

  let paymentStatus: PaymentStatus = order.paymentStatus;
  if (closing) {
    if (order.paymentStatus === "PAID") paymentStatus = "REFUNDED";
  } else if (
    status === "DELIVERED" &&
    order.paymentMethod === "COD" &&
    order.paymentStatus === "PENDING"
  ) {
    paymentStatus = "PAID";
  }

  const shouldRestock = closing && !isClosed(order.status) && order.stockDeducted;

  const updated = await prisma.$transaction(async (tx) => {
    if (shouldRestock) {
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
        ...(shouldRestock ? { stockDeducted: false } : {}),
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
    return o;
  });

  return updated;
}
