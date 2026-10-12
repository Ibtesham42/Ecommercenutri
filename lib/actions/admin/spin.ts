"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { spinCampaignSchema } from "@/lib/validations/spin";
import type { AdminResult } from "@/lib/actions/admin/types";

// Spin & Win is a promotion built on coupons → governed by the existing
// "coupons" permission (no new RBAC key).

function revalidate() {
  revalidatePath("/admin/spin");
  revalidatePath("/spin");
  revalidatePath("/offers");
  revalidatePath("/");
}

export async function saveSpinCampaign(input: unknown): Promise<AdminResult<{ id: string }>> {
  await requirePermission("coupons");
  const parsed = spinCampaignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign." };
  }
  const d = parsed.data;

  // Keep only variant ids that really exist (stale ids from a deleted variant
  // would otherwise sit in the list forever).
  const existing = await prisma.productVariant.findMany({
    where: { id: { in: d.eligibleVariantIds } },
    select: { id: true },
  });
  const eligibleVariantIds = existing.map((v) => v.id);
  if (d.isActive && eligibleVariantIds.length === 0) {
    return { ok: false, error: "Select eligible products before enabling the campaign." };
  }

  const data = {
    name: d.name,
    isActive: d.isActive,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    prizes: d.prizes.map((p) => ({ percent: p.percent, weight: p.weight })),
    eligibleVariantIds,
    minStock: d.minStock,
    weightCap: d.weightCap,
    claimWindowHours: d.claimWindowHours,
    offerValidDays: d.offerValidDays,
    maxClaims: d.maxClaims ?? null,
    minOrder: d.minOrder ?? null,
    maxDiscount: d.maxDiscount ?? null,
    saleMode: d.saleMode,
  };

  try {
    const saved = d.id
      ? await prisma.spinCampaign.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.spinCampaign.create({ data, select: { id: true } });
    revalidate();
    return { ok: true, data: saved };
  } catch (err) {
    console.error("[admin/spin] save failed:", err);
    return { ok: false, error: "Couldn't save the campaign." };
  }
}

/** Pause / resume. Pausing stops new spins; history and claimed offers are kept. */
export async function setSpinCampaignActive(id: string, isActive: boolean): Promise<AdminResult> {
  await requirePermission("coupons");
  if (typeof id !== "string" || !id) return { ok: false, error: "Invalid campaign." };
  const c = await prisma.spinCampaign.findUnique({ where: { id }, select: { eligibleVariantIds: true } });
  if (!c) return { ok: false, error: "Campaign not found." };
  if (isActive && c.eligibleVariantIds.length === 0) {
    return { ok: false, error: "Select eligible products before enabling the campaign." };
  }
  await prisma.spinCampaign.update({ where: { id }, data: { isActive: Boolean(isActive) } });
  revalidate();
  return { ok: true };
}

/** Delete only a campaign that was never played; otherwise pause it to keep history. */
export async function deleteSpinCampaign(id: string): Promise<AdminResult> {
  await requirePermission("coupons");
  if (typeof id !== "string" || !id) return { ok: false, error: "Invalid campaign." };
  const spins = await prisma.spinResult.count({ where: { campaignId: id } });
  if (spins > 0) {
    return { ok: false, error: "This campaign has spins on record — pause it instead to keep its history." };
  }
  await prisma.spinCampaign.delete({ where: { id } });
  revalidate();
  return { ok: true };
}
