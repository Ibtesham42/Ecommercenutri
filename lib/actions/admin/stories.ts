"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { storyInputSchema } from "@/lib/validations/admin";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

function revalidate() {
  revalidatePath("/admin/stories");
  revalidatePath("/");
}

const STORY_BULK_ACTIONS = ["publish", "unpublish", "delete"] as const;
type StoryBulkAction = (typeof STORY_BULK_ACTIONS)[number];

/** Bulk publish / unpublish / delete stories. */
export async function bulkStoryAction(
  ids: string[],
  action: StoryBulkAction,
): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("stories");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (!STORY_BULK_ACTIONS.includes(action)) return { ok: false, error: "Unknown action." };

  try {
    const res =
      action === "delete"
        ? await prisma.story.deleteMany({ where: { id: { in: ids } } })
        : await prisma.story.updateMany({
            where: { id: { in: ids } },
            data: { isPublished: action === "publish" },
          });
    revalidate();
    return { ok: true, data: { done: res.count, skipped: ids.length - res.count } };
  } catch (err) {
    console.error("[admin] bulkStoryAction failed:", err);
    return { ok: false, error: "Bulk action failed." };
  }
}

export async function saveStory(input: unknown): Promise<AdminResult> {
  await requirePermission("stories");

  const parsed = storyInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid story." };
  }
  const d = parsed.data;

  const data = {
    title: d.title,
    coverImage: d.coverImage,
    mediaUrl: d.mediaUrl,
    mediaType: d.mediaType,
    productId: d.productId || null,
    ctaText: d.ctaText || null,
    isPublished: d.isPublished,
    sortOrder: d.sortOrder,
    expiresAt: d.expiresAt ?? null,
  };

  if (d.id) {
    await prisma.story.update({ where: { id: d.id }, data });
  } else {
    await prisma.story.create({ data });
  }
  revalidate();
  return { ok: true };
}

export async function toggleStoryPublish(
  id: string,
  isPublished: boolean,
): Promise<AdminResult> {
  await requirePermission("stories");
  await prisma.story.update({ where: { id }, data: { isPublished } });
  revalidate();
  return { ok: true };
}

export async function deleteStory(id: string): Promise<AdminResult> {
  await requirePermission("stories");
  await prisma.story.delete({ where: { id } });
  revalidate();
  return { ok: true };
}
