import { hasLocalDb } from "@/lib/test/local-db-env"; // must stay first: pins DB + blanks live keys
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Return refunds on a real (local, disposable) Postgres: concurrent refunds of
 * the SAME return must reach the gateway exactly once and restock exactly once,
 * and tampered customer media URLs never get stored.
 *
 *   SPIN_TEST_DATABASE_URL=... npx vitest run lib/returns.int.test.ts
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
// Gateway spy: slow enough that every concurrent caller is in flight at once.
const refundPayment = vi.fn(async () => {
  await new Promise((r) => setTimeout(r, 150));
  return { id: `rfnd_int_${Date.now()}`, status: "processed" };
});
vi.mock("@/lib/razorpay", async (orig) => ({ ...(await orig<typeof import("@/lib/razorpay")>()), refundPayment }));

const ctx = hasLocalDb
  ? {
      prisma: (await import("@/lib/prisma")).prisma,
      checkout: await import("@/lib/actions/checkout"),
      returnsAction: await import("@/lib/actions/returns"),
      returns: await import("@/lib/returns"),
    }
  : null;

describe.skipIf(!ctx)("return refunds (integration)", () => {
  if (!ctx) return;
  const { prisma } = ctx;
  const ids = { v: "", user: "", address: "" };

  async function cleanup() {
    const users = await prisma.user.findMany({ where: { email: { endsWith: "@refund.test" } }, select: { id: true } });
    const orders = await prisma.order.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    await prisma.returnRequest.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: "@refund.test" } } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: "rfd-test-" } } });
    await prisma.category.deleteMany({ where: { slug: "rfd-test-cat" } });
  }

  beforeAll(async () => {
    await cleanup();
    const cat = await prisma.category.create({ data: { name: "rfd", slug: "rfd-test-cat" } });
    const p = await prisma.product.create({
      data: {
        name: "rfd",
        slug: "rfd-test-makhana",
        description: "t",
        categoryId: cat.id,
        variants: { create: [{ weightLabel: "250g", price: 25000, stock: 50 }] },
      },
      include: { variants: true },
    });
    const u = await prisma.user.create({ data: { email: "buyer@refund.test", emailVerified: new Date() } });
    const a = await prisma.address.create({
      data: { userId: u.id, fullName: "Buyer", phone: "9800000000", line1: "1 Road", city: "Pune", state: "MH", pincode: "411001" },
    });
    Object.assign(ids, { v: p.variants[0].id, user: u.id, address: a.id });
    getCurrentUser.mockResolvedValue({ id: u.id, email: u.email, name: "Buyer" });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("five concurrent refunds of one return pay out once and restock once", async () => {
    const res = await ctx.checkout.createOrder({
      items: [{ variantId: ids.v, quantity: 2 }],
      addressId: ids.address,
      paymentMethod: "RAZORPAY",
    });
    expect(res).toMatchObject({ ok: true, mock: true });
    const orderNumber = (res as { orderNumber: string }).orderNumber;
    const order = await prisma.order.update({
      where: { orderNumber },
      data: { status: "DELIVERED", razorpayPaymentId: "pay_int_test" },
      include: { items: true },
    });
    await prisma.orderEvent.create({ data: { orderId: order.id, status: "DELIVERED", actor: "admin" } });
    const stockAfterOrder = (await prisma.productVariant.findUniqueOrThrow({ where: { id: ids.v } })).stock;

    const asked = await ctx.returnsAction.requestReturn({
      orderNumber,
      reason: "Damaged",
      media: ["javascript:alert(1)", "https://evil.example/pixel.png"],
      items: [{ orderItemId: order.items[0].id, quantity: 1 }],
    });
    expect(asked).toMatchObject({ ok: true });
    const ret = await prisma.returnRequest.findFirstOrThrow({ where: { orderId: order.id } });
    expect(ret.media).toEqual([]); // untrusted URLs dropped

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        ctx.returns.processRefund(ret.id, { amount: ret.refundAmount, method: "ORIGINAL" }),
      ),
    );

    expect(refundPayment).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    for (const r of results) {
      if (r.status === "rejected") expect(String(r.reason)).toMatch(/REFUND_IN_PROGRESS/);
    }
    const after = await prisma.returnRequest.findUniqueOrThrow({ where: { id: ret.id } });
    expect(after.refundStatus).toBe("COMPLETED");
    expect(after.refundRef).toMatch(/^rfnd_int_/);
    const stock = (await prisma.productVariant.findUniqueOrThrow({ where: { id: ids.v } })).stock;
    expect(stock).toBe(stockAfterOrder + 1);

    // A later retry is an idempotent no-op.
    await ctx.returns.processRefund(ret.id, { amount: ret.refundAmount, method: "ORIGINAL" });
    expect(refundPayment).toHaveBeenCalledTimes(1);
  });

  async function deliveredOrder(quantity: number) {
    const res = await ctx!.checkout.createOrder({
      items: [{ variantId: ids.v, quantity }],
      addressId: ids.address,
      paymentMethod: "RAZORPAY",
    });
    const orderNumber = (res as { orderNumber: string }).orderNumber;
    const order = await prisma.order.update({
      where: { orderNumber },
      data: { status: "DELIVERED", razorpayPaymentId: "pay_int_test" },
      include: { items: true },
    });
    await prisma.orderEvent.create({ data: { orderId: order.id, status: "DELIVERED", actor: "admin" } });
    return order;
  }

  async function returnedQty(orderId: string) {
    const agg = await prisma.returnRequestItem.aggregate({
      where: { returnRequest: { orderId } },
      _sum: { quantity: true },
    });
    const value = await prisma.returnRequest.aggregate({ where: { orderId }, _sum: { refundAmount: true } });
    return { qty: agg._sum.quantity ?? 0, refund: value._sum.refundAmount ?? 0 };
  }

  it("a repeated line can't return more than was ordered", async () => {
    const order = await deliveredOrder(1);
    const line = order.items[0];
    const res = await ctx.returnsAction.requestReturn({
      orderNumber: order.orderNumber,
      reason: "Damaged",
      items: [
        { orderItemId: line.id, quantity: 1 },
        { orderItemId: line.id, quantity: 1 },
      ],
    });
    expect(res).toMatchObject({ ok: false });
    expect(await returnedQty(order.id)).toEqual({ qty: 0, refund: 0 });
  });

  it("concurrent return requests never exceed the ordered quantity", async () => {
    const order = await deliveredOrder(2);
    const line = order.items[0];
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        ctx.returnsAction.requestReturn({
          orderNumber: order.orderNumber,
          reason: "Damaged",
          items: [{ orderItemId: line.id, quantity: 2 }],
        }),
      ),
    );
    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(await returnedQty(order.id)).toEqual({ qty: 2, refund: line.price * 2 });
  });
});
