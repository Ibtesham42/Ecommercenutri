"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Mark a single notification read (owner-scoped). */
export async function markNotificationRead(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user?.id) return;
  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  });
  revalidatePath("/account/notifications");
}

/** Mark all of the current user's notifications read. */
export async function markAllNotificationsRead(): Promise<void> {
  const user = await getCurrentUser();
  if (!user?.id) return;
  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });
  revalidatePath("/account/notifications");
}
