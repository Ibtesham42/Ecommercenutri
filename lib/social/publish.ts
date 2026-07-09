import "server-only";
import type { SocialPost } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishToInstagram } from "@/lib/social/instagram";

/**
 * Publishes scheduled social posts whose time has arrived. Mirrors the Marketing
 * Hub's dispatch: each post is claimed atomically (SCHEDULED → PUBLISHING via a
 * conditional updateMany) so a slow or double-fired cron can't publish twice.
 * Success stores the external id + permalink; failure records the error and marks
 * the post FAILED for retry from the admin.
 */

export type PublishReport = { published: number; failed: number };

async function publishClaimed(post: SocialPost): Promise<boolean> {
  try {
    if (post.platform !== "INSTAGRAM") {
      throw new Error(`Publishing to ${post.platform} is not supported yet.`);
    }
    const res = await publishToInstagram({
      caption: post.caption,
      hashtags: post.hashtags,
      imageUrls: post.imageUrls,
    });
    if (!res.ok) {
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: "FAILED", error: res.error },
      });
      return false;
    }
    await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        externalId: res.externalId,
        permalink: res.permalink,
        error: null,
      },
    });
    return true;
  } catch (e) {
    const error = e instanceof Error ? e.message : "Publish failed.";
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { status: "FAILED", error },
    });
    return false;
  }
}

/** Cron entry: publish all due scheduled posts. */
export async function publishDuePosts(now = new Date()): Promise<PublishReport> {
  const due = await prisma.socialPost.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    orderBy: { scheduledFor: "asc" },
    take: 25,
  });

  let published = 0;
  let failed = 0;
  for (const post of due) {
    // Claim: only one worker can move SCHEDULED → PUBLISHING.
    const claim = await prisma.socialPost.updateMany({
      where: { id: post.id, status: "SCHEDULED" },
      data: { status: "PUBLISHING" },
    });
    if (claim.count === 0) continue;
    if (await publishClaimed({ ...post, status: "PUBLISHING" })) published++;
    else failed++;
  }
  return { published, failed };
}

/**
 * Publish a single post immediately (admin "Publish now"). Claims from any
 * non-terminal status so a draft or failed post can be pushed on demand.
 */
export async function publishPostNow(
  postId: string,
): Promise<{ ok: boolean; error?: string }> {
  const claim = await prisma.socialPost.updateMany({
    where: {
      id: postId,
      status: { in: ["DRAFT", "PENDING_APPROVAL", "SCHEDULED", "FAILED"] },
    },
    data: { status: "PUBLISHING" },
  });
  if (claim.count === 0) return { ok: false, error: "Post can't be published from its current state." };

  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) return { ok: false, error: "Post not found." };
  const ok = await publishClaimed(post);
  if (ok) return { ok: true };
  // Surface the exact failure reason (stored on the post by publishClaimed).
  const failed = await prisma.socialPost.findUnique({
    where: { id: postId },
    select: { error: true },
  });
  return { ok: false, error: failed?.error ?? "Publish failed — see the post for details." };
}
