"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { SocialPostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { getSocialSettings } from "@/lib/social/settings";
import { planDuePosts, buildSocialMaterials } from "@/lib/social/planner";
import { publishDuePosts, publishPostNow } from "@/lib/social/publish";
import { syncRecentInsights } from "@/lib/social/insights";
import { generateUniqueSocialPost } from "@/lib/social/ai";
import { slotForPillar, angleAt, weekOfMonth } from "@/lib/social/strategy";
import { ensureBuiltInSocialTemplates, pickTemplateGuidance } from "@/lib/social/templates";
import { pickStyle } from "@/lib/social/styles";
import { COMPARE_WINDOW } from "@/lib/social/uniqueness";
import {
  socialCampaignSchema,
  socialSettingsSchema,
  socialPostEditSchema,
  socialGenerateSchema,
  socialTemplateSchema,
} from "@/lib/validations/social";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

function revalidate() {
  revalidatePath("/admin/social");
  revalidatePath("/admin/social/campaigns");
  revalidatePath("/admin/social/queue");
  revalidatePath("/admin/social/scheduled");
  revalidatePath("/admin/social/calendar");
}

// ── Campaigns ────────────────────────────────────────────────────────────────

export async function saveSocialCampaign(
  input: unknown,
): Promise<AdminResult<{ id: string }>> {
  await requirePermission("social");
  const parsed = socialCampaignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign." };
  }
  const d = parsed.data;
  const data = {
    name: d.name,
    enabled: d.enabled,
    platforms: d.platforms,
    productIds: d.productIds,
    mode: d.mode,
    morningTime: d.morningTime,
    eveningTime: d.eveningTime,
    days: d.days,
    maxPerDay: d.maxPerDay,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
  };
  try {
    let id = d.id;
    if (id) {
      await prisma.socialCampaign.update({ where: { id }, data });
    } else {
      const created = await prisma.socialCampaign.create({ data });
      id = created.id;
    }
    revalidate();
    return { ok: true, data: { id } };
  } catch (e) {
    console.error("[social] saveCampaign failed:", e);
    return { ok: false, error: "Couldn't save the campaign." };
  }
}

export async function toggleSocialCampaign(
  id: string,
  enabled: boolean,
): Promise<AdminResult> {
  await requirePermission("social");
  try {
    await prisma.socialCampaign.update({ where: { id }, data: { enabled } });
    revalidate();
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't update the campaign." };
  }
}

export async function deleteSocialCampaign(id: string): Promise<AdminResult> {
  await requirePermission("social");
  try {
    await prisma.socialCampaign.delete({ where: { id } });
    revalidate();
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't delete the campaign." };
  }
}

// ── Generation ───────────────────────────────────────────────────────────────

/**
 * The corpus every new post is checked against. Manual generation used to see
 * only hooks + a de-duplicated tag list, so an admin-generated post could repeat
 * a scheduled one wholesale; it now shares the planner's uniqueness engine.
 * `excludeId` drops the post being regenerated so it isn't compared to itself.
 */
async function recentCorpus(excludeId?: string) {
  const recent = await prisma.socialPost.findMany({
    where: excludeId ? { id: { not: excludeId } } : undefined,
    orderBy: { createdAt: "desc" },
    take: COMPARE_WINDOW,
    select: { hook: true, caption: true, cta: true, hashtags: true, styleKey: true },
  });
  return {
    recentPosts: recent.map((r) => ({
      hook: r.hook,
      caption: r.caption,
      cta: r.cta,
      hashtags: r.hashtags,
    })),
    recentHooks: recent.map((r) => r.hook).filter(Boolean),
    // Duplicates retained on purpose — the tag sanitizer uses frequency.
    recentHashtags: recent.flatMap((r) => r.hashtags),
    recentStyles: recent.map((r) => r.styleKey).filter((k): k is string => Boolean(k)),
  };
}

/** Generate a single draft on demand (manual "Generate a post"). */
export async function generateSocialDraft(
  input: unknown,
): Promise<AdminResult<{ id: string }>> {
  await requirePermission("social");
  const parsed = socialGenerateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;
  const settings = await getSocialSettings();

  // Resolve a product (chosen, or the first active one).
  let productId = d.productId ?? null;
  if (!productId) {
    const p = await prisma.product.findFirst({
      where: { isActive: true },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });
    productId = p?.id ?? null;
  }
  const materials = productId ? await buildSocialMaterials(productId, settings.carouselEnabled) : null;

  const now = new Date();
  const slot = slotForPillar(d.pillar);
  const count = await prisma.socialPost.count();
  const angle = d.angle || angleAt(slot, count);
  const { recentPosts, recentHooks, recentHashtags, recentStyles } = await recentCorpus();
  const style = pickStyle(count, recentStyles, Boolean(materials));

  const gen = await generateUniqueSocialPost(
    {
      product: materials?.ctx ?? null,
      pillar: d.pillar,
      daypart: d.daypart,
      angle,
      brandVoice: settings.brandVoice,
      defaultHashtags: settings.defaultHashtags,
      bannedWords: settings.bannedWords,
      recentHooks,
      recentHashtags,
      templateGuidance: await pickTemplateGuidance(d.pillar, count),
      styleLabel: style.label,
      styleBrief: style.brief,
      rotation: count,
    },
    recentPosts,
  );
  if (!gen.ok) return { ok: false, error: gen.error };

  try {
    const created = await prisma.socialPost.create({
      data: {
        platform: "INSTAGRAM",
        status: "DRAFT",
        pillar: d.pillar,
        daypart: d.daypart,
        weekOfMonth: weekOfMonth(now),
        productId,
        hook: gen.data.hook,
        caption: gen.data.caption,
        captionLong: gen.data.captionLong,
        cta: gen.data.cta,
        hashtags: gen.data.hashtags,
        altText: gen.data.altText,
        imageUrls: materials?.imageUrls ?? [],
        contentHash: gen.data.contentHash,
        styleKey: style.key,
      },
    });
    revalidate();
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    console.error("[social] generateDraft failed:", e);
    return { ok: false, error: "Couldn't save the draft." };
  }
}

