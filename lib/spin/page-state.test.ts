import { describe, expect, it } from "vitest";
import { resolveSpinPage } from "@/lib/spin/page-state";

const now = new Date("2026-10-12T10:00:00Z");
const future = new Date("2026-10-13T10:00:00Z");
const past = new Date("2026-10-11T10:00:00Z");
const spin = (campaignId: string, status = "AWARDED", expiresAt = future) => ({ campaignId, status, expiresAt });

describe("resolveSpinPage (I1)", () => {
  it("auto-claims a pending win after sign-in while its campaign is live", () => {
    const r = resolveSpinPage({ liveCampaignId: "c1", signedIn: true, verified: true, userSpin: null, tokenSpin: spin("c1"), now });
    expect(r.pendingClaim).toBe(true);
    expect(r.spin?.campaignId).toBe("c1");
  });

  it("still auto-claims a pending win after its campaign was PAUSED/ENDED (no infinite 'Saving…')", () => {
    const r = resolveSpinPage({ liveCampaignId: null, signedIn: true, verified: true, userSpin: null, tokenSpin: spin("c_old"), now });
    expect(r.spin).not.toBeNull();
    expect(r.pendingClaim).toBe(true);
  });

  it("never auto-claims for a signed-out visitor", () => {
    expect(resolveSpinPage({ liveCampaignId: null, signedIn: false, verified: false, userSpin: null, tokenSpin: spin("c_old"), now }).pendingClaim).toBe(false);
    expect(resolveSpinPage({ liveCampaignId: "c1", signedIn: false, verified: false, userSpin: null, tokenSpin: spin("c1"), now }).pendingClaim).toBe(false);
  });

  it("does not try to claim an expired win — it is shown (as expired) instead", () => {
    const r = resolveSpinPage({ liveCampaignId: null, signedIn: true, verified: true, userSpin: null, tokenSpin: spin("c_old", "AWARDED", past), now });
    expect(r.pendingClaim).toBe(false);
    expect(r.spin).not.toBeNull();
  });

  it("prefers the account's own spin and does not claim a second one", () => {
    const own = spin("c1", "CLAIMED");
    const r = resolveSpinPage({ liveCampaignId: "c1", signedIn: true, verified: true, userSpin: own, tokenSpin: spin("c1"), now });
    expect(r.spin).toBe(own);
    expect(r.pendingClaim).toBe(false);
  });

  it("ignores consumed tokens and wins from an older campaign while a different one is live", () => {
    expect(resolveSpinPage({ liveCampaignId: "c1", signedIn: true, verified: true, userSpin: null, tokenSpin: spin("c1", "CLAIMED"), now })).toEqual({ spin: null, pendingClaim: false, needsVerification: false });
    expect(resolveSpinPage({ liveCampaignId: "c2", signedIn: true, verified: true, userSpin: null, tokenSpin: spin("c1"), now })).toEqual({ spin: null, pendingClaim: false, needsVerification: false });
  });

  it("claims the account's own held win (spun before verifying) once verified", () => {
    const own = spin("c1", "AWARDED");
    expect(resolveSpinPage({ liveCampaignId: "c1", signedIn: true, verified: true, userSpin: own, tokenSpin: null, now })).toEqual({
      spin: own,
      pendingClaim: true,
      needsVerification: false,
    });
  });

  it("an unverified account never auto-claims — it gets the verify-to-claim path instead", () => {
    const viaToken = resolveSpinPage({ liveCampaignId: "c1", signedIn: true, verified: false, userSpin: null, tokenSpin: spin("c1"), now });
    expect(viaToken).toMatchObject({ pendingClaim: false, needsVerification: true });
    const own = resolveSpinPage({ liveCampaignId: "c1", signedIn: true, verified: false, userSpin: spin("c1"), tokenSpin: null, now });
    expect(own).toMatchObject({ pendingClaim: false, needsVerification: true });
    const expired = resolveSpinPage({ liveCampaignId: "c1", signedIn: true, verified: false, userSpin: spin("c1", "AWARDED", past), tokenSpin: null, now });
    expect(expired).toMatchObject({ pendingClaim: false, needsVerification: false });
  });
});
