/** Standard result shape returned by admin server actions. */
export type AdminResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/** Result of a bulk action: how many were affected, skipped, and an optional note
 *  (e.g. "3 deleted, 2 kept — in use"). Returned inside `AdminResult<BulkOutcome>`. */
export type BulkOutcome = { done: number; skipped: number; note?: string };
