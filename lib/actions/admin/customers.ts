"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

const CUSTOMER_BULK_ACTIONS = ["activate", "deactivate", "delete"] as const;
type CustomerBulkAction = (typeof CUSTOMER_BULK_ACTIONS)[number];

/**
 * Bulk action over customer accounts. Scoped to `role: USER` so admins can never
 * be touched here. Deactivate (isActive=false) blocks sign-in but preserves the
 * account + order history — the safe reversible option. Hard-delete is allowed
 * only for customers with **no orders** (others are kept to protect sales history).
 */
export async function bulkCustomerAction(
  ids: string[],
  action: CustomerBulkAction,
): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("customers");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (!CUSTOMER_BULK_ACTIONS.includes(action)) return { ok: false, error: "Unknown action." };

  try {
    if (action === "delete") {
      const deletable = await prisma.user.findMany({
        where: { id: { in: ids }, role: "USER", orders: { none: {} } },
        select: { id: true },
      });
      let done = 0;
      if (deletable.length) {
        done = (
          await prisma.user.deleteMany({
            where: { id: { in: deletable.map((u) => u.id) }, role: "USER" },
          })
        ).count;
      }
      revalidatePath("/admin/customers");
      const skipped = ids.length - done;
      return {
        ok: true,
        data: {
          done,
          skipped,
          note: skipped ? `${done} deleted · ${skipped} kept (have orders).` : undefined,
        },
      };
    }

    const res = await prisma.user.updateMany({
      where: { id: { in: ids }, role: "USER" },
      data: { isActive: action === "activate" },
    });
    revalidatePath("/admin/customers");
    return { ok: true, data: { done: res.count, skipped: ids.length - res.count } };
  } catch (err) {
    console.error("[admin] bulkCustomerAction failed:", err);
    return { ok: false, error: "Bulk action failed." };
  }
}
