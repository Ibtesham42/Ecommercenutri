import { describe, expect, it } from "vitest";
import { spinFunnel } from "@/lib/spin/stats";

describe("spinFunnel (I10)", () => {
  it("counts AWARDED wins past their deadline as expired, not pending", () => {
    expect(spinFunnel({ awarded: 10, awardedPastDeadline: 4, claimed: 5, redeemed: 2, expired: 3 })).toEqual({
      spins: 20,
      pending: 6,
      claimed: 7,
      redeemed: 2,
      expired: 7,
    });
  });
  it("never goes negative on inconsistent input", () => {
    expect(spinFunnel({ awarded: 1, awardedPastDeadline: 5, claimed: 0, redeemed: 0, expired: 0 })).toMatchObject({
      pending: 0,
      expired: 1,
    });
  });
});
