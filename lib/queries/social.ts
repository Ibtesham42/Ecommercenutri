import { prisma } from "@/lib/prisma";
import type {
  SocialPost,
  SocialPostStatus,
  SocialCampaign,
  SocialTemplate,
} from "@prisma/client";
import { isConfigured } from "@/lib/env";
import { getSocialSettings, type SocialSettings } from "@/lib/social/settings";

/**
 * Read helpers for the AI Marketing admin. Posts store `productId` as a plain id
 * (no FK, matching the Campaign convention), so post lists are enriched with the
 * product name in a single batched lookup.
 */

export type SocialPostRow = SocialPost & { productName: string | null };

async function enrich(posts: SocialPost[]): Promise<SocialPostRow[]> {
  const ids = [...new Set(posts.map((p) => p.productId).filter((x): x is string => Boolean(x)))];
  const names = ids.length
    ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(names.map((n) => [n.id, n.name]));
  return posts.map((p) => ({ ...p, productName: p.productId ? nameById.get(p.productId) ?? null : null }));
}

export type SocialOverview = {
  counts: Record<SocialPostStatus, number>;
  totalCampaigns: number;
  enabledCampaigns: number;
  productsPromoted: number;
  recent: SocialPostRow[];
  instagramConnected: boolean;
  aiConfigured: boolean;
  settings: SocialSettings;
};

const ALL_STATUSES: SocialPostStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
];

export async function getSocialOverview(): Promise<SocialOverview> {
  const [grouped, totalCampaigns, enabledCampaigns, promoted, recentRaw, settings] =
    await Promise.all([
      prisma.socialPost.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.socialCampaign.count(),
      prisma.socialCampaign.count({ where: { enabled: true } }),
      prisma.socialPost.findMany({
        where: { status: "PUBLISHED", productId: { not: null } },
        select: { productId: true },
        distinct: ["productId"],
      }),
      prisma.socialPost.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
      getSocialSettings(),
    ]);

  const counts = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<
    SocialPostStatus,
    number
  >;
  for (const g of grouped) counts[g.status] = g._count._all;

  return {
    counts,
    totalCampaigns,
    enabledCampaigns,
    productsPromoted: promoted.length,
    recent: await enrich(recentRaw),
    instagramConnected: isConfigured.instagram(),
    aiConfigured: isConfigured.groq(),
    settings,
  };
}

/** Posts filtered by a set of statuses (queue = DRAFT+PENDING_APPROVAL, etc.). */
export async function getSocialPosts(statuses: SocialPostStatus[]): Promise<SocialPostRow[]> {
  const posts = await prisma.socialPost.findMany({
    where: { status: { in: statuses } },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  return enrich(posts);
}

export async function getSocialCampaigns(): Promise<SocialCampaign[]> {
  return prisma.socialCampaign.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getSocialTemplates(): Promise<SocialTemplate[]> {
  return prisma.socialTemplate.findMany({ orderBy: [{ pillar: "asc" }, { name: "asc" }] });
}

export type SocialProductOption = { id: string; name: string; image: string | null };

/** Active products for the campaign product multiselect. */
export async function getSocialProductOptions(): Promise<SocialProductOption[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    take: 300,
    select: {
      id: true,
      name: true,
      images: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } },
    },
  });
  return products.map((p) => ({ id: p.id, name: p.name, image: p.images[0]?.url ?? null }));
}

export type SocialTopPost = {
  id: string;
  hook: string;
  productName: string | null;
  permalink: string | null;
  engagement: number;
  likes: number;
  comments: number;
  saved: number;
};

export type SocialAnalytics = {
  totalPublished: number;
  totalFailed: number;
  totalRetries: number; // sum of auto-retry attempts across all posts
  successRate: number; // 0-100
  byPillar: { pillar: string; count: number }[];
  byDaypart: { daypart: string; count: number }[];
  topProducts: { productId: string; name: string; count: number }[];
  topPosts: SocialTopPost[]; // best-performing published posts by real engagement
  /** Best daypart by AVERAGE engagement; `basis` says whether that's real
   *  engagement data or just post volume (when no insights yet). */
  bestDaypart: { daypart: string; basis: "engagement" | "volume" } | null;
  hasEngagementData: boolean;
  engagement: {
    reach: number;
    impressions: number;
    likes: number;
    comments: number;
    saved: number;
    shares: number;
    clicks: number;
  };
};

