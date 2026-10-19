/**
 * Payout audit trail, kept in the existing `Payout.notes` column (no schema
 * change): one line per admin/system decision, newest last, e.g.
 *   [2026-10-19 14:02 UTC · ops@nutriyet.in] Rejected — reason: invalid UPI
 * Admin-only. Affiliates never see raw notes — only `payoutRejectionReason`.
 * Client-safe (pure string helpers).
 */

const MAX_NOTES = 4000;
const REJECT_PREFIX = "Rejected — reason: ";

export function appendPayoutAudit(notes: string | null | undefined, actor: string, text: string, at = new Date()): string {
  const stamp = `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  const line = `[${stamp} · ${actor}] ${text.replace(/\s+/g, " ").trim()}`;
  const next = notes ? `${notes}\n${line}` : line;
  // Keep the newest history if it ever grows past the cap.
  return next.length > MAX_NOTES ? next.slice(next.length - MAX_NOTES) : next;
}

export function rejectionAuditText(reason: string | null | undefined): string {
  return reason?.trim() ? `${REJECT_PREFIX}${reason.trim()}` : "Rejected";
}

/** The affiliate-facing rejection reason, without any admin identity. Legacy rows
 *  stored the bare reason in `notes`. */
export function payoutRejectionReason(notes: string | null | undefined): string | null {
  if (!notes) return null;
  if (!notes.startsWith("[")) return notes;
  const lines = notes.split("\n").reverse();
  for (const l of lines) {
    const i = l.indexOf(REJECT_PREFIX);
    if (i >= 0) return l.slice(i + REJECT_PREFIX.length);
  }
  return null;
}

export function payoutAuditLines(notes: string | null | undefined): string[] {
  if (!notes) return [];
  return notes.startsWith("[") ? notes.split("\n") : [`(legacy note) ${notes}`];
}
