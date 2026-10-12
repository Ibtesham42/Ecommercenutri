/**
 * One live order per single-use Spin & Win offer (server-only).
 *
 * `confirmOrder` already makes the coupon's redemption atomic, but that's the
 * last line of defence: two Razorpay orders created with the same offer could
 * both be PAID, and the loser then needs a manual refund. This guard stops the
 * second order from being created at all:
 *
 *  - An open order (PENDING, payment PENDING, stock not deducted) younger than
 *    30 minutes holds the offer. A retry of the SAME checkout (same items,
 *    prices, address, total, online payment) reopens that order's Razorpay
 *    payment instead of creating another; anything else is refused.
 *  - An open order older than 30 minutes is ignored ONLY once it's verified
 *    unpaid: no Razorpay order was ever created, or Razorpay reports no
 *    payment other than failed ones. A captured payment is reconciled through
 *    the normal confirm path (`markOrderPaid`, with its fulfilment-failure
 *    handling); authorised/refunded/unknown states or an API error count as
 *    uncertain and keep the offer held. Nothing is ever cancelled here — a
 *    stale order is simply left alone.
 *  - An order holding a captured payment that couldn't be confirmed
 *    (`razorpayPaymentId` set, stock not deducted — the manual-review state)
 *    always holds the offer.
 *
 * The decision and the insert run in one transaction holding the coupon row
 * lock, so concurrent checkouts with the same offer are serialised: the
 * second sees the first's order and is refused (or reuses it).
 */