/** Regenerate the copy for an existing post (keeps its product + pillar). */
export async function regenerateSocialPost(id: string): Promise<AdminResult> {
  await requirePermission("social");
  const post = await prisma.socialPost.findUnique({ where: { id } });
  if (!post) return { ok: false, error: "Post not found." };
  if (post.status === "PUBLISHED") return { ok: false, error: "A published post can't be changed." };

  const settings = await getSocialSettings();
  const materials = post.productId
    ? await buildSocialMaterials(post.productId, settings.carouselEnabled)
    : null;
  const slot = slotForPillar(post.pillar);
  const count = await prisma.socialPost.count();
  // Regenerating means "give me something different" — so the post's CURRENT
  // copy is part of the corpus it must differ from, while the other posts are
  // compared without it being counted twice.
  const { recentPosts, recentHooks, recentHashtags, recentStyles } = await recentCorpus(id);
  const corpus = [
    { hook: post.hook, caption: post.caption, cta: post.cta, hashtags: post.hashtags },
    ...recentPosts,
  ];
  const style = pickStyle(count + 1, [post.styleKey, ...recentStyles].filter((k): k is string => Boolean(k)), Boolean(materials));

  const gen = await generateUniqueSocialPost(
    {
      product: materials?.ctx ?? null,
      pillar: post.pillar,
      daypart: post.daypart,
      angle: angleAt(slot, count + 1),
      brandVoice: settings.brandVoice,
      defaultHashtags: settings.defaultHashtags,
      bannedWords: settings.bannedWords,
      recentHooks: [post.hook, ...recentHooks],
      recentHashtags: [...post.hashtags, ...recentHashtags],
      templateGuidance: await pickTemplateGuidance(post.pillar, count + 1),
      styleLabel: style.label,
      styleBrief: style.brief,
      rotation: count + 1,
    },
    corpus,
  );
  if (!gen.ok) return { ok: false, error: gen.error };

  try {
    await prisma.socialPost.update({
      where: { id },
      data: {
        hook: gen.data.hook,
        caption: gen.data.caption,
        captionLong: gen.data.captionLong,
        cta: gen.data.cta,
        hashtags: gen.data.hashtags,
        altText: gen.data.altText,
        contentHash: gen.data.contentHash,
        styleKey: style.key,
        imageUrls: materials?.imageUrls ?? post.imageUrls,
        error: null,
        retryCount: 0,
      },
    });
    revalidate();
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't regenerate the post." };
  }
}

// ── Post lifecycle ───────────────────────────────────────────────────────────

export async function updateSocialPost(input: unknown): Promise<AdminResult> {
  await requirePermission("social");
  const parsed = socialPostEditSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid post." };
  }
  const d = parsed.data;
  try {
    await prisma.socialPost.update({
      where: { id: d.id },
      data: {
        hook: d.hook,
        caption: d.caption,
        captionLong: d.captionLong || null,
        cta: d.cta,
        hashtags: d.hashtags,
        altText: d.altText,
        imageUrls: d.imageUrls,
      },
    });
    revalidate();
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save the post." };
  }
}

/** Approve a draft/pending post → schedule it (immediately if no time set). */
export async function approveSocialPost(id: string): Promise<AdminResult> {
  await requirePermission("social");
  const post = await prisma.socialPost.findUnique({ where: { id }, select: { scheduledFor: true, status: true } });
  if (!post) return { ok: false, error: "Post not found." };
  try {
    await prisma.socialPost.update({
      where: { id },
      data: { status: "SCHEDULED", scheduledFor: post.scheduledFor ?? new Date(), error: null, retryCount: 0 },
    });
    revalidate();
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't approve the post." };
  }
}

export async function scheduleSocialPost(id: string, when: string): Promise<AdminResult> {
  await requirePermission("social");
  const date = new Date(when);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Invalid date/time." };
  try {
    await prisma.socialPost.update({
      where: { id },
      data: { status: "SCHEDULED", scheduledFor: date, error: null, retryCount: 0 },
    });
    revalidate();
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't schedule the post." };
  }
}

