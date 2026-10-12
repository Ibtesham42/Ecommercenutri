/**
 * What /spin should show, from the server's point of view. Pure, so the
 * paused/ended-campaign and expiry edge cases are unit-tested.
 *
 *  - `userSpin`: the signed-in user's spin in the LIVE campaign (null if none,
 *    not signed in, or no campaign is live).
 *  - `tokenSpin`: the spin this browser's claim cookie resolves to.
 *
 * A pending anonymous win from a paused/ended campaign is still shown and
 * claimable (claims are honoured after a pause — docs/growth.md). One from an
 * older campaign while a different campaign is live is not shown here (the
 * live wheel is), but /account still claims it.
 */
type SpinRef = { campaignId: string; status: string; expiresAt: Date };

export function resolveSpinPage<T extends SpinRef>(input: {
  liveCampaignId: string | null;
  signedIn: boolean;
  userSpin: T | null;
  tokenSpin: T | null;
  now?: Date;
}): { spin: T | null; pendingClaim: boolean } {
  const now = input.now ?? new Date();
  const t = input.tokenSpin;
  const pending =
    t && t.status === "AWARDED" && (input.liveCampaignId === null || t.campaignId === input.liveCampaignId)
      ? t
      : null;
  const spin = input.userSpin ?? pending;
  const pendingClaim = Boolean(
    input.signedIn && !input.userSpin && pending && pending.expiresAt > now,
  );
  return { spin, pendingClaim };
}
