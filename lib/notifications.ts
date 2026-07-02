import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

/**
 * Create an in-app notification (the account bell). Best-effort: never throws, so
 * it can't break the action that triggered it (email is sent separately). Returns
 * whether the row was actually created so callers that report delivery (e.g. the
 * marketing automations) can tell success from a swallowed failure.
 */
export async function notify(
  userId: string,
  data: { type?: NotificationType; title: string; body?: string | null; link?: string | null },
): Promise<boolean> {
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
    return true;
  } catch (err) {
    console.error("[notifications] create failed:", err);
    return false;
  }
}

/**
 * Fan an in-app notification out to every active admin (the bell). Best-effort —
 * used for events the whole admin team should see (e.g. a new B2B inquiry).
 */
export async function notifyAdmins(data: {
  type?: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
      select: { id: true },
    });
    if (admins.length === 0) return;
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: data.type ?? "GENERAL",
        title: data.title,
        body: data.body ?? null,
        link: data.link ?? null,
      })),
    });
  } catch (err) {
    console.error("[notifications] notifyAdmins failed:", err);
  }
}
