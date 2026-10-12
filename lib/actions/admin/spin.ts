"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { spinCampaignSchema, verifyEligibilitySchema } from "@/lib/validations/spin";
import {
  eligibilityDrift,
  hasBlockingDrift,
  isEligibilityVerified,
  sameIdSet,
  type CatalogueVariant,
  type EligibilitySnapshotItem,
} from "@/lib/spin/eligibility";
import type { AdminResult } from "@/lib/actions/admin/types";

// Spin & Win is a promotion built on coupons → governed by the existing
// "coupons" permission (no new RBAC key).

const NEEDS_VERIFICATION =
  "Verify the eligible products against the live catalogue before enabling this campaign.";

/** Current catalogue facts (product + size) for a set of variant IDs. */
async function catalogueFor(variantIds: readonly string[]): Promise<CatalogueVariant[]> {
  if (variantIds.length === 0) return [];
  const rows = await prisma.productVariant.findMany({
    where: { id: { in: [...variantIds] } },
    select: { id: true, productId: true, weightLabel: true, weightInGrams: true, product: { select: { name: true } } },
  });
  return rows.map((v) => ({
    variantId: v.id,
    productId: v.productId,
    productName: v.product.name,
    weightLabel: v.weightLabel,
    weightInGrams: v.weightInGrams,
  }));
}

/** Enabling is allowed only for a verified list whose products/sizes haven't changed since. */
async function enableBlocker(c: {
  eligibleVariantIds: string[];
  eligibilityVerifiedAt: Date | null;
  eligibilitySnapshot: Prisma.JsonValue;
}): Promise<string | null> {
  if (c.eligibleVariantIds.length === 0) return "Select eligible products before enabling the campaign.";
  if (!isEligibilityVerified(c)) return NEEDS_VERIFICATION;
  const drift = eligibilityDrift(c.eligibilitySnapshot, await catalogueFor(c.eligibleVariantIds));
  if (hasBlockingDrift(drift)) {
    return "The catalogue changed since the eligible products were verified (a variant was removed or its product/size changed). Re-verify before enabling.";
  }
  return null;
}

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

  // Any change to the eligible list voids the verification: the new list must
  // be checked against the live catalogue before the campaign can run again.
  const current = d.id
    ? await prisma.spinCampaign.findUnique({
        where: { id: d.id },
        select: { eligibleVariantIds: true, eligibilityVerifiedAt: true, eligibilitySnapshot: true },
      })
    : null;
  if (d.id && !current) return { ok: false, error: "Campaign not found." };
  const keepVerification = Boolean(current && sameIdSet(current.eligibleVariantIds, eligibleVariantIds));
  if (d.isActive) {
    const blocker = keepVerification && current ? await enableBlocker({ ...current, eligibleVariantIds }) : NEEDS_VERIFICATION;
    if (blocker) {
      return {
        ok: false,
        error: keepVerification
          ? blocker
          : "Changing the eligible products needs a fresh verification: turn “Enabled” off, save, then verify the list.",
      };
    }
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
    ...(keepVerification
      ? {}
      : { eligibilityVerifiedAt: null, eligibilityVerifiedById: null, eligibilitySnapshot: Prisma.DbNull }),
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
  const c = await prisma.spinCampaign.findUnique({
    where: { id },
    select: { eligibleVariantIds: true, eligibilityVerifiedAt: true, eligibilitySnapshot: true },
  });
  if (!c) return { ok: false, error: "Campaign not found." };
  if (isActive) {
    const blocker = await enableBlocker(c);
    if (blocker) return { ok: false, error: blocker };
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

/**
 * Record that an admin checked this campaign's exact variant IDs and sizes
 * against the live catalogue. `variantIds` must be exactly the list the admin
 * reviewed — if the campaign's list changed meanwhile, nothing is recorded.
 * Verifying never enables the campaign; that stays a separate, explicit step.
 */
export async function verifySpinEligibility(input: unknown): Promise<AdminResult> {
  const admin = await requirePermission("coupons");
  const parsed = verifyEligibilitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid verification." };
  }
  const { id, variantIds } = parsed.data;

  const c = await prisma.spinCampaign.findUnique({ where: { id }, select: { eligibleVariantIds: true } });
  if (!c) return { ok: false, error: "Campaign not found." };
  if (c.eligibleVariantIds.length === 0) return { ok: false, error: "This campaign has no eligible products to verify." };
  if (!sameIdSet(c.eligibleVariantIds, variantIds)) {
    return { ok: false, error: "The eligible list changed since you opened it. Reload and review it again." };
  }

  const catalogue = await catalogueFor(c.eligibleVariantIds);
  if (catalogue.length !== new Set(c.eligibleVariantIds).size) {
    return { ok: false, error: "Some selected variants no longer exist. Edit the campaign, fix the list, then verify." };
  }
  const snapshot: EligibilitySnapshotItem[] = catalogue.map((v) => ({ ...v }));

  // Guard against a concurrent edit between the check above and this write.
  const res = await prisma.spinCampaign.updateMany({
    where: { id, eligibleVariantIds: { equals: c.eligibleVariantIds } },
    data: {
      eligibilityVerifiedAt: new Date(),
      eligibilityVerifiedById: admin.id,
      eligibilitySnapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  });
  if (res.count === 0) {
    return { ok: false, error: "The eligible list changed since you opened it. Reload and review it again." };
  }
  revalidate();
  return { ok: true };
}
