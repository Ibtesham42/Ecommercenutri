"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import type { AdminResult } from "@/lib/actions/admin/types";
import {
  competitorSchema,
  competitorSignalSchema,
  intelligenceSettingsSchema,
  ideaStatusSchema,
} from "@/lib/validations/intelligence";
import { ensureDefaultCompetitors } from "@/lib/intelligence/competitors";
import {
  runIntelligenceCycle,
  runCompetitorProfile,
  generateDailyIdeas,
} from "@/lib/intelligence/engine";
import { getSocialSettings } from "@/lib/social/settings";
import { generateSocialPost } from "@/lib/social/ai";

function revalidate() {
  revalidatePath("/admin/social/intelligence");
  revalidatePath("/admin/social/intelligence/competitors");
  revalidatePath("/admin/social/intelligence/ideas");
}

// ── Competitors ──────────────────────────────────────────────────────────────

export async function saveCompetitor(input: unknown): Promise<AdminResult<{ id: string }>> {
  await requirePermission("social");
  const parsed = competitorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid competitor." };
  }
  const d = parsed.data;
  const data = {
    name: d.name,
    category: d.category,
    priority: d.priority,
    active: d.active,
    instagram: d.instagram,
    facebook: d.facebook,
    linkedin: d.linkedin,
    website: d.website,
    blogUrl: d.blogUrl,
    notes: d.notes,
  };
  try {
    let id = d.id;
    if (id) {
      await prisma.competitor.update({ where: { id }, data });
    } else {
      const created = await prisma.competitor.create({ data });
      id = created.id;
    }
    revalidate();
    return { ok: true, data: { id } };
  } catch (e) {
    console.error("[intelligence] saveCompetitor failed:", e);
    return { ok: false, error: "Couldn't save the competitor (name may already exist)." };
  }
}

export async function toggleCompetitor(id: string, active: boolean): Promise<AdminResult> {
  await requirePermission("social");
  try {
    await prisma.competitor.update({ where: { id }, data: { active } });
    revalidate();
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't update monitoring." };
  }
}

export async function deleteCompetitor(id: string): Promise<AdminResult> {
  await requirePermission("social");
  try {
    // Signals cascade; the cached profile report is cleaned up explicitly.
    await prisma.$transaction([
      prisma.intelligenceReport.deleteMany({ where: { competitorId: id } }),
      prisma.competitor.delete({ where: { id } }),
    ]);
    revalidate();
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't delete the competitor." };
  }
}

export async function seedDefaultCompetitorsAction(): Promise<AdminResult<{ added: number }>> {
  await requirePermission("social");
  try {
    const added = await ensureDefaultCompetitors();
    revalidate();
    return { ok: true, data: { added } };
  } catch {
    return { ok: false, error: "Couldn't seed the default watchlist." };
  }
}

// ── Signals ──────────────────────────────────────────────────────────────────

export async function addCompetitorSignal(input: unknown): Promise<AdminResult<{ id: string }>> {
  await requirePermission("social");
  const parsed = competitorSignalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid signal." };
  }
  const d = parsed.data;
  try {
    const created = await prisma.competitorSignal.create({
      data: {
        competitorId: d.competitorId,
        source: d.source,
        kind: d.kind,
        title: d.title,
        summary: d.summary,
        url: d.url,
        postedAt: d.postedAt,
        likes: d.likes,
        comments: d.comments,
        shares: d.shares,
        views: d.views,
        hashtags: d.hashtags.filter(Boolean),
        topics: d.topics.filter(Boolean),
      },
    });
    revalidate();
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    console.error("[intelligence] addSignal failed:", e);
    return { ok: false, error: "Couldn't record the signal." };
  }
}

export async function deleteCompetitorSignal(id: string): Promise<AdminResult> {
  await requirePermission("social");
  try {
    await prisma.competitorSignal.delete({ where: { id } });
    revalidate();
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't delete the signal." };
  }
}

// ── Analysis runs ────────────────────────────────────────────────────────────

/** Full cycle, bypassing the schedule/cache gates (admin "Run analysis now"). */
export async function runIntelligenceNow(): Promise<
  AdminResult<{ profilesRefreshed: number; ideas: number }>
