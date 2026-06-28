import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

/**
 * Create an in-app notification (the account bell). Best-effort: never throws, so
 * it can't break the action that triggered it (email is sent separately).
 */
export async function notify(
  userId: string,
  data: { type?: NotificationType; title: string; body?: string | null; link?: string | null },
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: data.type ?? "GENERAL",
        title: data.title,
        body: data.body ?? null,
        link: data.link ?? null,
      },
    });
  } catch (err) {
    console.error("[notifications] create failed:", err);
  }
}
