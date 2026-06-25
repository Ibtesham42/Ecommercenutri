/** Standard result shape returned by admin server actions. */
export type AdminResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };
