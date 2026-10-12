import { describe, expect, it, vi } from "vitest";

/** I8 regression: personal Spin & Win coupons never appear in the marketing coupon picker. */

vi.mock("server-only", () => ({}));
vi.mock("@/lib/marketing/templates", () => ({ ensureBuiltInTemplates: vi.fn() }));
vi.mock("@/lib/env", () => ({ isConfigured: new Proxy({}, { get: () => () => false }) }));
const couponFindMany = vi.fn().mockResolvedValue([]);
const empty = { findMany: vi.fn().mockResolvedValue([]) };
vi.mock("@/lib/prisma", () => ({
  prisma: {
    coupon: { findMany: couponFindMany },
    product: empty,
    category: empty,
    audienceSegment: empty,
    campaignTemplate: empty,
  },
}));

const { getComposeData } = await import("@/lib/queries/marketing");

describe("marketing compose coupon picker", () => {
  it("excludes coupons owned by a spin result", async () => {
    await getComposeData();
    expect(couponFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, spinResult: { is: null } } }),
    );
  });
});
