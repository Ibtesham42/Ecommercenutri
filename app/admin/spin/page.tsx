import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { approvedSuggestionFor, resolvePrizes } from "@/lib/spin/config";
import { eligibilityDrift, isEligibilityVerified, sizeGrams } from "@/lib/spin/eligibility";
import { loadReservations } from "@/lib/spin/service";
import { spinFunnel } from "@/lib/spin/stats";
import {
  SpinManager,
  type SpinCampaignRow,
  type SpinEligibleVariant,
  type SpinVariantOption,
} from "@/components/admin/spin-manager";

export const metadata: Metadata = { title: "Spin & Win", robots: { index: false } };

export default async function AdminSpinPage() {
  await guardSection("coupons");

  const now = new Date();
  const [campaigns, statusCounts, staleCounts, percentCounts, variants, reserved] = await Promise.all([
    prisma.spinCampaign.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.spinResult.groupBy({ by: ["campaignId", "status"], _count: { _all: true } }),
    // AWARDED wins already past their claim deadline (not yet marked EXPIRED).
    prisma.spinResult.groupBy({
      by: ["campaignId"],
      where: { status: "AWARDED", expiresAt: { lte: now } },
      _count: { _all: true },
    }),
    prisma.spinResult.groupBy({ by: ["campaignId", "percent"], _count: { _all: true } }),
    prisma.productVariant.findMany({
      where: { product: { isActive: true } },
      orderBy: [{ product: { name: "asc" } }, { weightInGrams: "asc" }],
      select: {
        id: true,
        weightLabel: true,
        weightInGrams: true,
        stock: true,
        isActive: true,
        price: true,
        discountPrice: true,
        product: { select: { id: true, name: true, isActive: true } },
      },
    }),
    loadReservations(prisma, now),
  ]);

  // Exact catalogue facts for every variant any campaign lists (active or not),
  // for the verification table + drift check.
  const listedIds = [...new Set(campaigns.flatMap((c) => c.eligibleVariantIds))];
  const verifierIds = [...new Set(campaigns.map((c) => c.eligibilityVerifiedById).filter((x): x is string => !!x))];
  const [listed, verifiers] = await Promise.all([
    prisma.productVariant.findMany({
      where: { id: { in: listedIds } },
      select: {
        id: true,
        productId: true,
        weightLabel: true,
        weightInGrams: true,
        stock: true,
        price: true,
        isActive: true,
        product: { select: { name: true, isActive: true } },
      },
    }),
    prisma.user.findMany({ where: { id: { in: verifierIds } }, select: { id: true, name: true, email: true } }),
  ]);
  const listedById = new Map(listed.map((v) => [v.id, v]));
  const verifierName = new Map(verifiers.map((u) => [u.id, u.name || u.email]));

  const rows: SpinCampaignRow[] = campaigns.map((c) => {
    const eligible: SpinEligibleVariant[] = c.eligibleVariantIds.flatMap((id) => {
      const v = listedById.get(id);
      if (!v) return [];
      return [
        {
          variantId: v.id,
          productId: v.productId,
          productName: v.product.name,
          weightLabel: v.weightLabel,
          grams: sizeGrams(v),
          stock: v.stock,
          price: v.price,
          active: v.isActive && v.product.isActive,
          suggestion: approvedSuggestionFor(v.product.name, v.weightLabel, v.weightInGrams),
        },
      ];
    });
    const drift = eligibilityDrift(
      c.eligibilitySnapshot,
      listed.map((v) => ({
        variantId: v.id,
        productId: v.productId,
        productName: v.product.name,
        weightLabel: v.weightLabel,
        weightInGrams: v.weightInGrams,
      })),
    );
    const count = (status: string) =>
      statusCounts.find((s) => s.campaignId === c.id && s.status === status)?._count._all ?? 0;
    const funnel = spinFunnel({
      awarded: count("AWARDED"),
      awardedPastDeadline: staleCounts.find((s) => s.campaignId === c.id)?._count._all ?? 0,
      claimed: count("CLAIMED"),
      redeemed: count("REDEEMED"),
      expired: count("EXPIRED"),
    });
    return {
      id: c.id,
      name: c.name,
      isActive: c.isActive,
      startsAt: c.startsAt?.toISOString() ?? null,
      endsAt: c.endsAt?.toISOString() ?? null,
      prizes: resolvePrizes(c.prizes),
      eligibleVariantIds: c.eligibleVariantIds,
      minStock: c.minStock,
      weightCap: c.weightCap,
      claimWindowHours: c.claimWindowHours,
      offerValidDays: c.offerValidDays,
      maxClaims: c.maxClaims,
      claimCount: c.claimCount,
      minOrder: c.minOrder,
      maxDiscount: c.maxDiscount,
      saleMode: c.saleMode,
      eligible,
      verification: {
        verified: isEligibilityVerified(c),
        verifiedAt: c.eligibilityVerifiedAt?.toISOString() ?? null,
        verifiedBy: c.eligibilityVerifiedById ? (verifierName.get(c.eligibilityVerifiedById) ?? "a former admin") : null,
        missing: drift.missing.map((m) => `${m.productName} ${m.weightLabel}`),
        changed: drift.changed.map(
          (d) => `${d.was.productName} ${d.was.weightLabel} → ${d.now.productName} ${d.now.weightLabel}`,
        ),
        renamed: drift.renamed.map((d) => `${d.was.productName} → ${d.now.productName}`),
        unlisted: c.eligibleVariantIds.length - eligible.length,
      },
      stats: {
        ...funnel,
        byPercent: percentCounts
          .filter((p) => p.campaignId === c.id)
          .map((p) => ({ percent: p.percent, count: p._count._all }))
          .sort((a, b) => a.percent - b.percent),
      },
    };
  });

  const options: SpinVariantOption[] = variants.map((v) => ({
    id: v.id,
    productId: v.product.id,
    productName: v.product.name,
    weightLabel: v.weightLabel,
    weightInGrams: v.weightInGrams,
    stock: v.stock,
    active: v.isActive && v.product.isActive,
    onSale: v.discountPrice != null && v.discountPrice > 0 && v.discountPrice < v.price,
    productReserved: reserved.get(v.product.id) ?? 0,
  }));

  return (
    <div>
      <PageHeader
        title="Spin & Win"
        description="Inventory-aware discount wheel. Wins become personal single-use coupons, redeemed at checkout."
      />
      <SpinManager campaigns={rows} variants={options} />
    </div>
  );
}
