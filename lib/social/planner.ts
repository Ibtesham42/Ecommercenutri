import "server-only";
import type { Prisma, SocialDaypart, SocialPostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice, effectivePrice, discountPercent } from "@/lib/format";
import { getSocialSettings } from "@/lib/social/settings";
import { pickPostImages } from "@/lib/social/image";
import { slotFor, angleAt } from "@/lib/social/strategy";
import {
  generateUniqueSocialPost,
  type SocialProductContext,
} from "@/lib/social/ai";
import { pickTemplateGuidance } from "@/lib/social/templates";
import { pickStyle } from "@/lib/social/styles";
import { COMPARE_WINDOW, type RecentPost } from "@/lib/social/uniqueness";
import {
  pickDesign,
  buildDesignedImageUrl,
  buildCarouselFrameUrl,
} from "@/lib/social/design";
import { paletteForImage } from "@/lib/social/palette";

/**
 * The planner turns enabled SocialCampaigns into concrete SocialPost rows for
 * the day's slots (morning/evening), generating content from real product data.
 * Idempotent: it never creates a second post for the same campaign + daypart on
 * the same IST day, and skips exact-duplicate content (contentHash). Called by
 * the social cron before publishing. Mirrors the Marketing Hub's due-queue idea.
 */

const IST_OFFSET_MS = 330 * 60 * 1000; // IST = UTC+5:30, no DST
const PAST_SLOT_GRACE_MS = 3 * 60 * 60 * 1000; // don't plan slots >3h in the past

type IstParts = { year: number; month: number; day: number; weekday: number };

function istParts(now: Date): IstParts {
  const d = new Date(now.getTime() + IST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(), // 0=Sun..6=Sat, in IST
  };
}

function weekOfMonthIST(day: number): number {
  return Math.min(4, Math.floor((day - 1) / 7) + 1);
}

/** UTC instant for "today at HH:mm IST" relative to `now`. */
export function scheduledUtc(now: Date, hhmm: string): Date {
  const p = istParts(now);
  const [h, m] = hhmm.split(":").map((x) => Number(x) || 0);
  // Build the IST wall-clock instant as if it were UTC, then shift back to real UTC.
  const wall = Date.UTC(p.year, p.month, p.day, h, m);
  return new Date(wall - IST_OFFSET_MS);
}

/** [start, end) UTC range covering the current IST calendar day. */
function istDayRange(now: Date): { start: Date; end: Date } {
  const p = istParts(now);
  const startWall = Date.UTC(p.year, p.month, p.day, 0, 0);
  const start = new Date(startWall - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

type NutritionFact = { label: string; value: string };

function toNutritionFacts(json: Prisma.JsonValue | null): NutritionFact[] | null {
  if (!Array.isArray(json)) return null;
  const facts = json
    .map((f) =>
      f && typeof f === "object" && "label" in f && "value" in f
        ? { label: String((f as NutritionFact).label), value: String((f as NutritionFact).value) }
        : null,
    )
    .filter((f): f is NutritionFact => Boolean(f));
  return facts.length ? facts : null;
}

const PRODUCT_SELECT = {
  id: true,
  name: true,
  shortDescription: true,
  description: true,
  ingredients: true,
  benefits: true,
  nutritionFacts: true,
  isFeatured: true,
  category: { select: { name: true } },
  brand: { select: { name: true } },
  images: { select: { url: true, isMain: true, sortOrder: true } },
  variants: {
    where: { isActive: true },
    select: { price: true, discountPrice: true, stock: true, images: true },
  },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

function toContext(p: ProductRow): SocialProductContext {
  const prices = p.variants.map((v) => effectivePrice(v.price, v.discountPrice));
  const minPrice = prices.length ? Math.min(...prices) : null;
  // Best discount across variants (largest percent off).
  let bestPct: number | null = null;
  for (const v of p.variants) {
    const pct = discountPercent(v.price, v.discountPrice);
    if (pct && (bestPct === null || pct > bestPct)) bestPct = pct;
  }
  return {
    id: p.id,
    name: p.name,
    shortDescription: p.shortDescription,
    description: p.description,
    ingredients: p.ingredients,
    benefits: p.benefits,
    nutritionFacts: toNutritionFacts(p.nutritionFacts),
    categoryName: p.category?.name ?? null,
    brandName: p.brand?.name ?? null,
    priceLabel: minPrice != null ? formatPrice(minPrice) : null,
    discountLabel: bestPct ? `${bestPct}% off` : null,
    inStock: p.variants.some((v) => v.stock > 0),
  };
}

/** A post with no image can never publish — Instagram requires one, so the post
 *  would fail, burn all 3 retries and sit FAILED forever. Never plan one. */
function hasImage(p: ProductRow): boolean {
  return p.images.length > 0 || p.variants.some((v) => v.images.length > 0);
}

/** Products a campaign draws from, in order. Falls back to active/featured. */
async function resolveCampaignProducts(productIds: string[]): Promise<ProductRow[]> {
  if (productIds.length > 0) {
    const rows = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: PRODUCT_SELECT,
    });
    // Preserve the admin's chosen order.
    const byId = new Map(rows.map((r) => [r.id, r]));
    return productIds
      .map((id) => byId.get(id))
      .filter((r): r is ProductRow => Boolean(r))
      .filter(hasImage);
  }
  const rows = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: PRODUCT_SELECT,
  });
  return rows.filter(hasImage);
}

