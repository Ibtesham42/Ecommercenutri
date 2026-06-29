"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { couponInputSchema } from "@/lib/validations/admin";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

export async function saveCoupon(input: unknown): Promise<AdminResult> {
  await requirePermission("coupons");

  const parsed = couponInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid coupon." };
  }
  const d = parsed.data;
  const code = d.code.toUpperCase();

  const clash = await prisma.coupon.findFirst({
    where: { code, ...(d.id ? { NOT: { id: d.id } } : {}) },
    select: { id: true },
  });
  if (clash) return { ok: false, error: "Another coupon already uses that code." };

  const data = {
    code,
    description: d.description || null,
    type: d.type,
    value: d.value,
    minOrder: d.minOrder ?? null,
    maxDiscount: d.maxDiscount ?? null,
    usageLimit: d.usageLimit ?? null,
    perUserLimit: d.perUserLimit ?? null,
    startsAt: d.startsAt ?? null,
    expiresAt: d.expiresAt ?? null,
    isActive: d.isActive,
  };

  if (d.id) {
    await prisma.coupon.update({ where: { id: d.id }, data });
  } else {
    await prisma.coupon.create({ data });
  }
  revalidatePath("/admin/coupons");
  return { ok: true };
}

export async function toggleCoupon(id: string, isActive: boolean): Promise<AdminResult> {
  await requirePermission("coupons");
  await prisma.coupon.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/coupons");
  return { ok: true };
}

export async function deleteCoupon(id: string): Promise<AdminResult> {
  await requirePermission("coupons");
  const used = await prisma.order.count({ where: { couponId: id } });
  if (used > 0) {
    // Keep referential history — deactivate instead of deleting.
    await prisma.coupon.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/admin/coupons");
    return { ok: true };
  }
  await prisma.coupon.delete({ where: { id } });
  revalidatePath("/admin/coupons");
  return { ok: true };
}

const COUPON_BULK_ACTIONS = ["delete", "activate", "deactivate"] as const;
type CouponBulkAction = (typeof COUPON_BULK_ACTIONS)[number];

/** Bulk coupon action. Delete keeps referential history: coupons already used by
 *  an order are deactivated instead of deleted; unused ones are removed. */
export async function bulkCouponAction(
  ids: string[],
  action: CouponBulkAction,
): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("coupons");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (!COUPON_BULK_ACTIONS.includes(action)) return { ok: false, error: "Unknown action." };

  try {
    if (action === "delete") {
      const used = await prisma.coupon.findMany({
        where: { id: { in: ids }, orders: { some: {} } },
        select: { id: true },
      });
      const usedIds = new Set(used.map((c) => c.id));
      const deletable = ids.filter((id) => !usedIds.has(id));

      let deleted = 0;
      if (deletable.length) {
        deleted = (await prisma.coupon.deleteMany({ where: { id: { in: deletable } } })).count;
      }
      let deactivated = 0;
      if (usedIds.size) {
        deactivated = (
          await prisma.coupon.updateMany({
            where: { id: { in: [...usedIds] } },
            data: { isActive: false },
          })
        ).count;
      }
      revalidatePath("/admin/coupons");
      return {
        ok: true,
        data: {
          done: deleted + deactivated,
          skipped: 0,
          note: deactivated
            ? `${deleted} deleted · ${deactivated} deactivated (in use, kept for order history).`
            : undefined,
        },
      };
    }

    const res = await prisma.coupon.updateMany({
      where: { id: { in: ids } },
      data: { isActive: action === "activate" },
    });
    revalidatePath("/admin/coupons");
    return { ok: true, data: { done: res.count, skipped: ids.length - res.count } };
  } catch (err) {
    console.error("[admin] bulkCouponAction failed:", err);
    return { ok: false, error: "Bulk action failed." };
  }
}
