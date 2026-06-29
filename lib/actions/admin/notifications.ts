"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

/** Delete a single in-app notification. */
export async function deleteNotification(id: string): Promise<AdminResult> {
  await requirePermission("customers");
  await prisma.notification.delete({ where: { id } });
  revalidatePath("/admin/notifications");
  return { ok: true };
}

const NOTIFICATION_BULK_ACTIONS = ["read", "unread", "delete"] as const;
type NotificationBulkAction = (typeof NOTIFICATION_BULK_ACTIONS)[number];

/** Bulk mark read / unread / delete in-app notifications (admin oversight). */
export async function bulkNotificationAction(
  ids: string[],
  action: NotificationBulkAction,
): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("customers");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (!NOTIFICATION_BULK_ACTIONS.includes(action)) return { ok: false, error: "Unknown action." };

  try {
    const res =
      action === "delete"
        ? await prisma.notification.deleteMany({ where: { id: { in: ids } } })
        : await prisma.notification.updateMany({
            where: { id: { in: ids } },
            data: { read: action === "read" },
          });
    revalidatePath("/admin/notifications");
    return { ok: true, data: { done: res.count, skipped: ids.length - res.count } };
  } catch (err) {
    console.error("[admin] bulkNotificationAction failed:", err);
    return { ok: false, error: "Bulk action failed." };
  }
}
