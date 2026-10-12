import { hasLocalDb } from "@/lib/test/local-db-env"; // must stay first: pins DB + blanks live keys
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 2A end to end on a real (local, disposable) Postgres: the real
 * createOrder server action prices a mixed-GST cart with a Spin & Win offer
 * (keyless mock-payment flow — no gateway is configured, no money moves), then returns are requested and
 * refunded through the real return engine. Ordinary coupons are checked to be
 * unchanged. Sequential tests (see concurrency.int.test.ts for parallel ones).
 *
 *   SPIN_TEST_DATABASE_URL=... npx vitest run lib/spin/orders.int.test.ts
 */

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: () => unknown) => fn }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1" }),
}));
const getCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/pdf/invoice-pdf", () => ({ renderInvoiceBuffer: vi.fn(async () => Buffer.from("")) }));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn() }));

const ctx = hasLocalDb
  ? {
      prisma: (await import("@/lib/prisma")).prisma,
      svc: await import("@/lib/spin/service"),
      checkout: await import("@/lib/actions/checkout"),
      returnsAction: await import("@/lib/actions/returns"),
      returns: await import("@/lib/returns"),
      creditNotes: await import("@/lib/credit-notes"),
      pricing: await import("@/lib/pricing"),
    }
  : null;

describe.skipIf(!ctx)("Spin & Win orders, GST and refunds (integration)", () => {
  if (!ctx) return;
  const { prisma } = ctx;
  const { gstWithin } = ctx.pricing;
  const ids = { spinV: "", spinP: "", otherV: "", otherP: "", user: "", address: "" };

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE "Order", "SpinResult", "SpinCampaign" CASCADE`);
    await prisma.coupon.deleteMany({ where: { OR: [{ code: { startsWith: "SPIN-" } }, { code: "ORDINARY10" }] } });
    await prisma.user.deleteMany({ where: { email: { endsWith: "@orders.test" } } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: "ord-test-" } } });
    await prisma.category.deleteMany({ where: { slug: "ord-test-cat" } });
    const cat = await prisma.category.create({ data: { name: "ord", slug: "ord-test-cat" } });
    const mk = (slug: string, gstRate: number) =>
      prisma.product.create({
        data: {
          name: slug,
          slug: `ord-test-${slug}`,
          description: "t",
          categoryId: cat.id,
          gstRate,
          deliveryCharge: 0,
          variants: { create: [{ weightLabel: "250g", price: 25000, stock: 100 }] },
        },
        include: { variants: true },
      });
    const sp = await mk("makhana", 5); // the spin product, 5% GST
    const op = await mk("whey", 18); // an ordinary product, 18% GST
    const u = await prisma.user.create({ data: { email: "buyer@orders.test", emailVerified: new Date() } });
    const a = await prisma.address.create({
      data: { userId: u.id, fullName: "Buyer", phone: "9800000000", line1: "1 Road", city: "Pune", state: "MH", pincode: "411001" },
    });
    Object.assign(ids, { spinV: sp.variants[0].id, spinP: sp.id, otherV: op.variants[0].id, otherP: op.id, user: u.id, address: a.id });
    getCurrentUser.mockResolvedValue({ id: u.id, email: u.email, name: "Buyer" });
  });

  beforeEach(async () => {
    await prisma.productVariant.updateMany({ where: { id: { in: [ids.spinV, ids.otherV] } }, data: { stock: 100 } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function spinOffer(): Promise<string> {
    await prisma.$executeRawUnsafe(`TRUNCATE "SpinResult", "SpinCampaign" CASCADE`);
    await prisma.spinCampaign.create({
      data: {
        name: "o",
        isActive: true,
        prizes: [{ percent: 20, weight: 1 }],
        eligibleVariantIds: [ids.spinV],
        minStock: 5,
        saleMode: "STACK",
      },
    });
    const s = await ctx!.svc.spinWheel({ userId: ids.user, anonId: null, claimToken: null, allowAnonymousSpin: async () => true });
    const coupon = await prisma.coupon.findUniqueOrThrow({ where: { id: s.spin.couponId! } });
    return coupon.code;
  }

  async function deliver(orderNumber: string) {
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber } });
    await prisma.order.update({ where: { id: o.id }, data: { status: "DELIVERED" } });
    await prisma.orderEvent.create({ data: { orderId: o.id, status: "DELIVERED", actor: "admin" } });
    return prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { items: true } });
  }

  it("spin order: discount sits on the eligible line; GST is extracted per line from what was paid", async () => {
    const code = await spinOffer();
    const res = await ctx!.checkout.createOrder({
      items: [
        { variantId: ids.spinV, quantity: 2 },
        { variantId: ids.otherV, quantity: 1 },
      ],
      addressId: ids.address,
      couponCode: code,
      paymentMethod: "RAZORPAY",
    });
    expect(res).toMatchObject({ ok: true, mock: true }); // keyless mock payment — no gateway configured
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: (res as { orderNumber: string }).orderNumber }, include: { items: true } });
    expect(order.discount).toBe(10000); // 20% of 2 × ₹250, nothing off the whey
    const spinLine = order.items.find((i) => i.variantId === ids.spinV)!;
    const otherLine = order.items.find((i) => i.variantId === ids.otherV)!;
    expect([spinLine.discount, otherLine.discount]).toEqual([10000, 0]);
    expect(order.tax).toBe(gstWithin(40000, 5) + gstWithin(25000, 18));
    expect(order.total).toBe(75000 - 10000);
    expect(order.stockDeducted).toBe(true);

    // The single-use offer can't be used again.
    const again = await ctx!.checkout.createOrder({
      items: [{ variantId: ids.spinV, quantity: 1 }],
      addressId: ids.address,
      couponCode: code,
      paymentMethod: "RAZORPAY",
    });
    expect(again.ok).toBe(false);
  });

  it("spin order returns: partial returns refund exactly what was paid; the credit note shows the offer", async () => {
    const code = await spinOffer();
    const res = await ctx!.checkout.createOrder({
      items: [
        { variantId: ids.spinV, quantity: 3 },
        { variantId: ids.otherV, quantity: 1 },
      ],
      addressId: ids.address,
      couponCode: code,
      paymentMethod: "RAZORPAY",
    });
    const orderNumber = (res as { orderNumber: string }).orderNumber;
    const order = await deliver(orderNumber);
    const spinLine = order.items.find((i) => i.variantId === ids.spinV)!;
    expect(spinLine.discount).toBe(15000); // 20% of 3 × ₹250

    const ask = (quantity: number, orderItemId = spinLine.id) =>
      ctx!.returnsAction.requestReturn({ orderNumber, reason: "Damaged", media: [], items: [{ orderItemId, quantity }] });
    expect(await ask(1)).toMatchObject({ ok: true });
    expect(await ask(2)).toMatchObject({ ok: true });
    const rets = await prisma.returnRequest.findMany({ where: { orderId: order.id }, include: { items: true }, orderBy: { createdAt: "asc" } });
    const refunds = rets.map((r) => r.refundAmount);
    expect(refunds.reduce((a, b) => a + b, 0)).toBe(3 * 25000 - 15000); // paid for the line, never more
    expect(refunds.every((r) => r < 2 * 25000)).toBe(true);
    expect(rets.flatMap((r) => r.items).reduce((a, i) => a + i.discount, 0)).toBe(15000);

    // The ordinary line on the same order refunds its full price (no offer on it).
    const otherLine = order.items.find((i) => i.variantId === ids.otherV)!;
    expect(await ask(1, otherLine.id)).toMatchObject({ ok: true });
    const otherRet = await prisma.returnRequest.findFirstOrThrow({ where: { items: { some: { orderItemId: otherLine.id } } } });
    expect(otherRet.refundAmount).toBe(25000);

    // Refund through the real engine; the credit note reconciles items with the amount.
    const done = await ctx!.returns.processRefund(rets[0].id, { amount: rets[0].refundAmount, method: "UPI", reference: "test" });
    expect(done.refundedAmount).toBe(rets[0].refundAmount);
    const cn = await ctx!.creditNotes.getCreditNoteData(rets[0].id);
    expect(cn!.offerDiscount).toBe(rets[0].items[0].discount);
    expect(cn!.items[0].unitPrice * cn!.items[0].quantity - cn!.offerDiscount).toBe(cn!.amount);
  });

  it("ordinary coupon orders are unchanged: proportional GST, no line discount, full-price refunds", async () => {
    await prisma.coupon.create({ data: { code: "ORDINARY10", type: "PERCENT", value: 10 } });
    const res = await ctx!.checkout.createOrder({
      items: [
        { variantId: ids.spinV, quantity: 2 },
        { variantId: ids.otherV, quantity: 1 },
      ],
      addressId: ids.address,
      couponCode: "ORDINARY10",
      paymentMethod: "RAZORPAY",
    });
    const orderNumber = (res as { orderNumber: string }).orderNumber;
    const order = await deliver(orderNumber);
    expect(order.discount).toBe(7500);
    expect(order.items.every((i) => i.discount === 0)).toBe(true);
    expect(order.tax).toBe(gstWithin(50000 * 0.9, 5) + gstWithin(25000 * 0.9, 18));
    const line = order.items.find((i) => i.variantId === ids.spinV)!;
    await ctx!.returnsAction.requestReturn({ orderNumber, reason: "Damaged", media: [], items: [{ orderItemId: line.id, quantity: 2 }] });
    const ret = await prisma.returnRequest.findFirstOrThrow({ where: { orderId: order.id } });
    expect(ret.refundAmount).toBe(50000); // existing policy: unit price × qty
  });
});
