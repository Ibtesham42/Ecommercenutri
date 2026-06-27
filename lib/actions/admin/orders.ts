"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { orderStatusSchema } from "@/lib/validations/admin";
import { orderStatusEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/email";
import { transitionOrderStatus } from "@/lib/orders";
import type { AdminResult } from "@/lib/actions/admin/types";

/**
 * Update an order's fulfilment status. The shared `transitionOrderStatus` handles
 * stock restock, payment-status derivation and the timeline event; the admin may
 * set any stage (including cancelling at any point). Notifies the customer for
 * meaningful changes.
 */
export async function updateOrderStatus(input: unknown): Promise<AdminResult> {
  await requirePermission("orders");

  const parsed = orderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid status." };
  }
  const { orderId, status, reason } = parsed.data;

  let updated: Awaited<ReturnType<typeof transitionOrderStatus>>;
  try {
    updated = await transitionOrderStatus(orderId, status, {
      reason: reason ?? (status === "CANCELLED" ? "Cancelled by store" : null),
      actor: "admin",
    });
  } catch {
    return { ok: false, error: "Order not found." };
  }
  if (!updated) return { ok: true }; // no-op (status unchanged)

  // Notify the customer about meaningful status changes (best-effort).
  if (updated.user?.email) {
    const mail = orderStatusEmail({
      orderNumber: updated.orderNumber,
      status,
      name: updated.user.name,
      reason: updated.cancelReason,
    });
    if (mail) {
      try {
        await sendEmail({ to: updated.user.email, ...mail });
      } catch (err) {
        console.error("[admin] order status email failed:", err);
      }
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${updated.orderNumber}`);
  revalidatePath("/account/orders");
  revalidatePath(`/account/orders/${updated.orderNumber}`);
  return { ok: true };
}
