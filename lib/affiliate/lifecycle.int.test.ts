import { hasLocalDb } from "@/lib/test/local-db-env"; // must stay first: pins DB + blanks live keys
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Affiliate program end to end on a real (local, disposable) Postgres: apply →
 * admin review → referral attribution → the real createOrder (keyless mock
 * payment — no gateway, no money moves) → commission → delivery → returns →
 * maturation → payout. Also the regressions found in the 2026-10-19 audit.
 *
 *   SPIN_TEST_DATABASE_URL=... npx vitest run lib/affiliate/lifecycle.int.test.ts
 */

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: () => unknown) => fn }));
vi.mock("server-only", () => ({}));
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (cookieJar.has(k) ? { name: k, value: cookieJar.get(k)! } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1" }),
}));
const getCurrentUser = vi.fn();
const requirePermission = vi.fn(async () => ({ email: "ops@local.test" }));
vi.mock("@/lib/auth", () => ({ getCurrentUser, requirePermission }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/pdf/invoice-pdf", () => ({ renderInvoiceBuffer: vi.fn(async () => Buffer.from("")) }));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn() }));

const ctx = hasLocalDb
  ? {
      prisma: (await import("@/lib/prisma")).prisma,
      checkout: await import("@/lib/actions/checkout"),
      orders: await import("@/lib/orders"),
      aff: await import("@/lib/actions/affiliate"),
      admin: await import("@/lib/actions/admin/affiliates"),
      engine: await import("@/lib/affiliate/commissions"),
      queries: await import("@/lib/queries/affiliate"),
      returnsAction: await import("@/lib/actions/returns"),
      returns: await import("@/lib/returns"),
      refRoute: await import("@/app/ref/[code]/route"),
    }
  : null;

const DAY = 86_400_000;

describe.skipIf(!ctx)("Affiliate program lifecycle (integration)", () => {
  if (!ctx) return;
  const { prisma, checkout, aff, admin, engine } = ctx;
  const ids = { v1: "", v2: "", alice: "", bob: "", carol: "", buyer: "", address: "", aliceAff: "", bobAff: "" };

  const as = (id: string) => getCurrentUser.mockResolvedValue({ id, email: `${id}@aff.test`, name: id });
  const referBy = (code: string, at = Date.now()) => {
    cookieJar.set("nut_ref", code);
    cookieJar.set("nut_ref_at", String(at));
  };

  async function order(items: { variantId: string; quantity: number }[], couponCode?: string) {
    as(ids.buyer);
    const res = await checkout.createOrder({ items, addressId: ids.address, couponCode, paymentMethod: "RAZORPAY" });
    expect(res).toMatchObject({ ok: true, mock: true });
    return prisma.order.findUniqueOrThrow({
      where: { orderNumber: (res as { orderNumber: string }).orderNumber },
      include: { items: true, commission: true },
    });
  }

  async function deliveredAgo(orderId: string, days: number) {
    await ctx!.orders.transitionOrderStatus(orderId, "DELIVERED", { actor: "admin" });
    await prisma.commission.updateMany({ where: { orderId }, data: { matureAt: new Date(Date.now() - days * DAY) } });
  }

  const commissionOf = (orderId: string) => prisma.commission.findUnique({ where: { orderId } });

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE "Order", "Commission", "Payout", "AffiliateClick", "Affiliate", "CommissionRule" CASCADE`);
    await prisma.coupon.deleteMany({ where: { description: { startsWith: "Affiliate " } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: "@aff.test" } } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: "aff-test-" } } });
    await prisma.category.deleteMany({ where: { slug: "aff-test-cat" } });
    await prisma.storeSetting.upsert({
      where: { id: "singleton" },
      update: { affiliateEnabled: true, affiliateCookieDays: 30, affiliateDefaultCommissionType: "PERCENT", affiliateDefaultCommissionValue: 10, affiliateMinPayout: 3000 },
      create: { id: "singleton", affiliateEnabled: true, affiliateCookieDays: 30, affiliateMinPayout: 3000 },
    });
    const cat = await prisma.category.create({ data: { name: "aff", slug: "aff-test-cat" } });
    const mk = (slug: string, price: number) =>
      prisma.product.create({
        data: {
          name: slug,
          slug: `aff-test-${slug}`,
          description: "t",
          categoryId: cat.id,
          gstRate: 5,
          deliveryCharge: 0,
          variants: { create: [{ weightLabel: "250g", price, stock: 1000 }] },
        },
        include: { variants: true },
      });
    const [p1, p2] = [await mk("makhana", 50000), await mk("almonds", 30000)];
    const user = (n: string) => prisma.user.create({ data: { email: `${n}@aff.test`, name: n, emailVerified: new Date() } });
    const [alice, bob, carol, buyer] = [await user("alice"), await user("bob"), await user("carol"), await user("buyer")];
    const a = await prisma.address.create({
      data: { userId: buyer.id, fullName: "Buyer", phone: "9800000000", line1: "1 Road", city: "Pune", state: "MH", pincode: "411001" },
    });
    Object.assign(ids, { v1: p1.variants[0].id, v2: p2.variants[0].id, alice: alice.id, bob: bob.id, carol: carol.id, buyer: buyer.id, address: a.id });
  });

  beforeEach(() => cookieJar.clear());
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const apply = (displayName: string, extra: Record<string, unknown> = {}) =>
    aff.applyAffiliate({ role: "INFLUENCER", displayName, agree: true, ...extra });

  it("application: validates, blocks duplicates, and is closed while the program is paused", async () => {
    as(ids.alice);
    expect(await aff.applyAffiliate({ role: "INFLUENCER", displayName: "A", agree: true })).toMatchObject({ ok: false });
    expect(await aff.applyAffiliate({ role: "INFLUENCER", displayName: "Alice Fit", agree: false })).toMatchObject({ ok: false });
    expect(await apply("Alice Fit")).toEqual({ ok: true });
    expect(await apply("Alice Again")).toMatchObject({ ok: false, error: expect.stringMatching(/already/) });

    await prisma.storeSetting.update({ where: { id: "singleton" }, data: { affiliateEnabled: false } });
    as(ids.bob);
    expect(await apply("Bob Gym")).toMatchObject({ ok: false, error: expect.stringMatching(/isn't accepting/) });
    await prisma.storeSetting.update({ where: { id: "singleton" }, data: { affiliateEnabled: true } });
    expect(await apply("Bob Gym")).toEqual({ ok: true });

    const [a, b] = await Promise.all([
      prisma.affiliate.findUniqueOrThrow({ where: { userId: ids.alice } }),
      prisma.affiliate.findUniqueOrThrow({ where: { userId: ids.bob } }),
    ]);
    expect([a.status, b.status]).toEqual(["PENDING", "PENDING"]);
    expect(a.code).not.toBe(b.code);
    ids.aliceAff = a.id;
    ids.bobAff = b.id;
  });

  it("pending affiliates can't earn: their link attributes nothing", async () => {
    const a = await prisma.affiliate.findUniqueOrThrow({ where: { id: ids.aliceAff } });
    referBy(a.code);
    const o = await order([{ variantId: ids.v1, quantity: 1 }]);
    expect(o.affiliateId).toBeNull();
    expect(o.commission).toBeNull();
  });

  it("admin review: approve creates an active coupon; reject → re-apply → approve reuses and re-activates it", async () => {
    expect(await admin.approveAffiliate({ affiliateId: ids.aliceAff, couponCode: "ALICE10", couponPercent: 10 })).toEqual({ ok: true });
    expect(await admin.approveAffiliate({ affiliateId: ids.aliceAff })).toMatchObject({ ok: false }); // already approved
    expect(await admin.approveAffiliate({ affiliateId: ids.bobAff, couponCode: "BOB10", couponPercent: 10 })).toEqual({ ok: true });

    // An active affiliate is suspended, never "rejected".
    expect(await admin.rejectAffiliate({ affiliateId: ids.aliceAff, reason: "x" })).toMatchObject({ ok: false });

    // Carol: rejected, re-applies, then approved → gets a working coupon.
    as(ids.carol);
    expect(await apply("Carol Blogs")).toEqual({ ok: true });
    const carol = await prisma.affiliate.findUniqueOrThrow({ where: { userId: ids.carol } });
    expect(await admin.rejectAffiliate({ affiliateId: carol.id, reason: "Not a fit" })).toEqual({ ok: true });
    as(ids.carol);
    expect(await apply("Carol Blogs")).toEqual({ ok: true });
    expect(await admin.approveAffiliate({ affiliateId: carol.id, couponCode: "CAROL10" })).toEqual({ ok: true });
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "CAROL10" } })).isActive).toBe(true);

    // A legacy row: REJECTED but still holding a (deactivated) coupon is re-activated on approval.
    await prisma.affiliate.update({ where: { id: carol.id }, data: { status: "REJECTED" } });
    await prisma.coupon.update({ where: { code: "CAROL10" }, data: { isActive: false } });
    expect(await admin.approveAffiliate({ affiliateId: carol.id })).toEqual({ ok: true });
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "CAROL10" } })).isActive).toBe(true);
  });

  it("referral link: commission = rate × post-discount item value, excluding shipping/tax-on-top", async () => {
    const a = await prisma.affiliate.findUniqueOrThrow({ where: { id: ids.aliceAff } });
    referBy(a.code);
    const o = await order([{ variantId: ids.v1, quantity: 2 }]); // ₹1,000 of items
    expect(o.affiliateId).toBe(a.id);
    expect(o.referralCode).toBe(a.code);
    expect(o.commission).toMatchObject({ status: "PENDING", base: 100000, amount: 10000 });
    expect(o.total - o.shipping).toBe(100000); // commission never includes shipping
  });

  it("coupon precedence: the coupon's affiliate wins over a referral cookie; the discount is excluded", async () => {
    const a = await prisma.affiliate.findUniqueOrThrow({ where: { id: ids.aliceAff } });
    referBy(a.code);
    const o = await order([{ variantId: ids.v1, quantity: 1 }], "BOB10");
    expect(o.affiliateId).toBe(ids.bobAff);
    expect(o.discount).toBe(5000);
    expect(o.commission).toMatchObject({ base: 45000, amount: 4500 });
  });

  it("self-referral (own link or own coupon) earns nothing", async () => {
    const a = await prisma.affiliate.findUniqueOrThrow({ where: { id: ids.aliceAff } });
    referBy(a.code);
    as(ids.alice);
    const addr = await prisma.address.create({
      data: { userId: ids.alice, fullName: "A", phone: "9800000001", line1: "1", city: "Pune", state: "MH", pincode: "411001" },
    });
    for (const couponCode of [undefined, "ALICE10"]) {
      const res = await checkout.createOrder({ items: [{ variantId: ids.v2, quantity: 1 }], addressId: addr.id, couponCode, paymentMethod: "RAZORPAY" });
      const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: (res as { orderNumber: string }).orderNumber }, include: { commission: true } });
      expect(o.affiliateId).toBeNull();
      expect(o.commission).toBeNull();
    }
  });

  it("attribution window: the admin's cookie-days setting is enforced, not a hard-coded 30 days", async () => {
    const a = await prisma.affiliate.findUniqueOrThrow({ where: { id: ids.aliceAff } });
    await prisma.storeSetting.update({ where: { id: "singleton" }, data: { affiliateCookieDays: 7 } });
    referBy(a.code, Date.now() - 8 * DAY);
    expect((await order([{ variantId: ids.v2, quantity: 1 }])).affiliateId).toBeNull();
    referBy(a.code, Date.now() - 6 * DAY);
    expect((await order([{ variantId: ids.v2, quantity: 1 }])).affiliateId).toBe(a.id);
    await prisma.storeSetting.update({ where: { id: "singleton" }, data: { affiliateCookieDays: 30 } });
  });

  it("duplicate payment confirmations (webhook + success page) create exactly one commission", async () => {
    const a = await prisma.affiliate.findUniqueOrThrow({ where: { id: ids.aliceAff } });
    referBy(a.code);
    const o = await order([{ variantId: ids.v2, quantity: 1 }]);
    await Promise.all([
      ctx!.orders.markOrderPaid(o.id),
      ctx!.orders.markOrderPaid(o.id),
      engine.createOrderCommission(o.id),
      engine.createOrderCommission(o.id),
    ]);
    expect(await prisma.commission.count({ where: { orderId: o.id } })).toBe(1);
  });

  it("unpaid / abandoned checkouts are never counted as referred orders or sales", async () => {
    const before = await ctx!.queries.getAffiliateDashboard({ id: ids.aliceAff, couponId: null });
    await prisma.order.create({
      data: {
        orderNumber: `ABANDON-${Date.now()}`,
        userId: ids.buyer,
        status: "PENDING",
        paymentStatus: "PENDING",
        paymentMethod: "RAZORPAY",
        subtotal: 50000,
        total: 50000,
        shippingAddress: {},
        affiliateId: ids.aliceAff,
        referralCode: "x",
      },
    });
    const after = await ctx!.queries.getAffiliateDashboard({ id: ids.aliceAff, couponId: null });
    expect(after.orders).toBe(before.orders);
    expect(after.revenue).toBe(before.revenue);
  });

  it("cancellation voids the commission", async () => {
    const a = await prisma.affiliate.findUniqueOrThrow({ where: { id: ids.aliceAff } });
    referBy(a.code);
    const o = await order([{ variantId: ids.v2, quantity: 1 }]);
    await ctx!.orders.transitionOrderStatus(o.id, "CANCELLED", { actor: "admin", reason: "test" });
    expect((await commissionOf(o.id))!.status).toBe("CANCELLED");
  });

  it("returns: an open return holds maturation; a partial refund reduces the commission; a full refund voids it", async () => {
    const a = await prisma.affiliate.findUniqueOrThrow({ where: { id: ids.aliceAff } });
    referBy(a.code);
    const o = await order([
      { variantId: ids.v1, quantity: 2 },
      { variantId: ids.v2, quantity: 1 },
    ]); // ₹1,000 + ₹300 → ₹130 commission
    expect(o.commission!.amount).toBe(13000);
    await deliveredAgo(o.id, 0);

    as(ids.buyer);
    const line = o.items.find((i) => i.variantId === ids.v1)!;
    expect(await ctx!.returnsAction.requestReturn({ orderNumber: o.orderNumber, reason: "Damaged", media: [], items: [{ orderItemId: line.id, quantity: 1 }] })).toMatchObject({ ok: true });
    await prisma.commission.updateMany({ where: { orderId: o.id }, data: { matureAt: new Date(Date.now() - DAY) } });
    await engine.matureCommissions();
    expect((await commissionOf(o.id))!.status).toBe("PENDING"); // held while the return is open

    const ret = await prisma.returnRequest.findFirstOrThrow({ where: { orderId: o.id } });
    await ctx!.returns.processRefund(ret.id, { amount: ret.refundAmount, method: "UPI", reference: "t" });
    expect(await commissionOf(o.id)).toMatchObject({ status: "PENDING", amount: 8000, base: 80000 });
    await engine.matureCommissions();
    expect(await commissionOf(o.id)).toMatchObject({ status: "APPROVED", amount: 8000 });

    // Return the rest → whole order refunded → commission voided.
    const v2line = o.items.find((i) => i.variantId === ids.v2)!;
    as(ids.buyer);
    await ctx!.returnsAction.requestReturn({
      orderNumber: o.orderNumber,
      reason: "Damaged",
      media: [],
      items: [
        { orderItemId: line.id, quantity: 1 },
        { orderItemId: v2line.id, quantity: 1 },
      ],
    });
    const ret2 = await prisma.returnRequest.findFirstOrThrow({ where: { orderId: o.id, status: { not: "REFUNDED" } } });
    await ctx!.returns.processRefund(ret2.id, { amount: ret2.refundAmount, method: "UPI", reference: "t" });
    expect((await commissionOf(o.id))!.status).toBe("CANCELLED");
  });

  it("a suspended affiliate earns nothing on orders confirmed after suspension; reactivation restores coupon", async () => {
    const b = await prisma.affiliate.findUniqueOrThrow({ where: { id: ids.bobAff } });
    referBy(b.code);
    // Order placed (attributed) while active, then the affiliate is suspended before payment confirms.
    as(ids.buyer);
    const priced = await prisma.order.create({
      data: {
        orderNumber: `SUSP-${Date.now()}`,
        userId: ids.buyer,
        paymentMethod: "RAZORPAY",
        subtotal: 30000,
        total: 30000,
        shippingAddress: {},
        affiliateId: b.id,
        referralCode: b.code,
        items: { create: [{ productId: null, variantId: ids.v2, productName: "x", variantLabel: "x", price: 30000, quantity: 1 }] },
      },
    });
    expect(await admin.suspendAffiliate({ affiliateId: b.id, reason: "Review" })).toEqual({ ok: true });
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "BOB10" } })).isActive).toBe(false);
    await ctx!.orders.markOrderPaid(priced.id);
    expect(await commissionOf(priced.id)).toBeNull();

    expect(await admin.reactivateAffiliate({ affiliateId: b.id })).toEqual({ ok: true });
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "BOB10" } })).isActive).toBe(true);
    expect(await admin.reactivateAffiliate({ affiliateId: b.id })).toMatchObject({ ok: false }); // not suspended
  });

  it("payout details are validated for the chosen method", async () => {
    as(ids.alice);
    expect(await aff.updatePayoutDetails({ payoutMethod: "UPI", upiId: "" })).toMatchObject({ ok: false });
    expect(await aff.updatePayoutDetails({ payoutMethod: "UPI", upiId: "not a upi" })).toMatchObject({ ok: false });
    expect(await aff.updatePayoutDetails({ payoutMethod: "BANK_TRANSFER", bankAccount: "123", bankIfsc: "" })).toMatchObject({ ok: false });
    expect(await aff.updatePayoutDetails({ payoutMethod: "UPI", upiId: "alice@okbank" })).toEqual({ ok: true });
  });

  it("payouts: one open request at a time (even concurrently); paid only after approval with a reference", async () => {
    // Mature everything Alice has that's delivered + due.
    const a = await prisma.affiliate.findUniqueOrThrow({ where: { id: ids.aliceAff } });
    referBy(a.code);
    const o = await order([{ variantId: ids.v1, quantity: 1 }]);
    await deliveredAgo(o.id, 1);
    await engine.matureCommissions();
    const avail = (await engine.affiliateBalances(a.id)).available;
    expect(avail).toBeGreaterThanOrEqual(3000);

    as(ids.alice);
    const results = await Promise.all([aff.requestPayout(), aff.requestPayout(), aff.requestPayout()]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const payouts = await prisma.payout.findMany({ where: { affiliateId: a.id } });
    expect(payouts).toHaveLength(1);
    const p = payouts[0];
    const attached = await prisma.commission.aggregate({ where: { payoutId: p.id }, _sum: { amount: true } });
    expect(p.amount).toBe(attached._sum.amount);
    expect(p.amount).toBe(avail);

    // Can't skip approval, can't pay without a transfer reference.
    expect(await admin.markPayoutPaid({ payoutId: p.id, method: "UPI", reference: "UTR123" })).toMatchObject({ ok: false });
    expect(await admin.approvePayout({ payoutId: p.id })).toEqual({ ok: true });
    expect(await admin.markPayoutPaid({ payoutId: p.id, method: "UPI", reference: "" })).toMatchObject({ ok: false });
    expect(await admin.markPayoutPaid({ payoutId: p.id, method: "UPI", reference: "UTR123" })).toEqual({ ok: true });
    expect(await admin.markPayoutPaid({ payoutId: p.id, method: "UPI", reference: "UTR123" })).toMatchObject({ ok: false });
    const paid = await prisma.commission.findMany({ where: { payoutId: p.id } });
    expect(paid.every((c) => c.status === "PAID")).toBe(true);
    expect((await engine.affiliateBalances(a.id)).available).toBe(0);
  });

  it("a rejected payout can never be marked paid (no double payment); its commissions return to the pool", async () => {
    const a = await prisma.affiliate.findUniqueOrThrow({ where: { id: ids.aliceAff } });
    referBy(a.code);
    const o = await order([{ variantId: ids.v1, quantity: 1 }]);
    await deliveredAgo(o.id, 1);
    await engine.matureCommissions();
    as(ids.alice);
    expect(await aff.requestPayout()).toEqual({ ok: true });
    const p = await prisma.payout.findFirstOrThrow({ where: { affiliateId: a.id, status: "REQUESTED" } });
    expect(await admin.rejectPayout({ payoutId: p.id, reason: "check details" })).toEqual({ ok: true });
    expect(await admin.markPayoutPaid({ payoutId: p.id, method: "UPI", reference: "UTR9" })).toMatchObject({ ok: false });
    expect((await engine.affiliateBalances(a.id)).available).toBe(5000);
  });

  it("voiding a commission inside an open payout releases it and keeps the payout total honest", async () => {
    const a = await prisma.affiliate.findUniqueOrThrow({ where: { id: ids.aliceAff } });
    referBy(a.code);
    const o = await order([{ variantId: ids.v2, quantity: 1 }]);
    await deliveredAgo(o.id, 1);
    await engine.matureCommissions();
    as(ids.alice);
    expect(await aff.requestPayout()).toEqual({ ok: true });
    const p = await prisma.payout.findFirstOrThrow({ where: { affiliateId: a.id, status: "REQUESTED" } });
    expect(p.amount).toBe(8000); // ₹50 released earlier + ₹30 now
    const c = (await commissionOf(o.id))!;
    expect(await admin.cancelCommission({ commissionId: c.id, reason: "fraud check" })).toEqual({ ok: true });
    expect((await prisma.payout.findUniqueOrThrow({ where: { id: p.id } })).amount).toBe(5000);
    await admin.rejectPayout({ payoutId: p.id });
  });

  it("two affiliates' data stay isolated", async () => {
    const [da, db] = await Promise.all([
      ctx!.queries.getAffiliateDashboard({ id: ids.aliceAff, couponId: null }),
      ctx!.queries.getAffiliateDashboard({ id: ids.bobAff, couponId: null }),
    ]);
    const aliceOrders = await prisma.order.findMany({ where: { affiliateId: ids.aliceAff }, select: { orderNumber: true } });
    const aliceSet = new Set(aliceOrders.map((x) => x.orderNumber));
    expect(db.recentOrders.some((r) => aliceSet.has(r.orderNumber))).toBe(false);
    expect(da.recentOrders.every((r) => aliceSet.has(r.orderNumber))).toBe(true);
    expect(db.payouts).toHaveLength(0);
  });

  it("refund after payout: nothing is deducted, no negative balance — flagged for manual review", async () => {
    const paid = await prisma.commission.findFirstOrThrow({
      where: { affiliateId: ids.aliceAff, status: "PAID" },
      include: { order: { include: { items: true } } },
    });
    const before = await engine.affiliateBalances(ids.aliceAff);
    as(ids.buyer);
    expect(
      await ctx!.returnsAction.requestReturn({
        orderNumber: paid.order.orderNumber,
        reason: "Damaged",
        media: [],
        items: [{ orderItemId: paid.order.items[0].id, quantity: 1 }],
      }),
    ).toMatchObject({ ok: true });
    const ret = await prisma.returnRequest.findFirstOrThrow({ where: { orderId: paid.orderId } });
    await ctx!.returns.processRefund(ret.id, { amount: ret.refundAmount, method: "UPI", reference: "t" });

    expect(await commissionOf(paid.orderId)).toMatchObject({ status: "PAID", amount: paid.amount });
    const after = await engine.affiliateBalances(ids.aliceAff);
    expect(after).toEqual(before);
    expect(Object.values(after).every((v) => v >= 0)).toBe(true);

    const review = await ctx!.queries.getAdminCommissions({ status: "REVIEW" });
    expect(review.commissions.map((c) => c.id)).toEqual([paid.id]);
    expect(review.commissions[0].refundedAfterPayout).toBe(true);
    expect(review.summary.review).toEqual({ count: 1, amount: paid.amount });
  });

  it("suspension keeps earned commission (it still matures) but blocks new earnings and payout requests", async () => {
    const b = await prisma.affiliate.findUniqueOrThrow({ where: { id: ids.bobAff } });
    referBy(b.code);
    const earned = await order([{ variantId: ids.v1, quantity: 1 }]);
    const maturing = await order([{ variantId: ids.v2, quantity: 1 }]);
    await deliveredAgo(earned.id, 1);
    await engine.matureCommissions();
    as(ids.bob);
    await aff.updatePayoutDetails({ payoutMethod: "UPI", upiId: "bob@okbank" });

    expect(await admin.suspendAffiliate({ affiliateId: b.id, reason: "Review" })).toEqual({ ok: true });
    expect((await commissionOf(earned.id))!.status).toBe("APPROVED");
    await deliveredAgo(maturing.id, 1);
    await engine.matureCommissions();
    expect((await commissionOf(maturing.id))!.status).toBe("APPROVED"); // still matures while suspended
    expect((await engine.affiliateBalances(b.id)).available).toBe(8000);

    as(ids.bob);
    expect(await aff.requestPayout()).toMatchObject({ ok: false, error: expect.stringMatching(/isn't active/) });
    referBy(b.code);
    const after = await order([{ variantId: ids.v2, quantity: 1 }]);
    expect(after.affiliateId).toBeNull();
    expect(after.commission).toBeNull();

    await admin.reactivateAffiliate({ affiliateId: b.id });
    as(ids.bob);
    expect(await aff.requestPayout()).toEqual({ ok: true }); // withdrawable again after reactivation
  });

  it("suspension puts a pending payout on hold; reactivation never auto-approves, duplicates or double-pays it", async () => {
    const carol = await prisma.affiliate.findUniqueOrThrow({ where: { userId: ids.carol } });
    as(ids.carol);
    await aff.updatePayoutDetails({ payoutMethod: "UPI", upiId: "carol@okbank" });
    referBy(carol.code);
    const o = await order([{ variantId: ids.v1, quantity: 1 }]);
    await deliveredAgo(o.id, 1);
    await engine.matureCommissions();
    as(ids.carol);
    expect(await aff.requestPayout()).toEqual({ ok: true });
    const p = await prisma.payout.findFirstOrThrow({ where: { affiliateId: carol.id } });

    expect(await admin.suspendAffiliate({ affiliateId: carol.id, reason: "Policy review" })).toEqual({ ok: true });
    expect(await admin.approvePayout({ payoutId: p.id })).toMatchObject({ ok: false, error: expect.stringMatching(/on hold/) });
    expect(await admin.approvePayout({ payoutId: p.id, overrideReason: "no" })).toMatchObject({ ok: false }); // reason too short
    expect((await prisma.payout.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("REQUESTED");

    expect(await admin.reactivateAffiliate({ affiliateId: carol.id })).toEqual({ ok: true });
    const held = await prisma.payout.findUniqueOrThrow({ where: { id: p.id } });
    expect(held.status).toBe("REQUESTED"); // hold lifted, but not auto-approved
    expect(held.notes).toMatch(/affiliate carolblogs\] Requested/);
    expect(held.notes).toMatch(/ops@local\.test\] Affiliate suspended \(Policy review\)\. Payout on hold/);
    expect(held.notes).toMatch(/ops@local\.test\] Affiliate reactivated\. Hold lifted/);

    as(ids.carol);
    expect(await aff.requestPayout()).toMatchObject({ ok: false, error: expect.stringMatching(/in progress/) });
    expect(await admin.approvePayout({ payoutId: p.id })).toEqual({ ok: true });
    const pay = () => admin.markPayoutPaid({ payoutId: p.id, method: "UPI", reference: "UTR777" });
    const results = await Promise.all([pay(), pay()]); // double-click
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await admin.rejectPayout({ payoutId: p.id })).toMatchObject({ ok: false });

    expect(await prisma.payout.count({ where: { affiliateId: carol.id } })).toBe(1);
    const bal = await engine.affiliateBalances(carol.id);
    expect(bal).toMatchObject({ paid: p.amount, available: 0, approved: 0 });
    const done = await prisma.payout.findUniqueOrThrow({ where: { id: p.id } });
    expect(done.notes?.match(/Marked paid/g)).toHaveLength(1);
  });

  it("paying a suspended affiliate needs an explicit, recorded override at every step", async () => {
    const carol = await prisma.affiliate.findUniqueOrThrow({ where: { userId: ids.carol } });
    referBy(carol.code);
    const o = await order([{ variantId: ids.v1, quantity: 1 }]);
    await deliveredAgo(o.id, 1);
    await engine.matureCommissions();
    as(ids.carol);
    expect(await aff.requestPayout()).toEqual({ ok: true });
    const p = await prisma.payout.findFirstOrThrow({ where: { affiliateId: carol.id, status: "REQUESTED" } });
    await admin.suspendAffiliate({ affiliateId: carol.id, reason: "Audit" });

    expect(await admin.approvePayout({ payoutId: p.id, overrideReason: "Earned before suspension" })).toEqual({ ok: true });
    expect(await admin.markPayoutPaid({ payoutId: p.id, method: "UPI", reference: "UTR888" })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/on hold/),
    });
    expect(
      await admin.markPayoutPaid({ payoutId: p.id, method: "UPI", reference: "UTR888", overrideReason: "Earned before suspension" }),
    ).toEqual({ ok: true });
    const notes = (await prisma.payout.findUniqueOrThrow({ where: { id: p.id } })).notes ?? "";
    expect(notes).toMatch(/ops@local\.test\] Approved while affiliate suspended \(override: Earned before suspension\)/);
    expect(notes).toMatch(/Marked paid ₹50(.00)? via UPI, ref UTR888 while affiliate suspended/);
    // Suspended affiliates still can't request payouts themselves.
    as(ids.carol);
    expect(await aff.requestPayout()).toMatchObject({ ok: false, error: expect.stringMatching(/isn't active/) });
  });

  it("/ref/[code] never redirects off-site", async () => {
    const { NextRequest } = await import("next/server");
    getCurrentUser.mockResolvedValue(null);
    for (const to of ["//evil.example", "/\\evil.example", "https://evil.example"]) {
      const res = await ctx!.refRoute.GET(new NextRequest(`http://localhost/ref/abc?to=${encodeURIComponent(to)}`), {
        params: Promise.resolve({ code: "abc" }),
      });
      expect(new URL(res.headers.get("location")!).host).toBe("localhost");
    }
  });
});
