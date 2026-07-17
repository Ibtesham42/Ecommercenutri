import "server-only";
import type { SocialPost } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishToInstagram } from "@/lib/social/instagram";
import { notifyAdmins } from "@/lib/notifications";

/**
 * Publishes scheduled social posts whose time has arrived. Mirrors the Marketing
 * Hub's dispatch: each post is claimed atomically (SCHEDULED → PUBLISHING via a
 * conditional updateMany) so a slow or double-fired cron can't publish twice.
 * Success stores the external id + permalink; failure records the error and marks
 * the post FAILED for retry from the admin.
 */

export type PublishReport = { published: number; failed: number; retried: number };

/**
 * Failed posts are auto-retried on later cron runs up to this many times before
 * they're left FAILED for manual review — this rides out transient Meta/token
 * hiccups without hammering permanent failures (bad image, expired token).
 */
const MAX_RETRIES = 3;

async function publishClaimed(post: SocialPost): Promise<{ ok: boolean; error?: string }> {
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
      return { ok: false, error: res.error };
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
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Publish failed.";
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { status: "FAILED", error },
    });
    return { ok: false, error };
  }
}

/** Best-effort: tell every admin a post exhausted its auto-retries and needs a
 *  human. Never throws — a notification failure must not affect publishing. */
async function notifyRetriesExhausted(post: SocialPost, error: string | undefined): Promise<void> {
  await notifyAdmins({
    title: "A scheduled social post failed to publish",
    body: `After ${MAX_RETRIES} attempts, this post could not be published${error ? `: ${error}` : "."} The draft and generated content are preserved — review it in the Failed tab.`,
    link: "/admin/social/failed",
  }).catch((e) => console.error("[social] admin notify failed:", e));
}

/** Cron entry: publish all due scheduled posts, then auto-retry recent failures. */
export async function publishDuePosts(now = new Date()): Promise<PublishReport> {
  const due = await prisma.socialPost.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    orderBy: { scheduledFor: "asc" },
    take: 25,
  });

  let published = 0;
  let failed = 0;
  let retried = 0;
  for (const post of due) {
    // Claim: only one worker can move SCHEDULED → PUBLISHING.
    const claim = await prisma.socialPost.updateMany({
      where: { id: post.id, status: "SCHEDULED" },
      data: { status: "PUBLISHING" },
    });
    if (claim.count === 0) continue;
    const res = await publishClaimed({ ...post, status: "PUBLISHING" });
    if (res.ok) published++;
    else failed++;
  }

  // Auto-retry: pick failed posts that were due and haven't exhausted retries.
  const retryable = await prisma.socialPost.findMany({
    where: {
      status: "FAILED",
      retryCount: { lt: MAX_RETRIES },
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: "asc" },
    take: 15,
  });
  for (const post of retryable) {
    // Claim + count the attempt atomically so a double-fired cron can't
    // retry the same post twice or exceed MAX_RETRIES.
    const claim = await prisma.socialPost.updateMany({
      where: { id: post.id, status: "FAILED", retryCount: { lt: MAX_RETRIES } },
      data: { status: "PUBLISHING", retryCount: { increment: 1 } },
    });
    if (claim.count === 0) continue;
    retried++;
    const attemptNumber = post.retryCount + 1; // the increment above just happened in the DB
    const res = await publishClaimed({ ...post, status: "PUBLISHING", retryCount: attemptNumber });
    if (res.ok) {
      published++;
    } else {
      failed++;
      // This was the LAST automatic retry and it still failed — no future
      // cron tick will touch this post again (retryCount now === MAX_RETRIES),
      // so a human needs to know rather than the post sitting silently FAILED.
      if (attemptNumber >= MAX_RETRIES) await notifyRetriesExhausted(post, res.error);
    }
  }

  return { published, failed, retried };
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
  const res = await publishClaimed(post);
  if (res.ok) return { ok: true };
  return { ok: false, error: res.error ?? "Publish failed — see the post for details." };
}