> {
  await requirePermission("social");
  try {
    const result = await runIntelligenceCycle(new Date(), { force: true });
    revalidate();
    return {
      ok: true,
      data: { profilesRefreshed: result.profilesRefreshed, ideas: result.ideas },
    };
  } catch (e) {
    console.error("[intelligence] run failed:", e);
    return { ok: false, error: "Analysis run failed." };
  }
}

/** Re-analyze one competitor immediately. */
export async function analyzeCompetitorNow(id: string): Promise<AdminResult> {
  await requirePermission("social");
  try {
    const competitor = await prisma.competitor.findUnique({ where: { id } });
    if (!competitor) return { ok: false, error: "Competitor not found." };
    await runCompetitorProfile(competitor);
    revalidate();
    return { ok: true };
  } catch (e) {
    console.error("[intelligence] analyze failed:", e);
    return { ok: false, error: "Analysis failed." };
  }
}

/** Regenerate today's idea batch on demand. */
export async function generateIdeasNow(): Promise<AdminResult<{ ideas: number }>> {
  await requirePermission("social");
  try {
    const ideas = await generateDailyIdeas(new Date(), true);
    revalidate();
    return { ok: true, data: { ideas } };
  } catch (e) {
    console.error("[intelligence] ideas failed:", e);
    return { ok: false, error: "Couldn't generate ideas." };
  }
}

// ── Ideas ────────────────────────────────────────────────────────────────────

export async function updateIdeaStatus(input: unknown): Promise<AdminResult> {
  await requirePermission("social");
  const parsed = ideaStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  try {
    await prisma.contentIdea.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    });
    revalidate();
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't update the idea." };
  }
}

/** Turn an idea into a SocialPost draft in the AI Marketing queue. The idea's
 *  topic becomes the generation angle — the copy itself is written fresh by
 *  the same brand-voiced, claim-safe generator used everywhere else. */
export async function createDraftFromIdea(id: string): Promise<AdminResult<{ postId: string }>> {
  await requirePermission("social");
  const idea = await prisma.contentIdea.findUnique({ where: { id } });
  if (!idea) return { ok: false, error: "Idea not found." };

  const settings = await getSocialSettings();
  const recent = await prisma.socialPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { hook: true, hashtags: true },
  });
  const hour = Number(idea.bestTime?.match(/^(\d{1,2}):/)?.[1] ?? 9);
  const daypart = hour < 15 ? "MORNING" : "EVENING";
  const gen = await generateSocialPost({
    product: null,
    pillar: "HEALTHY_SNACKING",
    daypart,
    angle: idea.topic,
    brandVoice: settings.brandVoice,
    defaultHashtags: settings.defaultHashtags,
    bannedWords: settings.bannedWords,
    recentHooks: recent.map((r) => r.hook).filter(Boolean),
    recentHashtags: [...new Set(recent.flatMap((r) => r.hashtags))],
    templateGuidance: `Audience: ${idea.audience}. Why now: ${idea.rationale.slice(0, 240)}. Suggested CTA direction: ${idea.cta ?? "save/share"}.`,
  });
  if (!gen.ok) return { ok: false, error: gen.error };

  try {
    const now = new Date();
    const created = await prisma.socialPost.create({
      data: {
        platform: "INSTAGRAM",
        status: "DRAFT",
        pillar: "HEALTHY_SNACKING",
        daypart,
        weekOfMonth: Math.min(4, Math.floor((now.getDate() - 1) / 7) + 1),
        hook: gen.data.hook,
        caption: gen.data.caption,
        captionLong: gen.data.captionLong,
        cta: gen.data.cta,
        hashtags: gen.data.hashtags,
        altText: gen.data.altText,
        imageUrls: [],
        contentHash: gen.data.contentHash,
      },
    });
    await prisma.contentIdea.update({ where: { id }, data: { status: "USED" } });
    revalidate();
    revalidatePath("/admin/social/queue");
    return { ok: true, data: { postId: created.id } };
  } catch (e) {
    console.error("[intelligence] useIdea failed:", e);
    return { ok: false, error: "Couldn't create the draft." };
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function saveIntelligenceSettings(input: unknown): Promise<AdminResult> {
  await requirePermission("social");
  const parsed = intelligenceSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  }
  try {
    await prisma.storeSetting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", intelligence: parsed.data },
      update: { intelligence: parsed.data },
    });
    revalidate();
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save settings." };
  }
}
