"use server";

import { revalidatePath } from "next/cache";
import type { ReturnStatus } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transitionReturnStatus, processRefund, type TransitionedReturn } from "@/lib/returns";
import { isReturnTerminal } from "@/lib/return-status";
import { returnStatusEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/email";
import { notify } from "@/lib/notifications";
import {
  returnIdSchema,
  approveReturnSchema,
  rejectReturnSchema,
  requestInfoSchema,
  schedulePickupSchema,
  addNoteSchema,
  processRefundSchema,
} from "@/lib/validations/returns";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

function revalidate(returnNumber: string) {
  revalidatePath("/admin/returns");
  revalidatePath(`/admin/returns/${returnNumber}`);
  revalidatePath("/account/returns");
  revalidatePath(`/account/returns/${returnNumber}`);
}

/** Email + in-app notification after a status change (best-effort). */
async function notifyReturn(
  ret: TransitionedReturn,
  status: ReturnStatus,
  extra?: { reason?: string | null; amount?: number; method?: string | null; pickupAt?: string | null },
) {
  const label = status.replace(/_/g, " ").toLowerCase();
  await notify(ret.user.id, {
    type: "RETURN_UPDATE",
    title: `Return ${label}`,
    body: `Your return ${ret.returnNumber} is now ${label}.`,
    link: `/account/returns/${ret.returnNumber}`,
  });
  if (ret.user.email) {
    const mail = returnStatusEmail({
      returnNumber: ret.returnNumber,
      orderNumber: ret.order.orderNumber,
      status,
      name: ret.user.name,
      ...extra,
    });
    if (mail) {
      try {
        await sendEmail({ to: ret.user.email, ...mail });
      } catch (e) {
        console.error("[admin/returns] email failed:", e);
      }
    }
  }
}

type LoadedReturn = { id: string; status: ReturnStatus; returnNumber: string; refundAmount: number };

/** Guard: load an open (non-terminal) return, or an AdminResult error to return. */
async function loadOpen(
  returnId: string,
): Promise<{ ok: true; r: LoadedReturn } | { ok: false; error: string }> {
  const r = await prisma.returnRequest.findUnique({
    where: { id: returnId },
    select: { id: true, status: true, returnNumber: true, refundAmount: true },
  });
  if (!r) return { ok: false, error: "Return not found." };
  if (isReturnTerminal(r.status)) return { ok: false, error: "This return is already closed." };
  return { ok: true, r };
}

export async function reviewReturn(input: unknown): Promise<AdminResult> {
  await requirePermission("returns");
  const parsed = returnIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const found = await loadOpen(parsed.data.returnId);
  if (!found.ok) return found;
  const ret = await transitionReturnStatus(parsed.data.returnId, "UNDER_REVIEW", {
    actor: "admin",
    note: "Marked under review",
  });
  await notifyReturn(ret, "UNDER_REVIEW");
  revalidate(ret.returnNumber);
  return { ok: true };
}

export async function approveReturn(input: unknown): Promise<AdminResult> {
  await requirePermission("returns");
  const parsed = approveReturnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const found = await loadOpen(parsed.data.returnId);
  if (!found.ok) return found;
  const ret = await transitionReturnStatus(parsed.data.returnId, "APPROVED", {
    actor: "admin",
    note: parsed.data.note || "Return approved",
  });
  await notifyReturn(ret, "APPROVED");
  revalidate(ret.returnNumber);
  return { ok: true };
}

export async function rejectReturn(input: unknown): Promise<AdminResult> {
  await requirePermission("returns");
  const parsed = rejectReturnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const found = await loadOpen(parsed.data.returnId);
  if (!found.ok) return found;
  const ret = await transitionReturnStatus(parsed.data.returnId, "REJECTED", {
    actor: "admin",
    note: parsed.data.reason,
    data: { rejectionReason: parsed.data.reason },
  });
  await notifyReturn(ret, "REJECTED", { reason: parsed.data.reason });
  revalidate(ret.returnNumber);
  return { ok: true };
}

export async function requestReturnInfo(input: unknown): Promise<AdminResult> {
  await requirePermission("returns");
  const parsed = requestInfoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const found = await loadOpen(parsed.data.returnId);
  if (!found.ok) return found;
  const ret = await transitionReturnStatus(parsed.data.returnId, "INFO_REQUESTED", {
    actor: "admin",
    note: parsed.data.message,
  });
  await notifyReturn(ret, "INFO_REQUESTED", { reason: parsed.data.message });
  revalidate(ret.returnNumber);
  return { ok: true };
}

export async function scheduleReturnPickup(input: unknown): Promise<AdminResult> {
  await requirePermission("returns");
  const parsed = schedulePickupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const found = await loadOpen(parsed.data.returnId);
  if (!found.ok) return found;
  const pickupAt = new Date(parsed.data.pickupAt);
  if (Number.isNaN(pickupAt.getTime())) return { ok: false, error: "Invalid pickup date." };
  const ret = await transitionReturnStatus(parsed.data.returnId, "PICKUP_SCHEDULED", {
    actor: "admin",
    note: `Pickup scheduled${parsed.data.note ? ` — ${parsed.data.note}` : ""}`,
    data: { pickupScheduledAt: pickupAt, pickupNote: parsed.data.note || null },
  });
  await notifyReturn(ret, "PICKUP_SCHEDULED", { pickupAt: pickupAt.toISOString() });
  revalidate(ret.returnNumber);
  return { ok: true };
}

/** Internal admin note — appended to the audit log; no status change, no customer notice. */
export async function addReturnNote(input: unknown): Promise<AdminResult> {
  await requirePermission("returns");
  const parsed = addNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const r = await prisma.returnRequest.findUnique({
    where: { id: parsed.data.returnId },
    select: { status: true, adminNotes: true, returnNumber: true },
  });
  if (!r) return { ok: false, error: "Return not found." };
  await prisma.$transaction([
    prisma.returnRequest.update({
      where: { id: parsed.data.returnId },
      data: { adminNotes: r.adminNotes ? `${r.adminNotes}\n${parsed.data.note}` : parsed.data.note },
    }),
    prisma.returnEvent.create({
      data: { returnId: parsed.data.returnId, status: r.status, note: `Note: ${parsed.data.note}`, actor: "admin" },
    }),
  ]);
  revalidate(r.returnNumber);
  return { ok: true };
}

export async function processReturnRefund(input: unknown): Promise<AdminResult> {
  await requirePermission("returns");
  const parsed = processRefundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const { returnId, amount, method, reference } = parsed.data;

  const current = await prisma.returnRequest.findUnique({
    where: { id: returnId },
    select: { status: true, refundAmount: true, refundStatus: true },
  });
  if (!current) return { ok: false, error: "Return not found." };
  if (current.refundStatus === "COMPLETED") return { ok: false, error: "This return is already refunded." };
  if (current.status === "REJECTED" || current.status === "CANCELLED") {
    return { ok: false, error: "This return is closed." };
  }
  if (amount > current.refundAmount) {
    return { ok: false, error: "Refund amount exceeds the returnable value." };
  }

  let ret: TransitionedReturn;
  try {
    ret = await processRefund(returnId, { amount, method, reference });
  } catch (e) {
    const msg = (e as Error)?.message;
    if (msg === "NO_ORIGINAL_PAYMENT") {
      return {
        ok: false,
        error: "No original online payment to refund — pick a manual method (UPI / Bank transfer).",
      };
    }
    console.error("[admin/returns] refund failed:", e);
    return { ok: false, error: "Refund failed. Please try again." };
  }

  await notifyReturn(ret, "REFUNDED", { amount, method });
  revalidate(ret.returnNumber);
  return { ok: true };
}

const RETURN_BULK_ACTIONS = ["approve", "reject", "refund"] as const;
type ReturnBulkAction = (typeof RETURN_BULK_ACTIONS)[number];

/**
 * Bulk approve / reject / refund return requests. Each item reuses the single-item
 * lifecycle (`transitionReturnStatus` / `processRefund`) with notifications. Closed
 * returns are skipped. Bulk refund settles the full returnable amount to the original
 * payment method; COD / manual-only returns are skipped (refund them from the detail
 * page with a UPI/Bank method).
 */
export async function bulkReturnAction(
  ids: string[],
  action: ReturnBulkAction,
): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("returns");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (!RETURN_BULK_ACTIONS.includes(action)) return { ok: false, error: "Unknown action." };

  let done = 0;
  let skipped = 0;
  let manualNeeded = 0;

  for (const id of ids) {
    try {
      if (action === "approve") {
        const found = await loadOpen(id);
        if (!found.ok) { skipped++; continue; }
        const ret = await transitionReturnStatus(id, "APPROVED", { actor: "admin", note: "Approved in bulk" });
        await notifyReturn(ret, "APPROVED");
        done++;
      } else if (action === "reject") {
        const found = await loadOpen(id);
        if (!found.ok) { skipped++; continue; }
        const reason = "Rejected by store";
        const ret = await transitionReturnStatus(id, "REJECTED", {
          actor: "admin",
          note: reason,
          data: { rejectionReason: reason },
        });
        await notifyReturn(ret, "REJECTED", { reason });
        done++;
      } else {
        const current = await prisma.returnRequest.findUnique({
          where: { id },
          select: { status: true, refundAmount: true, refundStatus: true },
        });
        if (
          !current ||
          current.refundStatus === "COMPLETED" ||
          current.status === "REJECTED" ||
          current.status === "CANCELLED"
        ) {
          skipped++;
          continue;
        }
        try {
          const ret = await processRefund(id, { amount: current.refundAmount, method: "ORIGINAL" });
          await notifyReturn(ret, "REFUNDED", { amount: current.refundAmount, method: "ORIGINAL" });
          done++;
        } catch (e) {
          if ((e as Error)?.message === "NO_ORIGINAL_PAYMENT") manualNeeded++;
          else throw e;
        }
      }
    } catch (err) {
      console.error("[admin/returns] bulkReturnAction item failed:", err);
      skipped++;
    }
  }

  revalidatePath("/admin/returns");
  revalidatePath("/account/returns");
  const totalSkipped = skipped + manualNeeded;
  return {
    ok: true,
    data: {
      done,
      skipped: totalSkipped,
      note: manualNeeded
        ? `${done} refunded · ${manualNeeded} need a manual method (refund from the detail page)${skipped ? ` · ${skipped} skipped` : ""}.`
        : undefined,
    },
  };
}
