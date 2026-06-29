"use client";

import { toast } from "sonner";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

/**
 * Standardised toast for a bulk action result. `verb` is past tense, e.g.
 * "deleted", "activated". Returns true on success so callers can refresh/clear.
 */
export function toastBulk(res: AdminResult<BulkOutcome>, verb: string): boolean {
  if (!res.ok) {
    toast.error(res.error);
    return false;
  }
  const { done, skipped, note } = res.data ?? { done: 0, skipped: 0 };
  if (note) {
    (done === 0 ? toast.warning : toast.success)(note);
  } else if (done === 0 && skipped > 0) {
    toast.warning(`Nothing ${verb} — ${skipped} skipped.`);
  } else {
    toast.success(`${done} ${verb}${skipped ? `, ${skipped} skipped` : ""}.`);
  }
  return true;
}
