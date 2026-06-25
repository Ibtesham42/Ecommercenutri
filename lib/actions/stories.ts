"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Record a story view (increments the counter + logs a StoryView). Best-effort. */
export async function recordStoryView(storyId: string): Promise<void> {
  try {
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
