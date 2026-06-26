"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import type { AdminResult } from "@/lib/actions/admin/types";

/** Mark a contact message as handled / unhandled. */
export async function markContactMessage(id: string, handled: boolean): Promise<AdminResult> {
  await requirePermission("customers");
  await prisma.contactMessage.update({ where: { id }, data: { handled } });
  revalidatePath("/admin/messages");
  return { ok: true };
}

/** Delete a contact message. */
export async function deleteContactMessage(id: string): Promise<AdminResult> {
  await requirePermission("customers");
  await prisma.contactMessage.delete({ where: { id } });
  revalidatePath("/admin/messages");
  return { ok: true };
}
