import "server-only";
import type { Prisma, CampaignStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureBuiltInTemplates } from "@/lib/marketing/templates";

export async function getCampaigns(filters: { status?: string; q?: string } = {}) {
  const where: Prisma.CampaignWhereInput = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status as CampaignStatus;
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
    ];
  }
  return prisma.campaign.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 });
}

export async function getCampaign(id: string) {
  return prisma.campaign.findUnique({ where: { id } });
}

/** Aggregate marketing performance + recent activity for the overview dashboard. */
export async function getMarketingOverview() {
  const [agg, total, statusGroups, recent] = await Promise.all([
    prisma.campaign.aggregate({
      where: { status: "SENT" },
      _sum: {
        sentCount: true,
        deliveredCount: true,
        openCount: true,
        clickCount: true,
        conversionCount: true,
        revenue: true,
      },
    }),
    prisma.campaign.count(),
    prisma.campaign.groupBy({ by: ["status"], _count: true }),
    prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const s = agg._sum;
  return {
    totals: {
      campaigns: total,
      sent: s.sentCount ?? 0,
      delivered: s.deliveredCount ?? 0,
      opened: s.openCount ?? 0,
      clicked: s.clickCount ?? 0,
      conversions: s.conversionCount ?? 0,
      revenue: s.revenue ?? 0,
    },
    byStatus: Object.fromEntries(statusGroups.map((g) => [g.status, g._count])) as Record<string, number>,
    recent,
  };
}

export async function getSegments() {
  return prisma.audienceSegment.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getAutomationRules() {
  return prisma.automationRule.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getTemplates() {
  await ensureBuiltInTemplates();
  return prisma.campaignTemplate.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
  });
}

/** Products / coupons / categories / saved segments / templates for the compose editor. */
export async function getComposeData() {
  await ensureBuiltInTemplates();
  const [products, coupons, categories, segments, templates] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    prisma.coupon.findMany({ where: { isActive: true }, select: { id: true, code: true }, orderBy: { code: "asc" }, take: 200 }),
    prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.audienceSegment.findMany({ orderBy: { name: "asc" } }),
    prisma.campaignTemplate.findMany({ orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }] }),
  ]);
  return { products, coupons, categories, segments, templates };
}
