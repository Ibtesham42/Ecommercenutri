"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { orderStatusSchema } from "@/lib/validations/admin";
import { orderStatusEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/email";
import { transitionOrderStatus } from "@/lib/orders";
import { ADMIN_STATUS_OPTIONS, isOrderDeletable, statusLabel } from "@/lib/order-status";
import type { OrderStatus } from "@prisma/client";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

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

/**
 * Bulk-set the fulfilment status of many orders. Each order goes through the shared
 * `transitionOrderStatus` (stock restock, payment derivation, timeline event) and the
 * customer is emailed best-effort. Orders already at the target status (or where the
 * transition is a no-op) are counted as skipped.
 */
export async function bulkUpdateOrderStatus(
  ids: string[],
  status: string,
): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("orders");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (!(ADMIN_STATUS_OPTIONS as readonly string[]).includes(status)) {
    return { ok: false, error: "Invalid status." };
  }
  const target = status as OrderStatus;

  let done = 0;
  for (const orderId of ids) {
    try {
      const updated = await transitionOrderStatus(orderId, target, {
        reason: target === "CANCELLED" ? "Cancelled by store" : null,
        actor: "admin",
      });
      if (!updated) continue; // no-op (already at status)
      done++;
      if (updated.user?.email) {
        const mail = orderStatusEmail({
          orderNumber: updated.orderNumber,
          status: target,
          name: updated.user.name,
          reason: updated.cancelReason,
        });
        if (mail) {
          try {
            await sendEmail({ to: updated.user.email, ...mail });
          } catch (err) {
            console.error("[admin] bulk order status email failed:", err);
          }
        }
      }
    } catch (err) {
      console.error("[admin] bulkUpdateOrderStatus item failed:", err);
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath("/account/orders");
  return { ok: true, data: { done, skipped: ids.length - done } };
}

/**
 * Permanently delete an order. Allowed only for completed/closed orders
 * (DELIVERED / CANCELLED / REFUNDED / RETURNED) — in-flight orders are protected.
 * All related records (items, events, invoice, commission, returns + their
 * sub-records) cascade via FK `onDelete: Cascade`, so nothing is orphaned.
 */
export async function deleteOrder(id: string): Promise<AdminResult> {
  await requirePermission("orders");
  const order = await prisma.order.findUnique({ where: { id }, select: { status: true, orderNumber: true } });
  if (!order) return { ok: false, error: "Order not found." };
  if (!isOrderDeletable(order.status)) {
    return {
      ok: false,
      error: `Can't delete an order that is ${statusLabel(order.status)}. Only completed or closed orders (Delivered, Cancelled, Refunded, Returned) can be deleted.`,
    };
  }
  try {
    await prisma.order.delete({ where: { id } });
    revalidatePath("/admin/orders");
    revalidatePath("/account/orders");
    return { ok: true };
  } catch (err) {
    console.error("[admin] deleteOrder failed:", err);
    return { ok: false, error: "Could not delete the order." };
  }
}

/**
 * Bulk-delete selected orders. Deletes only the deletable (completed/closed) ones
 * and reports how many were kept because they're still in progress.
 */
export async function bulkDeleteOrders(ids: string[]): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("orders");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };

  try {
    const orders = await prisma.order.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
    });
    const deletable = orders.filter((o) => isOrderDeletable(o.status)).map((o) => o.id);
    let done = 0;
    if (deletable.length) {
      done = (await prisma.order.deleteMany({ where: { id: { in: deletable } } })).count;
    }
    const skipped = ids.length - done;
    revalidatePath("/admin/orders");
    revalidatePath("/account/orders");
    return {
      ok: true,
      data: {
        done,
        skipped,
        note: skipped ? `${done} deleted · ${skipped} kept (still in progress — only completed/closed orders can be deleted).` : undefined,
      },
    };
  } catch (err) {
    console.error("[admin] bulkDeleteOrders failed:", err);
    return { ok: false, error: "Bulk delete failed." };
  }
}
