import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spin & Win engine against a REAL Postgres (claim flow, replays, races,
 * expiry, caps, stock re-validation). Skipped unless SPIN_TEST_DATABASE_URL
 * points at a LOCAL, disposable database with all migrations applied — it
 * refuses any non-localhost host so it can never touch the live DB.
 *
 *   SPIN_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable \
 *     npx vitest run lib/spin/service.int.test.ts
 */

const url = process.env.SPIN_TEST_DATABASE_URL;
const isLocal = !!url && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
if (url && !isLocal) throw new Error("SPIN_TEST_DATABASE_URL must point at localhost — refusing to run.");

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: () => unknown) => fn,
}));

if (isLocal) process.env.DATABASE_URL = url;
const ctx = isLocal
  ? { prisma: (await import("@/lib/prisma")).prisma, svc: await import("@/lib/spin/service") }
  : null;

describe.skipIf(!ctx)("spin service (integration)", () => {
  if (!ctx) return;
  const { prisma } = ctx;
  const { SpinError, spinWheel, claimSpin, markSpinRedeemed } = ctx.svc;

  const rngAt = (x: number) => () => x;
  let campaignId = "";
  const ids = { catId: "", A: "", B: "", C: "", a1: "", a2: "", b1: "", c1: "" };

  async function code(p: Promise<unknown>): Promise<string> {
    try {
      await p;
      return "OK";
    } catch (e) {
      if (e instanceof SpinError) return e.code;
      throw e;
    }
  }
  const user = (email: string) => prisma.user.create({ data: { email } });

  beforeAll(async () => {
    await prisma.spinResult.deleteMany();
    await prisma.spinCampaign.deleteMany();
    await prisma.coupon.deleteMany({ where: { code: { startsWith: "SPIN-" } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: "@spin.test" } } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: "spin-test-" } } });
    await prisma.category.deleteMany({ where: { slug: "spin-test-cat" } });

    const cat = await prisma.category.create({ data: { name: "Spin test", slug: "spin-test-cat" } });
    ids.catId = cat.id;
    const mk = async (slug: string, variants: { label: string; stock: number }[]) =>
      prisma.product.create({
        data: {
          name: slug,
          slug: `spin-test-${slug}`,
          description: "test",
          categoryId: cat.id,
          variants: { create: variants.map((v) => ({ weightLabel: v.label, price: 50000, stock: v.stock })) },
        },
        include: { variants: true },
      });
    const A = await mk("makhana", [
      { label: "100g", stock: 100 },
      { label: "250g", stock: 50 },
    ]);
    const B = await mk("lowstock", [{ label: "100g", stock: 3 }]);
    const C = await mk("moringa", [{ label: "200g", stock: 40 }]);
    Object.assign(ids, { A: A.id, B: B.id, C: C.id, a1: A.variants[0].id, a2: A.variants[1].id, b1: B.variants[0].id, c1: C.variants[0].id });
  });

  beforeEach(async () => {
    await prisma.spinResult.deleteMany();
    await prisma.spinCampaign.deleteMany();
    await prisma.productVariant.update({ where: { id: ids.a1 }, data: { stock: 100 } });
    await prisma.productVariant.update({ where: { id: ids.a2 }, data: { stock: 50 } });
    await prisma.productVariant.update({ where: { id: ids.c1 }, data: { stock: 40 } });
    const c = await prisma.spinCampaign.create({
      data: {
        name: "Test",
        isActive: true,
        prizes: [
          { percent: 10, weight: 1 },
          { percent: 20, weight: 1 },
        ],
        eligibleVariantIds: [ids.a1, ids.a2, ids.b1, ids.c1],
        minStock: 5,
        weightCap: 1000,
        claimWindowHours: 24,
        offerValidDays: 7,
      },
    });
    campaignId = c.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("anonymous spin is persisted server-side and replays idempotently (no re-roll)", async () => {
    const first = await spinWheel({ userId: null, anonId: "anon1", claimToken: null, rng: rngAt(0.1) });
    expect(first.created).toBe(true);
    expect(first.claimToken).toBeTruthy();
    expect(first.spin.status).toBe("AWARDED");
    expect(first.spin.tokenHash).not.toBe(first.claimToken); // only the hash is stored

    const again = await spinWheel({ userId: null, anonId: "anon1", claimToken: first.claimToken!, rng: rngAt(0.9) });
    expect(again.created).toBe(false);
    expect(again.spin.id).toBe(first.spin.id);
    expect(await prisma.spinResult.count()).toBe(1);
  });

  it("never awards an ineligible, low-stock or out-of-stock product", async () => {
    await prisma.productVariant.update({ where: { id: ids.c1 }, data: { stock: 0 } });
    for (let i = 0; i < 20; i++) {
      const s = await spinWheel({ userId: null, anonId: `a${i}`, claimToken: null, rng: rngAt((i + 0.5) / 20) });
      expect(s.spin.productId).toBe(ids.A); // B is at/below reserve, C is sold out
    }
  });

  it("sign-in claim attaches the win to the account and issues a personal single-use coupon", async () => {
    const u = await user("claim@spin.test");
    const s = await spinWheel({ userId: null, anonId: "anon", claimToken: null, rng: rngAt(0.1) });
    const { spin } = await claimSpin({ userId: u.id, claimToken: s.claimToken! });
    expect(spin).toMatchObject({ status: "CLAIMED", userId: u.id, tokenHash: null });
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { id: spin.couponId! } });
    expect(coupon).toMatchObject({
      ownerUserId: u.id,
      usageLimit: 1,
      perUserLimit: 1,
      value: spin.percent,
      saleMode: "BEST_OF",
      isPublic: false,
    });
    expect(coupon.variantIds.sort()).toEqual(spin.variantIds.sort());
    expect((await prisma.spinCampaign.findUniqueOrThrow({ where: { id: campaignId } })).claimCount).toBe(1);

    // Replaying the (now consumed) token can't mint a second coupon.
    expect(await code(claimSpin({ userId: u.id, claimToken: s.claimToken! }))).toBe("NOT_FOUND");
    expect(await prisma.coupon.count({ where: { ownerUserId: u.id } })).toBe(1);
  });

  it("one offer per account: a second anonymous win can't be claimed by the same user", async () => {
    const u = await user("dupe@spin.test");
    const s1 = await spinWheel({ userId: null, anonId: "x", claimToken: null, rng: rngAt(0.2) });
    await claimSpin({ userId: u.id, claimToken: s1.claimToken! });
    const s2 = await spinWheel({ userId: null, anonId: "y", claimToken: null, rng: rngAt(0.8) });
    expect(await code(claimSpin({ userId: u.id, claimToken: s2.claimToken! }))).toBe("ALREADY_CLAIMED");
    expect(await prisma.coupon.count({ where: { ownerUserId: u.id } })).toBe(1);
  });

  it("signed-in spin claims immediately; repeated and concurrent spins return the same single result", async () => {
    const u = await user("direct@spin.test");
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => spinWheel({ userId: u.id, anonId: null, claimToken: null, rng: rngAt(i / 5) })),
    );
    expect(new Set(results.map((r) => r.spin.id)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(await prisma.spinResult.count({ where: { userId: u.id } })).toBe(1);
    expect(await prisma.coupon.count({ where: { ownerUserId: u.id } })).toBe(1);
    expect(results[0].spin.status).toBe("CLAIMED");
  });

  it("concurrent claims of one win by two accounts: exactly one succeeds", async () => {
    const [u1, u2] = await Promise.all([user("race1@spin.test"), user("race2@spin.test")]);
    const s = await spinWheel({ userId: null, anonId: "r", claimToken: null, rng: rngAt(0.3) });
    const outcomes = await Promise.all([
      code(claimSpin({ userId: u1.id, claimToken: s.claimToken! })),
      code(claimSpin({ userId: u2.id, claimToken: s.claimToken! })),
    ]);
    expect(outcomes.filter((o) => o === "OK")).toHaveLength(1);
    expect(await prisma.coupon.count({ where: { ownerUserId: { in: [u1.id, u2.id] } } })).toBe(1);
    expect((await prisma.spinCampaign.findUniqueOrThrow({ where: { id: campaignId } })).claimCount).toBe(1);
  });

  it("an unclaimed win expires after the claim window", async () => {
    const u = await user("late@spin.test");
    const past = new Date(Date.now() - 48 * 3_600_000);
    const s = await spinWheel({ userId: null, anonId: "late", claimToken: null, now: past, rng: rngAt(0.5) });
    expect(await code(claimSpin({ userId: u.id, claimToken: s.claimToken! }))).toBe("EXPIRED");
    expect((await prisma.spinResult.findUniqueOrThrow({ where: { id: s.spin.id } })).status).toBe("EXPIRED");
    expect(await prisma.coupon.count({ where: { ownerUserId: u.id } })).toBe(0);
  });

  it("campaign claim cap is enforced and rolls back cleanly", async () => {
    await prisma.spinCampaign.update({ where: { id: campaignId }, data: { maxClaims: 1 } });
    const [u1, u2] = await Promise.all([user("cap1@spin.test"), user("cap2@spin.test")]);
    const s1 = await spinWheel({ userId: null, anonId: "c1", claimToken: null, rng: rngAt(0.1) });
    const s2 = await spinWheel({ userId: null, anonId: "c2", claimToken: null, rng: rngAt(0.1) });
    expect(await code(claimSpin({ userId: u1.id, claimToken: s1.claimToken! }))).toBe("OK");
    expect(await code(claimSpin({ userId: u2.id, claimToken: s2.claimToken! }))).toBe("CLAIM_LIMIT");
    expect(await prisma.coupon.count({ where: { ownerUserId: u2.id } })).toBe(0);
    expect((await prisma.spinResult.findUniqueOrThrow({ where: { id: s2.spin.id } })).status).toBe("AWARDED");
    // Campaign is no longer live once claims are exhausted.
    expect(await code(spinWheel({ userId: null, anonId: "c3", claimToken: null }))).toBe("NO_CAMPAIGN");
  });

  it("re-validates stock at claim: a sold-out prize moves to an in-stock product at the same %", async () => {
    const u = await user("moved@spin.test");
    const s = await spinWheel({ userId: null, anonId: "m", claimToken: null, rng: rngAt(0.01) });
    expect(s.spin.productId).toBe(ids.A);
    await prisma.productVariant.updateMany({ where: { id: { in: [ids.a1, ids.a2] } }, data: { stock: 0 } });
    const { spin, reassigned } = await claimSpin({ userId: u.id, claimToken: s.claimToken!, rng: rngAt(0.5) });
    expect(reassigned).toBe(true);
    expect(spin.productId).toBe(ids.C);
    expect(spin.percent).toBe(s.spin.percent);
  });

  it("refuses to spin when nothing is in stock or no campaign is live", async () => {
    await prisma.productVariant.updateMany({ where: { id: { in: [ids.a1, ids.a2, ids.c1] } }, data: { stock: 2 } });
    expect(await code(spinWheel({ userId: null, anonId: "n", claimToken: null }))).toBe("NO_STOCK");
    await prisma.spinCampaign.update({ where: { id: campaignId }, data: { isActive: false } });
    expect(await code(spinWheel({ userId: null, anonId: "n", claimToken: null }))).toBe("NO_CAMPAIGN");
  });

  it("redemption is recorded once", async () => {
    const u = await user("redeem@spin.test");
    const s = await spinWheel({ userId: u.id, anonId: null, claimToken: null, rng: rngAt(0.4) });
    expect(await markSpinRedeemed(s.spin.couponId!)).toBe(true);
    expect(await markSpinRedeemed(s.spin.couponId!)).toBe(false);
    expect((await prisma.spinResult.findUniqueOrThrow({ where: { id: s.spin.id } })).status).toBe("REDEEMED");
  });
});
