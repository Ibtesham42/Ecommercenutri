"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, limiters } from "@/lib/rate-limit";

/**
 * Public, unauthenticated download-count bump for a JNV resource. The student
 * portal has no login — this is the only write path exposed to it, so it's
 * rate-limited per IP (fail-open, matching every other public action in this
 * app) and never throws: a miscounted download must never block the file
 * open/download itself.
 */
export async function recordJnvDownload(resourceId: string): Promise<void> {
  if (typeof resourceId !== "string" || !resourceId) return;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = await checkRateLimit(limiters.api, `jnv-dl:${ip}`);
  if (!rl.success) return;

  try {
    await prisma.jnvResource.update({
      where: { id: resourceId },
      data: { downloadCount: { increment: 1 } },
    });
  } catch (err) {
    console.error("[jnv] recordJnvDownload failed:", err);
  }
}
