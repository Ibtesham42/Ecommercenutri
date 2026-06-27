"use server";

import { revalidatePath } from "next/cache";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { orderStatusSchema } from "@/lib/validations/admin";
import { orderStatusEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/email";
import type { AdminResult } from "@/lib/actions/admin/types";

const CLOSED: OrderStatus[] = ["CANCELLED", "REFUNDED"];

/** Update an order's fulfillment status, with sensible payment/stock side-effects. */
export async function updateOrderStatus(input: unknown): Promise<AdminResult> {
  await requirePermission("orders");

  const parsed = orderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid status." };
  }
  const { orderId, status } = parsed.data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: { select: { email: true, name: true } } },
  });
  if (!order) return { ok: false, error: "Order not found." };
  const statusChanged = order.status !== status;

  // Derive the payment status implied by the new fulfillment status.
  const isCod = order.paymentMethod === "COD";
  let paymentStatus: PaymentStatus = order.paymentStatus;
  if (status === "REFUNDED") {
    paymentStatus = "REFUNDED";
  } else if (status === "CANCELLED") {
    paymentStatus = order.paymentStatus === "PAID" ? "REFUNDED" : "FAILED";
  } else if (isCod) {
    // COD is collected on delivery — mark PAID only at DELIVERED.
    if (status === "DELIVERED" && order.paymentStatus === "PENDING") paymentStatus = "PAID";
  } else if (
    status === "PAID" ||
    status === "PROCESSING" ||
    status === "SHIPPED" ||
    status === "DELIVERED"
  ) {
    if (order.paymentStatus === "PENDING") paymentStatus = "PAID";
  }

  // Restock on the transition *into* a closed state from an open order whose
  // stock was actually decremented (PAID for online, at confirmation for COD).
  // Keyed off `stockDeducted` — not paymentStatus — so COD restocks correctly.
  const shouldRestock =
    CLOSED.includes(status) && !CLOSED.includes(order.status) && order.stockDeducted;

  await prisma.$transaction(async (tx) => {
    if (shouldRestock) {
      for (const item of order.items) {
        if (!item.variantId) continue;
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        status,
        paymentStatus,
        ...(shouldRestock ? { stockDeducted: false } : {}),
      },
    });
  });

  // Notify the customer about meaningful status changes (best-effort).
  if (statusChanged && order.user?.email) {
    const mail = orderStatusEmail({
      orderNumber: order.orderNumber,
      status,
      name: order.user.name,
    });
    if (mail) {
      try {
        await sendEmail({ to: order.user.email, ...mail });
      } catch (err) {
        console.error("[admin] order status email failed:", err);
      }
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${order.orderNumber}`);
  revalidatePath("/account/orders");
  return { ok: true };
}
