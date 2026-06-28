import { prisma } from "@/lib/prisma";
import type { Notification } from "@prisma/client";

/** Recent notifications for the bell dropdown. Resilient to a brief DB outage. */
export async function getNotifications(userId: string, take = 15): Promise<Notification[]> {
  try {
    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
    });
  } catch {
    return [];
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    return await prisma.notification.count({ where: { userId, read: false } });
  } catch {
    return 0;
  }
}