import type { Order, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { razorpay } from "@/lib/razorpay";
import { TX_OPTIONS, withTxRetry } from "@/lib/db-retry";

export const STALE_PENDING_MS = 30 * 60_000;

type Tx = Omit<typeof prisma, "$extends" | "$transaction" | "$connect" | "$disconnect" | "$on">;

export type PaymentProbeResult =
  | { state: "UNPAID" }
  | { state: "CAPTURED"; paymentId: string }
  | { state: "UNCERTAIN" };

/** Ask Razorpay what happened to an order's payments. Errors → UNCERTAIN. */
export type PaymentProbe = (razorpayOrderId: string) => Promise<PaymentProbeResult>;

export const razorpayProbe: PaymentProbe = async (razorpayOrderId) => {
  if (!razorpay) return { state: "UNCERTAIN" };
  try {
    const res = (await razorpay.orders.fetchPayments(razorpayOrderId)) as {
      items?: { id: string; status: string }[];
    };
    return classifyPayments(res.items ?? []);
  } catch (err) {
    console.error(`[checkout-guard] payment lookup failed for ${razorpayOrderId}:`, err);
    return { state: "UNCERTAIN" };
  }
};

/** Pure: Razorpay payment statuses → unpaid / captured / uncertain. */
export function classifyPayments(items: readonly { id: string; status: string }[]): PaymentProbeResult {
  const captured = items.find((p) => p.status === "captured");
  if (captured) return { state: "CAPTURED", paymentId: captured.id };
  // Only "failed" proves no money moved. created/authorized may still capture;
  // refunded means money moved before — leave all of those to a human.
  return items.every((p) => p.status === "failed") ? { state: "UNPAID" } : { state: "UNCERTAIN" };
}

type FingerprintInput = {
  items: readonly { variantId: string | null; quantity: number; price: number }[];
  total: number;
  addressId: string | null;
  paymentMethod: PaymentMethod;
};

/** Same checkout = same lines, prices, total, address and payment method. */
export function orderFingerprint(o: FingerprintInput): string {
  const lines = o.items
    .map((i) => `${i.variantId}:${i.quantity}:${i.price}`)
    .sort()
    .join(",");
  return `${lines}|${o.total}|${o.addressId}|${o.paymentMethod}`;
}

const openOrderSelect = {
  id: true,
  orderNumber: true,
  userId: true,
  createdAt: true,
  paymentMethod: true,
  razorpayOrderId: true,
  razorpayPaymentId: true,
  total: true,
  addressId: true,
  items: { select: { variantId: true, quantity: true, price: true } },
} satisfies Prisma.OrderSelect;

type OpenOrder = Prisma.OrderGetPayload<{ select: typeof openOrderSelect }>;

function openOrdersWhere(couponId: string): Prisma.OrderWhereInput {
  return { couponId, status: "PENDING", paymentStatus: "PENDING", stockDeducted: false };
}

export type ReusableOrder = Pick<Order, "id" | "orderNumber" | "total"> & { razorpayOrderId: string };

export type GuardOutcome<T> =
  | { kind: "created"; order: T }
  | { kind: "reuse"; order: ReusableOrder }
  | { kind: "blocked"; error: string };

const MSG = {
  used: "This Spin & Win offer has already been used.",
  review:
    "We're still confirming the payment on an earlier order that used this offer. " +
    "Please try again later, or contact us if you need help.",
  settingUp: "Your payment for this offer is still being set up — please wait a few seconds and try again.",
  inProgress: (minutes: number) =>
    "This offer is already attached to a payment you started. Complete that payment, or try again in " +
    `about ${minutes} minute${minutes === 1 ? "" : "s"} to use it on a different order.`,
};

/**
 * Create an order that redeems a single-use Spin & Win offer, unless another
 * live order already holds the offer. `create` runs inside the guarded
 * transaction and must only insert the order.
 */
export async function placeOrderWithSingleUseOffer<T>(input: {
  couponId: string;
  userId: string;
  fingerprint: string;
  paymentMethod: PaymentMethod;
  create: (tx: Tx) => Promise<T>;
  probe?: PaymentProbe;
  reconcile?: (orderId: string, paymentId: string) => Promise<void>;
  now?: () => Date;
}): Promise<GuardOutcome<T>> {
  const probe = input.probe ?? razorpayProbe;
  const now = input.now ?? (() => new Date());
  const reconcile =
    input.reconcile ??
    (async (orderId: string, paymentId: string) => {
      const { markOrderPaid } = await import("@/lib/orders");
      await markOrderPaid(orderId, { paymentId }).catch((err) => {
        // OrderFulfillmentError is recorded for manual review by confirmOrder.
        console.error(`[checkout-guard] reconciling order ${orderId} failed:`, err);
      });
    });

  // 1. Outside any lock (network calls): settle stale orders' payment state.
  const ignorable = new Set<string>();
  const stale = await prisma.order.findMany({
    where: { ...openOrdersWhere(input.couponId), createdAt: { lte: new Date(now().getTime() - STALE_PENDING_MS) } },
    select: openOrderSelect,
  });
  for (const o of stale) {
    if (o.razorpayPaymentId) continue; // captured payment under manual review
    if (o.paymentMethod !== "RAZORPAY" || !o.razorpayOrderId) {
      ignorable.add(o.id); // no gateway order → no payment can exist
      continue;
    }
    const result = await probe(o.razorpayOrderId);
    if (result.state === "UNPAID") ignorable.add(o.id);
    else if (result.state === "CAPTURED") await reconcile(o.id, result.paymentId);
  }

  // 2. Decide + insert under the coupon row lock.
  return withTxRetry(() =>
    prisma.$transaction(async (tx): Promise<GuardOutcome<T>> => {
      const locked = await tx.$queryRaw<{ usedCount: number; usageLimit: number | null }[]>`
        SELECT "usedCount", "usageLimit" FROM "Coupon" WHERE "id" = ${input.couponId} FOR UPDATE`;
      const coupon = locked[0];
      if (!coupon || (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit)) {
        return { kind: "blocked", error: MSG.used };
      }

      const open: OpenOrder[] = await tx.order.findMany({
        where: openOrdersWhere(input.couponId),
        select: openOrderSelect,
        orderBy: { createdAt: "desc" },
      });
      const at = now().getTime();
      for (const o of open) {
        if (o.razorpayPaymentId) return { kind: "blocked", error: MSG.review };
        const age = at - o.createdAt.getTime();
        if (age >= STALE_PENDING_MS) {
          if (ignorable.has(o.id)) continue;
          return { kind: "blocked", error: MSG.review }; // uncertain (or just reconciled)
        }
        // A live attempt holds the offer. Same checkout → reopen its payment.
        const sameCheckout =
          o.userId === input.userId &&
          input.paymentMethod === "RAZORPAY" &&
          o.paymentMethod === "RAZORPAY" &&
          orderFingerprint(o) === input.fingerprint;
        if (sameCheckout && o.razorpayOrderId) {
          return {
            kind: "reuse",
            order: { id: o.id, orderNumber: o.orderNumber, total: o.total, razorpayOrderId: o.razorpayOrderId },
          };
        }
        if (sameCheckout) return { kind: "blocked", error: MSG.settingUp };
        return { kind: "blocked", error: MSG.inProgress(Math.max(1, Math.ceil((STALE_PENDING_MS - age) / 60_000))) };
      }

      return { kind: "created", order: await input.create(tx) };
    }, TX_OPTIONS),
  );
}
