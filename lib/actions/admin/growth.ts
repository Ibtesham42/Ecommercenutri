"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { growthSettingsSchema } from "@/lib/validations/growth";
import { resolveGrowth } from "@/lib/growth-settings";
import type { AdminResult } from "@/lib/actions/admin/types";

/** Save the Growth / conversion-optimization settings (Admin → Growth). Also
 *  ensures the welcome coupon exists so the code works at checkout immediately.
 *  Revalidates the storefront layout + homepage so changes apply without a deploy. */
export async function updateGrowthSettings(input: unknown): Promise<AdminResult> {
  await requirePermission("appearance");

  const parsed = growthSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  }

  // Normalize (uppercases/validates the coupon code, clamps percent) before persist.
  const settings = resolveGrowth(parsed.data);
  const blob: Prisma.InputJsonValue = { ...settings };

  await prisma.storeSetting.upsert({
    where: { id: "singleton" },
    update: { growth: blob },
    create: { id: "singleton", growth: blob },
  });

  // Keep the shared welcome coupon in sync with the configured code/percent.
  try {
    await prisma.coupon.upsert({
      where: { code: settings.couponCode },
      update: { value: settings.couponPercent, type: "PERCENT", isActive: true },
      create: {
        code: settings.couponCode,
        description: `${settings.couponPercent}% welcome discount for new members`,
        type: "PERCENT",
        value: settings.couponPercent,
        isActive: true,
        perUserLimit: 1,
      },
    });
  } catch (err) {
    console.error("[admin/growth] coupon sync failed:", err);
  }

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/admin/growth");
  return { ok: true };
}
