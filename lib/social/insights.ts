import "server-only";
import { prisma } from "@/lib/prisma";
import { isConfigured } from "@/lib/env";
import { igGraphGet } from "@/lib/social/instagram";

/**
 * Fetches real engagement for published posts from the Instagram Graph API and
 * stores it on the SocialPost row, so the analytics dashboard shows true
 * numbers instead of empty fields.
 *
 * Two calls per media (both best-effort, partial success is fine):
 *  - fields=like_count,comments_count → immediate, always available.
 *  - /insights?metric=reach,saved,shares → accrues over time; some metrics are
 *    unavailable for very new media or certain media types (we ignore misses).
 *
 * Keyless/unconfigured: a no-op (nothing to sync without a token).
 */

type InsightsPatch = {
  likes?: number;
  comments?: number;
  reach?: number;
  saved?: number;
  shares?: number;
};

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Parse the Graph insights response ({data:[{name,values:[{value}]}]}). */
function parseInsights(json: Record<string, unknown>): InsightsPatch {
  const out: InsightsPatch = {};
  const data = json.data;
  if (!Array.isArray(data)) return out;
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const name = (item as { name?: string }).name;
    const values = (item as { values?: unknown }).values;
    const value = Array.isArray(values)
      ? num((values[0] as { value?: unknown } | undefined)?.value)
      : undefined;
    if (value === undefined) continue;
    if (name === "reach") out.reach = value;
    else if (name === "saved") out.saved = value;
    else if (name === "shares") out.shares = value;
  }
  return out;
}

/** Fetch + persist engagement for one published post. Returns true if anything
 *  was updated. */
export async function syncPostInsights(postId: string, mediaId: string): Promise<boolean> {
  if (!isConfigured.instagram()) return false;

  const patch: InsightsPatch = {};

  // 1) Like/comment counts — always available on the media node.
  const counts = await igGraphGet(mediaId, { fields: "like_count,comments_count" });
  if (counts.ok) {
    patch.likes = num(counts.json.like_count);
    patch.comments = num(counts.json.comments_count);
  }

  // 2) Insight metrics live on the /insights edge — best-effort; a new media or
  //    an unsupported metric for the media type just yields no data (we skip).
  const insights = await igGraphGet(`${mediaId}/insights`, { metric: "reach,saved,shares" });
  if (insights.ok) Object.assign(patch, parseInsights(insights.json));

  const hasData = Object.values(patch).some((v) => v !== undefined);
  await prisma.socialPost.update({
    where: { id: postId },
    data: { ...patch, insightsAt: new Date() },
  });
  return hasData;
}

/**
 * Refresh insights for recently published posts (called from the social cron
 * after publishing). Bounded so a cron run stays fast; prioritises posts never
 * synced or synced longest ago.
 */
export async function syncRecentInsights(now = new Date()): Promise<{ synced: number }> {
  if (!isConfigured.instagram()) return { synced: 0 };

  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // last 30 days
  const posts = await prisma.socialPost.findMany({
    where: {
      status: "PUBLISHED",
      externalId: { not: null },
      publishedAt: { gte: since },
    },
    orderBy: [{ insightsAt: { sort: "asc", nulls: "first" } }],
    take: 20,
    select: { id: true, externalId: true },
  });

  let synced = 0;
  for (const p of posts) {
    if (!p.externalId) continue;
    try {
      await syncPostInsights(p.id, p.externalId);
      synced++;
    } catch (e) {
      console.error(`[social] insights sync failed for ${p.id}:`, e);
    }
  }
  return { synced };
}
