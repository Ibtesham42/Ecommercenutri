"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, limiters } from "@/lib/rate-limit";

/** Record a story view (increments the counter + logs a StoryView). Best-effort. */
export async function recordStoryView(storyId: string): Promise<void> {
  // Public + unauthenticated and each call inserts a row: throttle per IP so a
  // script can't inflate view counts or bloat StoryView.
  if (typeof storyId !== "string" || !storyId || storyId.length > 64) return;
  try {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    const rl = await checkRateLimit(limiters.api, `story-view:${ip}`);
    if (!rl.success) return;
    const user = await getCurrentUser();
    await prisma.$transaction([
      prisma.story.update({
        where: { id: storyId },
        data: { viewCount: { increment: 1 } },
      }),
      prisma.storyView.create({
        data: { storyId, userId: user?.id ?? null },
      }),
    ]);
  } catch (err) {
    console.error("[stories] recordStoryView failed:", err);
  }
}
