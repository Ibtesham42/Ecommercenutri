import { customAlphabet } from "nanoid";
import { Prisma, type ReturnStatus, type RefundMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getReturnSettings } from "@/lib/queries/settings";
import { refundPayment } from "@/lib/razorpay";
import { ensureCreditNote } from "@/lib/credit-notes";

const DAY_MS = 86_400_000;
const rmaId = customAlphabet("ACDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

/** Human-friendly, unique-enough return number, e.g. RMA-260628-A1B2C3. */
export function generateReturnNumber(): string {
  const d = new Date();
  const stamp = `${d.getFullYear().toString().slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `RMA-${stamp}-${rmaId()}`;
}

/** Most recent DELIVERED timestamp for an order (when the return window starts). */
async function deliveredAt(orderId: string): Promise<Date | null> {
  const ev = await prisma.orderEvent.findFirst({
    where: { orderId, status: "DELIVERED" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return ev?.createdAt ?? null;
}

export type ReturnableItem = {
  orderItemId: string;
  productId: string | null;
  productName: string;
  variantLabel: string;
  image: string | null;
  unitPrice: number; // paise
  orderedQty: number;
  returnableQty: number; // ordered minus already-requested (open/approved/refunded)
};

export type ReturnEligibility = {
  eligible: boolean;
  reason?: string;
  items: ReturnableItem[];
  windowEndsAt: Date | null;
};

/**
 * Decide whether a delivered order can be returned and which items/quantities are
 * still eligible. Gated by: store `returnsEnabled`, order `DELIVERED`, the return
 * window (per-product override → store default, counted from the delivery date),
 * and product + category `returnable` flags. Already-requested quantities (in any
 * non-rejected/cancelled return) are subtracted so an item can't be over-returned.
 */
export async function getReturnEligibility(orderId: string): Promise<ReturnEligibility> {
  const settings = await getReturnSettings();
  const deny = (reason: string): ReturnEligibility => ({
    eligible: false,
    reason,
    items: [],
    windowEndsAt: null,
  });
  if (!settings.returnsEnabled) return deny("Returns are currently unavailable.");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: {
              returnable: true,
              returnWindowDays: true,
              category: { select: { returnable: true } },
            },
          },
        },
      },
      returns: {
        where: { status: { notIn: ["REJECTED", "CANCELLED"] } },
        include: { items: { select: { orderItemId: true, quantity: true } } },
      },
    },
  });
  if (!order) return deny("Order not found.");
  if (order.status !== "DELIVERED") {
    return deny("Returns can be requested only after the order is delivered.");
  }

  const delivered = await deliveredAt(orderId);
  if (!delivered) return deny("Delivery date is unavailable for this order.");

  // Quantity already requested per order item across active returns.
  const requested = new Map<string, number>();
  for (const r of order.returns) {
    for (const it of r.items) {
      requested.set(it.orderItemId, (requested.get(it.orderItemId) ?? 0) + it.quantity);
    }
  }

  const now = Date.now();
  let windowEndsAt: Date | null = null;
  const items: ReturnableItem[] = [];
  for (const it of order.items) {
    const productReturnable =
      (it.product?.returnable ?? true) && (it.product?.category?.returnable ?? true);
    if (!productReturnable) continue;
    const windowDays = it.product?.returnWindowDays ?? settings.returnWindowDays;
    const ends = new Date(delivered.getTime() + windowDays * DAY_MS);
    if (!windowEndsAt || ends > windowEndsAt) windowEndsAt = ends;
    if (now > ends.getTime()) continue; // window passed for this item

    const returnableQty = it.quantity - (requested.get(it.id) ?? 0);
    if (returnableQty <= 0) continue;
    items.push({
      orderItemId: it.id,
      productId: it.productId,
      productName: it.productName,
      variantLabel: it.variantLabel,
      image: it.image,
      unitPrice: it.price,
      orderedQty: it.quantity,
      returnableQty,
    });
  }

  if (items.length === 0) {
    return { eligible: false, reason: "No items are eligible for return.", items, windowEndsAt };
  }
  return { eligible: true, items, windowEndsAt };
}

/** Boolean convenience wrapper for pages that only need a yes/no. */
export async function isOrderReturnEligible(orderId: string): Promise<boolean> {
  return (await getReturnEligibility(orderId)).eligible;
}

export type TransitionedReturn = Prisma.ReturnRequestGetPayload<{
  include: {
    order: { select: { orderNumber: true } };
    user: { select: { id: true; email: true; name: true } };
  };
}>;

/**
 * Move a return to a new status, optionally writing extra scalar fields (e.g.
 * rejectionReason, pickupScheduledAt), and append a ReturnEvent (audit timeline).
 * Mirrors `transitionOrderStatus`; authorization lives in the callers.
 */
export async function transitionReturnStatus(
  returnId: string,
  status: ReturnStatus,
  opts: {
    note?: string | null;
    actor: "customer" | "admin" | "system";
    data?: Prisma.ReturnRequestUncheckedUpdateInput;
  },
): Promise<TransitionedReturn> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.returnRequest.update({
      where: { id: returnId },
      data: { status, ...(opts.data ?? {}) },
      include: {
        order: { select: { orderNumber: true } },
        user: { select: { id: true, email: true, name: true } },
      },
    });
    await tx.returnEvent.create({
      data: { returnId, status, note: opts.note ?? null, actor: opts.actor },
    });
    return r;
  });
}

/** True once every order item's quantity is covered by active (non-rejected/cancelled)
 *  returns — i.e. the whole order has been returned. */
async function isFullOrderReturn(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { select: { id: true, quantity: true } },
      returns: {
        where: { status: { notIn: ["REJECTED", "CANCELLED"] } },
        include: { items: { select: { orderItemId: true, quantity: true } } },
      },
    },
  });
  if (!order) return false;
  const returned = new Map<string, number>();
  for (const r of order.returns) {
    for (const it of r.items) {
      returned.set(it.orderItemId, (returned.get(it.orderItemId) ?? 0) + it.quantity);
    }
  }
  return order.items.every((oi) => (returned.get(oi.id) ?? 0) >= oi.quantity);
}

/**
 * Execute the refund for a return and mark it REFUNDED. Prepaid + ORIGINAL method
 * issues a real Razorpay refund (keyless mock otherwise); COD/manual methods just
 * record the method + reference. Restocks the returned quantities (once, guarded by
 * the order's `stockDeducted`); when the whole order has now been returned, closes
 * the order as RETURNED + REFUNDED. Generates the credit note. Idempotent once the
 * refund is COMPLETED.
 */
export async function processRefund(
  returnId: string,
  opts: { amount: number; method: RefundMethod; reference?: string | null },
): Promise<TransitionedReturn> {
  const ret = await prisma.returnRequest.findUnique({
    where: { id: returnId },
    include: {
      items: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          paymentMethod: true,
          paymentStatus: true,
          razorpayPaymentId: true,
          stockDeducted: true,
        },
      },
    },
  });
  if (!ret) throw new Error("RETURN_NOT_FOUND");
  const order = ret.order;
  if (ret.refundStatus === "COMPLETED") {
    return reloadReturn(returnId);
  }

  // Money movement.
  let refundRef = opts.reference?.trim() || null;
  if (opts.method === "ORIGINAL") {
    if (order.paymentMethod !== "RAZORPAY" || !order.razorpayPaymentId) {
      throw new Error("NO_ORIGINAL_PAYMENT");
    }
    const r = await refundPayment(order.razorpayPaymentId, opts.amount);
    refundRef = r.id;
  }

  const fullOrder = await isFullOrderReturn(order.id);

  await prisma.$transaction(async (tx) => {
    await tx.returnRequest.update({
      where: { id: returnId },
      data: {
        status: "REFUNDED",
        refundStatus: "COMPLETED",
        refundMethod: opts.method,
        refundedAmount: opts.amount,
        refundRef,
      },
    });
    await tx.returnEvent.create({
      data: {
        returnId,
        status: "REFUNDED",
        note: `Refund issued via ${opts.method}${refundRef ? ` (${refundRef})` : ""}`,
        actor: "admin",
      },
    });

    // Restock the returned variant quantities (once).
    if (order.stockDeducted) {
      for (const it of ret.items) {
        const oi = await tx.orderItem.findUnique({
          where: { id: it.orderItemId },
          select: { variantId: true },
        });
        if (oi?.variantId) {
          await tx.productVariant.update({
            where: { id: oi.variantId },
            data: { stock: { increment: it.quantity } },
          });
        }
      }
    }

    // Whole order returned → close it. We restock per-return (above), so clear
    // `stockDeducted` to prevent any later bulk restock double-counting.
    if (fullOrder) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "RETURNED",
          paymentStatus: order.paymentStatus === "PAID" ? "REFUNDED" : order.paymentStatus,
          stockDeducted: false,
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          status: "RETURNED",
          note: `Return ${ret.returnNumber} refunded`,
          actor: "admin",
        },
      });
    }
  });

  await ensureCreditNote(returnId);
  return reloadReturn(returnId);
}

function reloadReturn(returnId: string): Promise<TransitionedReturn> {
  return prisma.returnRequest.findUniqueOrThrow({
    where: { id: returnId },
    include: {
      order: { select: { orderNumber: true } },
      user: { select: { id: true, email: true, name: true } },
    },
  });
}