export async function rejectSocialPost(id: string): Promise<AdminResult> {
  await requirePermission("social");
  try {
    await prisma.socialPost.update({ where: { id }, data: { status: "CANCELLED" } });
    revalidate();
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reject the post." };
  }
}

export async function deleteSocialPost(id: string): Promise<AdminResult> {
  await requirePermission("social");
  try {
    await prisma.socialPost.delete({ where: { id } });
    revalidate();
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't delete the post." };
  }
}

export async function publishSocialPostNow(id: string): Promise<AdminResult> {
  await requirePermission("social");
  const res = await publishPostNow(id);
  revalidate();
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Publish failed." };
}

export async function bulkSocialPostAction(
  ids: string[],
  action: "approve" | "reject" | "delete",
): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("social");
  if (ids.length === 0) return { ok: false, error: "Nothing selected." };
  try {
    let done = 0;
    if (action === "delete") {
      const r = await prisma.socialPost.deleteMany({ where: { id: { in: ids } } });
      done = r.count;
    } else if (action === "approve") {
      const approvable = { in: ["DRAFT", "PENDING_APPROVAL", "FAILED"] as SocialPostStatus[] };
      // Preserve each post's planned slot time; only un-timed posts (manual
      // drafts) fall back to "now" — mirrors single-post approveSocialPost so
      // bulk approve doesn't fire every planned post immediately.
      await prisma.socialPost.updateMany({
        where: { id: { in: ids }, status: approvable, scheduledFor: null },
        data: { scheduledFor: new Date() },
      });
      const r = await prisma.socialPost.updateMany({
        where: { id: { in: ids }, status: approvable },
        data: { status: "SCHEDULED", error: null, retryCount: 0 },
      });
      done = r.count;
    } else {
      const r = await prisma.socialPost.updateMany({
        where: { id: { in: ids }, status: { notIn: ["PUBLISHED"] as SocialPostStatus[] } },
        data: { status: "CANCELLED" },
      });
      done = r.count;
    }
    revalidate();
    return { ok: true, data: { done, skipped: ids.length - done } };
  } catch {
    return { ok: false, error: "Bulk action failed." };
  }
}

// ── Automation controls ──────────────────────────────────────────────────────

/** Run the planner now (generate today's due posts on demand). */
export async function planSocialNow(): Promise<AdminResult<{ planned: number; skipped: number }>> {
  await requirePermission("social");
  try {
    const r = await planDuePosts();
    revalidate();
    return { ok: true, data: { planned: r.planned, skipped: r.skipped } };
  } catch (e) {
    console.error("[social] planNow failed:", e);
    return { ok: false, error: "Couldn't run the planner." };
  }
}

/** Run the full cron pipeline now (plan + publish). */
export async function runSocialCycleNow(): Promise<
  AdminResult<{ planned: number; published: number; failed: number }>
> {
  await requirePermission("social");
  try {
    const now = new Date();
    const plan = await planDuePosts(now);
    const pub = await publishDuePosts(now);
    // Refresh engagement for recently published posts (best-effort) so the
    // manual run is a full mirror of the cron — the only other insights trigger.
    await syncRecentInsights(now).catch(() => undefined);
    revalidate();
    revalidatePath("/admin/social/analytics");
    return { ok: true, data: { planned: plan.planned, published: pub.published, failed: pub.failed } };
  } catch (e) {
    console.error("[social] runCycle failed:", e);
    return { ok: false, error: "Couldn't run the cycle." };
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function saveSocialSettings(input: unknown): Promise<AdminResult> {
  await requirePermission("social");
  const parsed = socialSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  }
  try {
    await prisma.storeSetting.upsert({
      where: { id: "singleton" },
      update: { social: parsed.data as Prisma.InputJsonValue },
      create: { id: "singleton", social: parsed.data as Prisma.InputJsonValue },
    });
    revalidate();
    revalidatePath("/admin/social/settings");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save settings." };
  }
}

// ── Templates ────────────────────────────────────────────────────────────────

export async function saveSocialTemplate(input: unknown): Promise<AdminResult> {
  await requirePermission("social");
  const parsed = socialTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template." };
  }
  const d = parsed.data;
  try {
    if (d.id) {
      await prisma.socialTemplate.update({
        where: { id: d.id },
        data: { name: d.name, pillar: d.pillar, promptGuidance: d.promptGuidance },
      });
    } else {
      await prisma.socialTemplate.create({
        data: { name: d.name, pillar: d.pillar, promptGuidance: d.promptGuidance },
      });
    }
    revalidatePath("/admin/social/templates");
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "A template with that name already exists." };
    }
    return { ok: false, error: "Couldn't save the template." };
  }
}

export async function deleteSocialTemplate(id: string): Promise<AdminResult> {
  await requirePermission("social");
  try {
    await prisma.socialTemplate.delete({ where: { id } });
    revalidatePath("/admin/social/templates");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't delete the template." };
  }
}

export async function seedBuiltInTemplates(): Promise<AdminResult> {
  await requirePermission("social");
  try {
    await ensureBuiltInSocialTemplates();
    revalidatePath("/admin/social/templates");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't add built-in templates." };
  }
}
