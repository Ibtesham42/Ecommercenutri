"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { couponInputSchema } from "@/lib/validations/admin";
import type { AdminResult } from "@/lib/actions/admin/types";

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
