/**
 * Admin Spin & Win funnel counts (pure). An AWARDED win past its claim
 * deadline is only flipped to EXPIRED lazily (when someone tries to claim
 * it), so the raw status counts overstate "pending": those rows are counted
 * as expired here instead.
 */
export type SpinStatusCounts = {
  awarded: number; // all AWARDED rows
  awardedPastDeadline: number; // AWARDED rows whose expiresAt has passed
  claimed: number;
  redeemed: number;
  expired: number; // rows already marked EXPIRED
};

export function spinFunnel(c: SpinStatusCounts) {
  const stale = Math.min(c.awardedPastDeadline, c.awarded);
  return {
    spins: c.awarded + c.claimed + c.redeemed + c.expired,
    pending: c.awarded - stale,
    // Claimed = ever attached to an account (redeemed ones were claimed first).
    claimed: c.claimed + c.redeemed,
    redeemed: c.redeemed,
    expired: c.expired + stale,
  };
}
