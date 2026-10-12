import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { resolvePrizes } from "@/lib/spin/config";
import { loadReservations } from "@/lib/spin/service";
import { spinFunnel } from "@/lib/spin/stats";
import {
  SpinManager,
  type SpinCampaignRow,
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

  const rows: SpinCampaignRow[] = campaigns.map((c) => {
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
