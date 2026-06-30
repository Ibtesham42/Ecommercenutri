"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { B2B_STATUSES } from "@/lib/b2b";
import type { B2BStatus } from "@prisma/client";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

function revalidate() {
  revalidatePath("/admin/b2b");
  revalidatePath("/admin");
}

function isB2BStatus(v: string): v is B2BStatus {
  return (B2B_STATUSES as string[]).includes(v);
}

export async function updateB2BStatus(id: string, status: string): Promise<AdminResult> {
  await requirePermission("customers");
  if (!isB2BStatus(status)) return { ok: false, error: "Unknown status." };
  await prisma.b2BInquiry.update({ where: { id }, data: { status } });
  revalidate();
  return { ok: true };
}

export async function deleteB2BInquiry(id: string): Promise<AdminResult> {
  await requirePermission("customers");
  await prisma.b2BInquiry.delete({ where: { id } });
  revalidate();
  return { ok: true };
}

/** Bulk: "delete" or "status:<STATUS>". */
export async function bulkB2BAction(
  ids: string[],
  action: string,
): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("customers");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };

  try {
    if (action === "delete") {
      const res = await prisma.b2BInquiry.deleteMany({ where: { id: { in: ids } } });
      revalidate();
      return { ok: true, data: { done: res.count, skipped: ids.length - res.count } };
    }
    if (action.startsWith("status:")) {
      const status = action.slice("status:".length);
      if (!isB2BStatus(status)) return { ok: false, error: "Unknown status." };
      const res = await prisma.b2BInquiry.updateMany({
        where: { id: { in: ids } },
        data: { status },
      });
      revalidate();
      return { ok: true, data: { done: res.count, skipped: ids.length - res.count } };
    }
    return { ok: false, error: "Unknown action." };
  } catch (err) {
    console.error("[admin] bulkB2BAction failed:", err);
    return { ok: false, error: "Bulk action failed." };
  }
}