/**
 * Build the AI generation context + publish images for one product. Shared by
 * the planner and the admin "generate / regenerate" actions.
 */
export async function buildSocialMaterials(
  productId: string,
  carousel: boolean,
): Promise<{ ctx: SocialProductContext; imageUrls: string[] } | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: PRODUCT_SELECT,
  });
  if (!product) return null;
  return { ctx: toContext(product), imageUrls: pickPostImages(product, carousel) };
}

const STATUS_FOR_MODE: Record<string, SocialPostStatus> = {
  DRAFT: "DRAFT",
  MANUAL_APPROVAL: "PENDING_APPROVAL",
  AUTO_PUBLISH: "SCHEDULED",
};

export type PlanReport = { planned: number; skipped: number; campaigns: number };

export async function planDuePosts(now = new Date()): Promise<PlanReport> {
  const settings = await getSocialSettings();
  if (!settings.enabled) return { planned: 0, skipped: 0, campaigns: 0 };

  const campaigns = await prisma.socialCampaign.findMany({ where: { enabled: true } });
  const ist = istParts(now);
  const { start, end } = istDayRange(now);

  // Recent posts — the corpus the uniqueness engine compares every candidate
  // against (full caption/cta/tags, not just the hook).
  const recent = await prisma.socialPost.findMany({
    orderBy: { createdAt: "desc" },
    take: COMPARE_WINDOW,
    select: {
      hook: true, caption: true, cta: true, hashtags: true,
      styleKey: true, designKey: true,
    },
  });
  const recentPosts: RecentPost[] = recent.map((r) => ({
    hook: r.hook,
    caption: r.caption,
    cta: r.cta,
    hashtags: r.hashtags,
  }));
  const recentHooks = recent.map((r) => r.hook).filter(Boolean);
  const recentCtas = recent.map((r) => r.cta).filter(Boolean);
  // Keep duplicates here — the tag sanitizer uses frequency to spot overuse.
  const recentHashtags = recent.flatMap((r) => r.hashtags);
  const recentStyles = recent.map((r) => r.styleKey).filter((k): k is string => Boolean(k));
  const recentDesigns = recent.map((r) => r.designKey).filter((k): k is string => Boolean(k));

  let planned = 0;
  let skipped = 0;
  let activeCampaigns = 0;

  for (const c of campaigns) {
    if (c.startsAt && c.startsAt > now) continue;
    if (c.endsAt && c.endsAt < now) continue;
    if (!c.days.includes(ist.weekday)) continue;
    activeCampaigns++;

    const products = await resolveCampaignProducts(c.productIds);
    if (products.length === 0) continue;

    // Dayparts for today, limited by maxPerDay (max 2 real slots).
    const dayparts: { daypart: SocialDaypart; time: string }[] = (
      [
        { daypart: "MORNING", time: c.morningTime },
        { daypart: "EVENING", time: c.eveningTime },
      ] as { daypart: SocialDaypart; time: string }[]
    ).slice(0, Math.max(1, Math.min(2, c.maxPerDay)));

    // Rotation base: how many posts this campaign has produced so far.
    const baseCount = await prisma.socialPost.count({ where: { campaignId: c.id } });
    let createdThisRun = 0;

    for (const { daypart, time } of dayparts) {
      const scheduledFor = scheduledUtc(now, time);
      if (scheduledFor.getTime() < now.getTime() - PAST_SLOT_GRACE_MS) continue;

      // One post per campaign+daypart+IST-day.
      const exists = await prisma.socialPost.findFirst({
        where: { campaignId: c.id, daypart, scheduledFor: { gte: start, lt: end } },
        select: { id: true },
      });
      if (exists) continue;

      const rotation = baseCount + createdThisRun;
      const product = products[rotation % products.length];
      const week = weekOfMonthIST(ist.day);
      const slot = slotFor(week, daypart);
      const angle = angleAt(slot, rotation);
      const ctx = toContext(product);

      // The pillar is pinned to week+daypart, so the STYLE is what keeps
      // consecutive posts from reading alike. Never repeats the previous style.
      const style = pickStyle(rotation, recentStyles, true);

      const templateGuidance = await pickTemplateGuidance(slot.pillar, rotation);
      const gen = await generateUniqueSocialPost(
        {
          product: ctx,
          pillar: slot.pillar,
          daypart,
          angle,
          brandVoice: settings.brandVoice,
          defaultHashtags: settings.defaultHashtags,
          bannedWords: settings.bannedWords,
          recentHooks,
          recentHashtags,
          recentCtas,
          templateGuidance,
          styleLabel: style.label,
          styleBrief: style.brief,
          rotation,
        },
        recentPosts,
      );
      if (!gen.ok) {
        // AI_RATE_LIMITED means the model is configured but out of budget. The
        // slot is deliberately left unplanned: the cron fires every 30 minutes,
        // so a later pass will fill it with a REAL post rather than persisting
        // the flat keyless fallback and publishing it as if it were genuine.
        if (gen.error === "AI_RATE_LIMITED") {
          console.warn(
            `[social] campaign ${c.id} ${daypart}: AI rate-limited — leaving the slot for the next run`,
          );
        }
        skipped++;
        continue;
      }
      if (gen.forced) {
        // Every retry still clashed. We ship the best candidate rather than
        // leave the slot empty (the old behaviour), but it's worth knowing.
        console.warn(
          `[social] campaign ${c.id} ${daypart}: shipped a post that still echoes a recent ${gen.forced}`,
        );
      }

      // Belt-and-braces: never write a byte-identical caption.
      const dup = await prisma.socialPost.findFirst({
        where: { contentHash: gen.data.contentHash },
        select: { id: true },
      });
      if (dup) {
        skipped++;
        continue;
      }

      // Design the cover: colours derived from the product photo itself, and a
      // template that isn't the one the last posts used. The remaining carousel
      // frames stay as the plain product photos.
      const rawImages = pickPostImages(product, settings.carouselEnabled);
      const design = pickDesign(rotation, recentDesigns);
      const palette = await paletteForImage(rawImages[0]);
      const imageUrls = rawImages.length
        ? [
            buildDesignedImageUrl({
              imageUrl: rawImages[0],
              headline: gen.data.headline,
              support: gen.data.support,
              template: design,
              palette,
            }),
            // Frames share the cover's square canvas — Instagram crops a
            // carousel to the FIRST item's aspect, so a raw 3:4 photo here
            // would be cropped into the product.
            ...rawImages.slice(1).map((u) => buildCarouselFrameUrl(u, palette)),
          ]
        : [];
      const status = STATUS_FOR_MODE[c.mode] ?? "PENDING_APPROVAL";

      await prisma.socialPost.create({
        data: {
          platform: c.platforms[0] ?? "INSTAGRAM",
          status,
          pillar: slot.pillar,
          daypart,
          weekOfMonth: week,
          productId: product.id,
          campaignId: c.id,
          hook: gen.data.hook,
          caption: gen.data.caption,
          captionLong: gen.data.captionLong,
          cta: gen.data.cta,
          hashtags: gen.data.hashtags,
          altText: gen.data.altText,
          imageUrls,
          contentHash: gen.data.contentHash,
          styleKey: style.key,
          headline: gen.data.headline,
          designKey: design.key,
          // Always record the intended slot time so the per-slot idempotency
          // guard works for every mode (the publisher only acts on SCHEDULED).
          scheduledFor,
        },
      });

      // Feed this post back into the in-run corpus so the SECOND slot of the
      // same run is checked against the first (previously it was not).
      recentPosts.unshift({
        hook: gen.data.hook,
        caption: gen.data.caption,
        cta: gen.data.cta,
        hashtags: gen.data.hashtags,
      });
      recentHooks.unshift(gen.data.hook);
      recentCtas.unshift(gen.data.cta);
      recentHashtags.unshift(...gen.data.hashtags);
      recentStyles.unshift(style.key);
      recentDesigns.unshift(design.key);
      planned++;
      createdThisRun++;
    }

    await prisma.socialCampaign.update({
      where: { id: c.id },
      data: { lastPlannedAt: now },
    });
  }

  return { planned, skipped, campaigns: activeCampaigns };
}
