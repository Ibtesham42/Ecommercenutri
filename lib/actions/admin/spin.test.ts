import { beforeEach, describe, expect, it, vi } from "vitest";

/** Admin Spin & Win actions are gated by the existing "coupons" permission. */

const requirePermission = vi.fn();
const prismaMock = {
  productVariant: { findMany: vi.fn() },
  spinCampaign: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  spinResult: { count: vi.fn() },
};
vi.mock("@/lib/auth", () => ({ requirePermission }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { saveSpinCampaign, setSpinCampaignActive, deleteSpinCampaign } = await import("@/lib/actions/admin/spin");

const valid = {
  name: "Diwali wheel",
  isActive: true,
  startsAt: null,
  endsAt: null,
  prizes: [
    { percent: 5, weight: 10 },
    { percent: 10, weight: 5 },
  ],
  eligibleVariantIds: ["v1"],
  minStock: 5,
  weightCap: 200,
  claimWindowHours: 24,
  offerValidDays: 7,
  maxClaims: null,
  minOrder: null,
  maxDiscount: null,
  saleMode: "BEST_OF",
};

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ id: "admin" });
  prismaMock.productVariant.findMany.mockResolvedValue([{ id: "v1" }]);
  prismaMock.spinCampaign.create.mockResolvedValue({ id: "camp" });
});

describe("admin spin actions — RBAC", () => {
  it("every action requires the coupons permission and does nothing without it", async () => {
    requirePermission.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(saveSpinCampaign(valid)).rejects.toThrow("FORBIDDEN");
    await expect(setSpinCampaignActive("camp", false)).rejects.toThrow("FORBIDDEN");
    await expect(deleteSpinCampaign("camp")).rejects.toThrow("FORBIDDEN");
    expect(requirePermission).toHaveBeenCalledWith("coupons");
    expect(prismaMock.spinCampaign.create).not.toHaveBeenCalled();
    expect(prismaMock.spinCampaign.update).not.toHaveBeenCalled();
    expect(prismaMock.spinCampaign.delete).not.toHaveBeenCalled();
  });
});

describe("saveSpinCampaign validation", () => {
  it("creates a valid campaign, storing only existing variant ids", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([{ id: "v1" }]);
    const res = await saveSpinCampaign({ ...valid, eligibleVariantIds: ["v1", "ghost"] });
    expect(res).toEqual({ ok: true, data: { id: "camp" } });
    expect(prismaMock.spinCampaign.create.mock.calls[0][0].data.eligibleVariantIds).toEqual(["v1"]);
  });

  it("rejects duplicate tiers, all-zero weights, bad windows and out-of-range %", async () => {
    const bad = [
      { prizes: [{ percent: 5, weight: 1 }, { percent: 5, weight: 1 }] },
      { prizes: [{ percent: 5, weight: 0 }, { percent: 10, weight: 0 }] },
      { startsAt: "2026-11-02T00:00:00Z", endsAt: "2026-11-01T00:00:00Z" },
      { prizes: [{ percent: 5, weight: 1 }, { percent: 80, weight: 1 }] },
      { isActive: true, eligibleVariantIds: [] },
    ];
    for (const patch of bad) {
      const res = await saveSpinCampaign({ ...valid, ...patch });
      expect(res.ok).toBe(false);
    }
    expect(prismaMock.spinCampaign.create).not.toHaveBeenCalled();
  });
});

describe("deleteSpinCampaign", () => {
  it("refuses to delete a played campaign (pause keeps history)", async () => {
    prismaMock.spinResult.count.mockResolvedValue(3);
    const res = await deleteSpinCampaign("camp");
    expect(res.ok).toBe(false);
    expect(prismaMock.spinCampaign.delete).not.toHaveBeenCalled();
  });
});
