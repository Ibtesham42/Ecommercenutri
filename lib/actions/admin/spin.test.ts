import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Admin Spin & Win actions: gated by the existing "coupons" permission, and a
 * campaign can only run with an explicitly verified, exact eligibility list.
 */

const requirePermission = vi.fn();
const prismaMock = {
  productVariant: { findMany: vi.fn() },
  spinCampaign: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  spinResult: { count: vi.fn() },
};
vi.mock("@/lib/auth", () => ({ requirePermission }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { saveSpinCampaign, setSpinCampaignActive, deleteSpinCampaign, verifySpinEligibility } = await import(
  "@/lib/actions/admin/spin"
);

const valid = {
  name: "Diwali wheel",
  isActive: false,
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

// The live catalogue as the actions see it.
let catalogue: { id: string; productId: string; weightLabel: string; weightInGrams: number | null; name: string }[];
const snap = (over: Record<string, unknown> = {}) => [
  { variantId: "v1", productId: "p1", productName: "Moringa Powder", weightLabel: "100g", weightInGrams: 100, ...over },
];
const verifiedCampaign = (over: Record<string, unknown> = {}) => ({
  eligibleVariantIds: ["v1"],
  eligibilityVerifiedAt: new Date("2026-10-12T10:00:00Z"),
  eligibilitySnapshot: snap(),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue({ id: "admin_1" });
  catalogue = [{ id: "v1", productId: "p1", weightLabel: "100g", weightInGrams: 100, name: "Moringa Powder" }];
  prismaMock.productVariant.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
    catalogue
      .filter((v) => where.id.in.includes(v.id))
      .map((v) => ({ ...v, product: { name: v.name } })),
  );
  prismaMock.spinCampaign.create.mockResolvedValue({ id: "camp" });
  prismaMock.spinCampaign.update.mockResolvedValue({ id: "camp" });
  prismaMock.spinCampaign.updateMany.mockResolvedValue({ count: 1 });
});

describe("admin spin actions — RBAC", () => {
  it("every action requires the coupons permission and does nothing without it", async () => {
    requirePermission.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(saveSpinCampaign(valid)).rejects.toThrow("FORBIDDEN");
    await expect(setSpinCampaignActive("camp", false)).rejects.toThrow("FORBIDDEN");
    await expect(deleteSpinCampaign("camp")).rejects.toThrow("FORBIDDEN");
    await expect(verifySpinEligibility({ id: "camp", variantIds: ["v1"], confirmed: true })).rejects.toThrow("FORBIDDEN");
    expect(requirePermission).toHaveBeenCalledWith("coupons");
    expect(prismaMock.spinCampaign.create).not.toHaveBeenCalled();
    expect(prismaMock.spinCampaign.update).not.toHaveBeenCalled();
    expect(prismaMock.spinCampaign.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.spinCampaign.delete).not.toHaveBeenCalled();
  });
});

describe("saveSpinCampaign validation", () => {
  it("creates a paused campaign, storing only existing variant ids, unverified", async () => {
    const res = await saveSpinCampaign({ ...valid, eligibleVariantIds: ["v1", "ghost"] });
    expect(res).toEqual({ ok: true, data: { id: "camp" } });
    const data = prismaMock.spinCampaign.create.mock.calls[0][0].data;
    expect(data.eligibleVariantIds).toEqual(["v1"]);
    expect(data.eligibilityVerifiedAt).toBeNull();
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

describe("Phase 3 — campaigns stay off until the exact eligibility is verified", () => {
  it("a brand-new campaign can't be created enabled", async () => {
    const res = await saveSpinCampaign({ ...valid, isActive: true });
    expect(res.ok).toBe(false);
    expect(prismaMock.spinCampaign.create).not.toHaveBeenCalled();
  });

  it("an unverified campaign can't be enabled", async () => {
    prismaMock.spinCampaign.findUnique.mockResolvedValue(verifiedCampaign({ eligibilityVerifiedAt: null, eligibilitySnapshot: null }));
    expect((await setSpinCampaignActive("camp", true)).ok).toBe(false);
    expect(prismaMock.spinCampaign.update).not.toHaveBeenCalled();
  });

  it("a verified campaign can be enabled; pausing is always allowed", async () => {
    prismaMock.spinCampaign.findUnique.mockResolvedValue(verifiedCampaign());
    expect(await setSpinCampaignActive("camp", true)).toEqual({ ok: true });
    prismaMock.spinCampaign.findUnique.mockResolvedValue(verifiedCampaign({ eligibilityVerifiedAt: null }));
    expect(await setSpinCampaignActive("camp", false)).toEqual({ ok: true });
  });

  it("refuses to enable when a verified variant changed size or product since verification", async () => {
    prismaMock.spinCampaign.findUnique.mockResolvedValue(verifiedCampaign());
    catalogue[0].weightLabel = "500g";
    catalogue[0].weightInGrams = 500;
    expect((await setSpinCampaignActive("camp", true)).ok).toBe(false);
    catalogue[0] = { id: "v1", productId: "p_other", weightLabel: "100g", weightInGrams: 100, name: "Moringa Powder" };
    expect((await setSpinCampaignActive("camp", true)).ok).toBe(false);
    catalogue.length = 0; // variant deleted
    expect((await setSpinCampaignActive("camp", true)).ok).toBe(false);
    expect(prismaMock.spinCampaign.update).not.toHaveBeenCalled();
  });

  it("a product rename alone doesn't block enabling (IDs and size unchanged)", async () => {
    prismaMock.spinCampaign.findUnique.mockResolvedValue(verifiedCampaign());
    catalogue[0].name = "Organic Moringa Powder";
    expect(await setSpinCampaignActive("camp", true)).toEqual({ ok: true });
  });

  it("editing the eligible list clears the verification (and can't keep it enabled)", async () => {
    catalogue.push({ id: "v2", productId: "p2", weightLabel: "100g", weightInGrams: 100, name: "Turmeric Powder" });
    prismaMock.spinCampaign.findUnique.mockResolvedValue(verifiedCampaign());
    expect((await saveSpinCampaign({ ...valid, id: "camp", isActive: true, eligibleVariantIds: ["v1", "v2"] })).ok).toBe(false);
    expect(prismaMock.spinCampaign.update).not.toHaveBeenCalled();

    const res = await saveSpinCampaign({ ...valid, id: "camp", eligibleVariantIds: ["v1", "v2"] });
    expect(res.ok).toBe(true);
    const data = prismaMock.spinCampaign.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ eligibilityVerifiedAt: null, eligibilityVerifiedById: null, isActive: false });
  });

  it("editing other fields keeps a valid verification (and may stay enabled)", async () => {
    prismaMock.spinCampaign.findUnique.mockResolvedValue(verifiedCampaign());
    const res = await saveSpinCampaign({ ...valid, id: "camp", isActive: true, name: "Renamed wheel" });
    expect(res.ok).toBe(true);
    const data = prismaMock.spinCampaign.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("eligibilityVerifiedAt");
    expect(data.isActive).toBe(true);
  });
});

describe("verifySpinEligibility", () => {
  beforeEach(() => {
    prismaMock.spinCampaign.findUnique.mockResolvedValue({ eligibleVariantIds: ["v1"] });
  });

  it("requires an explicit confirmation", async () => {
    expect((await verifySpinEligibility({ id: "camp", variantIds: ["v1"], confirmed: false })).ok).toBe(false);
    expect(prismaMock.spinCampaign.updateMany).not.toHaveBeenCalled();
  });

  it("records who verified, when, and an exact ID + size snapshot — without enabling", async () => {
    expect(await verifySpinEligibility({ id: "camp", variantIds: ["v1"], confirmed: true })).toEqual({ ok: true });
    const call = prismaMock.spinCampaign.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "camp", eligibleVariantIds: { equals: ["v1"] } });
    expect(call.data.eligibilityVerifiedById).toBe("admin_1");
    expect(call.data.eligibilityVerifiedAt).toBeInstanceOf(Date);
    expect(call.data.eligibilitySnapshot).toEqual(snap());
    expect(call.data).not.toHaveProperty("isActive");
  });

  it("refuses when the list changed since the admin reviewed it", async () => {
    expect((await verifySpinEligibility({ id: "camp", variantIds: ["v1", "v9"], confirmed: true })).ok).toBe(false);
    prismaMock.spinCampaign.updateMany.mockResolvedValue({ count: 0 }); // concurrent edit
    expect((await verifySpinEligibility({ id: "camp", variantIds: ["v1"], confirmed: true })).ok).toBe(false);
  });

  it("refuses when a listed variant no longer exists", async () => {
    catalogue.length = 0;
    expect((await verifySpinEligibility({ id: "camp", variantIds: ["v1"], confirmed: true })).ok).toBe(false);
    expect(prismaMock.spinCampaign.updateMany).not.toHaveBeenCalled();
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