export async function getSocialAnalytics(): Promise<SocialAnalytics> {
  const [published, failed, retrySum, pillarGroups, daypartGroups, productGroups, sums, pubPosts] =
    await Promise.all([
      prisma.socialPost.count({ where: { status: "PUBLISHED" } }),
      prisma.socialPost.count({ where: { status: "FAILED" } }),
      prisma.socialPost.aggregate({ _sum: { retryCount: true } }),
      prisma.socialPost.groupBy({
        by: ["pillar"],
        where: { status: "PUBLISHED" },
        _count: { _all: true },
      }),
      prisma.socialPost.groupBy({
        by: ["daypart"],
        where: { status: "PUBLISHED" },
        _count: { _all: true },
      }),
      prisma.socialPost.groupBy({
        by: ["productId"],
        where: { status: "PUBLISHED", productId: { not: null } },
        _count: { _all: true },
      }),
      prisma.socialPost.aggregate({
        where: { status: "PUBLISHED" },
        _sum: {
          reach: true, impressions: true, likes: true,
          comments: true, saved: true, shares: true, clicks: true,
        },
      }),
      prisma.socialPost.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 500,
        select: {
          id: true, hook: true, caption: true, productId: true, permalink: true,
          daypart: true, likes: true, comments: true, saved: true, shares: true,
        },
      }),
    ]);

  const topIds = productGroups
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 5)
    .map((g) => g.productId)
    .filter((x): x is string => Boolean(x));

  // Best-performing posts by real engagement (likes+comments+saved+shares).
  const eng = (p: { likes: number | null; comments: number | null; saved: number | null; shares: number | null }) =>
    (p.likes ?? 0) + (p.comments ?? 0) + (p.saved ?? 0) + (p.shares ?? 0);
  const hasEngagementData = pubPosts.some((p) => eng(p) > 0);

  const postProductIds = [...new Set(pubPosts.map((p) => p.productId).filter((x): x is string => Boolean(x)))];
  const names = [...new Set([...topIds, ...postProductIds])].length
    ? await prisma.product.findMany({
        where: { id: { in: [...new Set([...topIds, ...postProductIds])] } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(names.map((n) => [n.id, n.name]));

  const topPosts: SocialTopPost[] = [...pubPosts]
    .sort((a, b) => eng(b) - eng(a))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      hook: p.hook || p.caption.split("\n")[0],
      productName: p.productId ? nameById.get(p.productId) ?? null : null,
      permalink: p.permalink,
      engagement: eng(p),
      likes: p.likes ?? 0,
      comments: p.comments ?? 0,
      saved: p.saved ?? 0,
    }));

  // Best daypart: prefer real average engagement; fall back to post volume.
  const dpStats = new Map<string, { total: number; count: number }>();
  for (const p of pubPosts) {
    const s = dpStats.get(p.daypart) ?? { total: 0, count: 0 };
    s.total += eng(p);
    s.count += 1;
    dpStats.set(p.daypart, s);
  }
  let bestDaypart: SocialAnalytics["bestDaypart"] = null;
  if (hasEngagementData) {
    const ranked = [...dpStats.entries()]
      .map(([daypart, s]) => ({ daypart, avg: s.count ? s.total / s.count : 0 }))
      .sort((a, b) => b.avg - a.avg);
    if (ranked[0]) bestDaypart = { daypart: ranked[0].daypart, basis: "engagement" };
  } else {
    const byVolume = [...daypartGroups].sort((a, b) => b._count._all - a._count._all)[0];
    if (byVolume) bestDaypart = { daypart: byVolume.daypart, basis: "volume" };
  }

  return {
    totalPublished: published,
    totalFailed: failed,
    totalRetries: retrySum._sum.retryCount ?? 0,
    successRate: published + failed > 0 ? Math.round((published / (published + failed)) * 100) : 0,
    byPillar: pillarGroups.map((g) => ({ pillar: g.pillar, count: g._count._all })),
    byDaypart: daypartGroups.map((g) => ({ daypart: g.daypart, count: g._count._all })),
    topProducts: topIds.map((id) => ({
      productId: id,
      name: nameById.get(id) ?? "Unknown",
      count: productGroups.find((g) => g.productId === id)?._count._all ?? 0,
    })),
    topPosts,
    bestDaypart,
    hasEngagementData,
    engagement: {
      reach: sums._sum.reach ?? 0,
      impressions: sums._sum.impressions ?? 0,
      likes: sums._sum.likes ?? 0,
      comments: sums._sum.comments ?? 0,
      saved: sums._sum.saved ?? 0,
      shares: sums._sum.shares ?? 0,
      clicks: sums._sum.clicks ?? 0,
    },
  };
}
