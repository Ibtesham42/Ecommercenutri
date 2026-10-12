import { hasLocalDb } from "@/lib/test/local-db-env"; // must stay first: pins DB + blanks live keys
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Phase 3 admin flow against a real local Postgres: create (paused) → enable
 * refused → verify (exact snapshot) → enable → edit list clears verification
 * and pauses → engine treats it as not live. Sequential.
 */

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: () => unknown) => fn }));
const requirePermission = vi.fn();
vi.mock("@/lib/auth", () => ({ requirePermission }));

const ctx = hasLocalDb
  ? {
      prisma: (await import("@/lib/prisma")).prisma,
      admin: await import("@/lib/actions/admin/spin"),
      svc: await import("@/lib/spin/service"),
    }
  : null;

describe.skipIf(!ctx)("admin eligibility verification (integration)", () => {
  if (!ctx) return;
  const { prisma } = ctx;
  const { saveSpinCampaign, setSpinCampaignActive, verifySpinEligibility } = ctx.admin;
  const ids = { a: "", b: "", admin: "" };

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE "Order", "SpinResult", "SpinCampaign" CASCADE`);
    await prisma.product.deleteMany({ where: { slug: { startsWith: "elig-test-" } } });
    await prisma.category.deleteMany({ where: { slug: "elig-test-cat" } });
    await prisma.user.deleteMany({ where: { email: "admin@elig.test" } });
    const cat = await prisma.category.create({ data: { name: "e", slug: "elig-test-cat" } });
    const p = await prisma.product.create({
      data: {
        name: "Moringa Powder",
        slug: "elig-test-moringa",
        description: "t",
        categoryId: cat.id,
        variants: { create: [{ weightLabel: "100g", weightInGrams: 100, price: 20000, stock: 50 }, { weightLabel: "200g", weightInGrams: 200, price: 35000, stock: 50 }] },
      },
      include: { variants: { orderBy: { weightInGrams: "asc" } } },
    });
    const admin = await prisma.user.create({ data: { email: "admin@elig.test", role: "SUPER_ADMIN" } });
    Object.assign(ids, { a: p.variants[0].id, b: p.variants[1].id, admin: admin.id });
    requirePermission.mockResolvedValue({ id: admin.id });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const base = {
    name: "Wheel",
    isActive: false,
    prizes: [
      { percent: 10, weight: 1 },
      { percent: 20, weight: 1 },
    ],
    minStock: 5,
    weightCap: 200,
    claimWindowHours: 24,
    offerValidDays: 7,
    saleMode: "BEST_OF",
  };

  it("full flow: off until verified; editing the list switches it off again", async () => {
    const created = await saveSpinCampaign({ ...base, eligibleVariantIds: [ids.a] });
    expect(created.ok).toBe(true);
    const id = (created as { data: { id: string } }).data.id;

    expect((await setSpinCampaignActive(id, true)).ok).toBe(false);
    expect(await ctx!.svc.getLiveCampaign()).toBeNull();

    expect(await verifySpinEligibility({ id, variantIds: [ids.a], confirmed: true })).toEqual({ ok: true });
    const verified = await prisma.spinCampaign.findUniqueOrThrow({ where: { id } });
    expect(verified.eligibilityVerifiedById).toBe(ids.admin);
    expect(verified.eligibilitySnapshot).toEqual([
      { variantId: ids.a, productId: expect.any(String), productName: "Moringa Powder", weightLabel: "100g", weightInGrams: 100 },
    ]);
    expect(verified.isActive).toBe(false); // verifying never enables

    expect(await setSpinCampaignActive(id, true)).toEqual({ ok: true });
    expect((await ctx!.svc.getLiveCampaign())?.id).toBe(id);

    // Changing the list while live is refused; saved paused it clears verification.
    expect((await saveSpinCampaign({ ...base, id, isActive: true, eligibleVariantIds: [ids.a, ids.b] })).ok).toBe(false);
    expect((await saveSpinCampaign({ ...base, id, eligibleVariantIds: [ids.a, ids.b] })).ok).toBe(true);
    const edited = await prisma.spinCampaign.findUniqueOrThrow({ where: { id } });
    expect(edited).toMatchObject({ isActive: false, eligibilityVerifiedAt: null, eligibilityVerifiedById: null, eligibilitySnapshot: null });
    expect(await ctx!.svc.getLiveCampaign()).toBeNull();

    // A stale review (list changed after the admin looked) can't be recorded.
    expect((await verifySpinEligibility({ id, variantIds: [ids.a], confirmed: true })).ok).toBe(false);
  });

  it("a size change after verification blocks enabling until re-verified", async () => {
    const created = await saveSpinCampaign({ ...base, name: "Wheel 2", eligibleVariantIds: [ids.b] });
    const id = (created as { data: { id: string } }).data.id;
    await verifySpinEligibility({ id, variantIds: [ids.b], confirmed: true });
    await prisma.productVariant.update({ where: { id: ids.b }, data: { weightLabel: "250g", weightInGrams: 250 } });
    expect((await setSpinCampaignActive(id, true)).ok).toBe(false);
    await verifySpinEligibility({ id, variantIds: [ids.b], confirmed: true });
    expect(await setSpinCampaignActive(id, true)).toEqual({ ok: true });
  });
});
