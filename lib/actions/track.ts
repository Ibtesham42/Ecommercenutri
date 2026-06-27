"use server";

import { headers } from "next/headers";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { trackOrderSchema } from "@/lib/validations/contact";
import { checkRateLimit, limiters } from "@/lib/rate-limit";

export type TrackedOrder = {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  placedAt: string; // ISO
  subtotal: number; // paise
  discount: number; // paise
  tax: number; // paise (GST, inclusive)
  shipping: number; // paise
  shippingSaved: number; // paise (waived by free delivery)
  codFee: number; // paise (Cash on Delivery fee)
  total: number; // paise
  couponCode: string | null;
  recipient: string | null;
  items: {
    id: string;
    name: string;
    variantLabel: string;
    image: string | null;
    quantity: number;
    price: number;
  }[];
};

export type TrackResult = { ok: true; order: TrackedOrder } | { ok: false; error: string };

const NOT_FOUND = "We couldn't find an order matching those details. Please check and try again.";

/**
 * Public order lookup by order number + the email used at checkout. Returns a
 * trimmed, safe DTO — never the full order record — so it can be shown to a
 * guest without authentication.
 */
export async function trackOrder(input: unknown): Promise<TrackResult> {
  const parsed = trackOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const { orderNumber, email } = parsed.data;

  const fwd = (await headers()).get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || "anon";
  const rl = await checkRateLimit(limiters.api, `track:${ip}`);
  if (!rl.success) {
    return { ok: false, error: "Too many lookups. Please try again in a minute." };
  }

  let order: Awaited<ReturnType<typeof findOrder>>;
  try {
    order = await findOrder(orderNumber);
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  // Match the checkout email against the account email (constant message on
  // mismatch so the form can't be used to enumerate order numbers).
  if (!order || order.user.email?.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, error: NOT_FOUND };
  }

  const address = order.shippingAddress as unknown as { fullName?: string } | null;

  return {
    ok: true,
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      placedAt: order.createdAt.toISOString(),
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      shipping: order.shipping,
      shippingSaved: order.shippingSaved,
      codFee: order.codFee,
      total: order.total,
      couponCode: order.couponCode,
      recipient: address?.fullName ?? order.user.name ?? null,
      items: order.items.map((i) => ({
        id: i.id,
        name: i.productName,
        variantLabel: i.variantLabel,
        image: i.image,
        quantity: i.quantity,
        price: i.price,
      })),
    },
  };
}

function findOrder(orderNumber: string) {
  return prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      user: { select: { email: true, name: true } },
    },
  });
}
