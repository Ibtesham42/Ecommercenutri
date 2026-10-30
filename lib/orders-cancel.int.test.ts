import { hasLocalDb } from "@/lib/test/local-db-env"; // must stay first: pins DB + blanks live keys
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Customer cancellation vs. online payment on a real (local, disposable)
 * Postgres. An unpaid Razorpay order stays payable at Razorpay after the
 * customer cancels it; a late capture must never silently turn into a
 * "cancelled but charged, stock deducted" order, and a cancel racing the
 * payment confirmation must never overwrite PAID with a stale status.
 *
 *   SPIN_TEST_DATABASE_URL=... npx vitest run lib/orders-cancel.int.test.ts
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
const refundPayment = vi.fn(async () => ({ id: `rfnd_cancel_${Date.now()}`, status: "processed" }));
vi.mock("@/lib/razorpay", async (orig) => ({ ...(await orig<typeof import("@/lib/razorpay")>()), refundPayment }));

const ctx = hasLocalDb
  ? {
      prisma: (await import("@/lib/prisma")).prisma,
      orders: await import("@/lib/orders"),
      account: await import("@/lib/actions/account"),
    }
  : null;

describe.skipIf(!ctx)("cancel vs payment (integration)", () => {
  if (!ctx) return;
  const { prisma, orders, account } = ctx;
  const ids = { v: "", user: "" };
  let seq = 0;

  async function cleanup() {
    const users = await prisma.user.findMany({ where: { email: { endsWith: "@cancel.test" } }, select: { id: true } });
    await prisma.order.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: "@cancel.test" } } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: "cnl-test-" } } });
    await prisma.category.deleteMany({ where: { slug: "cnl-test-cat" } });
  }

  beforeAll(async () => {
    await cleanup();
    const cat = await prisma.category.create({ data: { name: "cnl", slug: "cnl-test-cat" } });
    const p = await prisma.product.create({
      data: {
        name: "cnl",
        slug: "cnl-test-makhana",
        description: "t",
        categoryId: cat.id,
        variants: { create: [{ weightLabel: "250g", price: 25000, stock: 100 }] },
      },
      include: { variants: true },
    });
    const u = await prisma.user.create({ data: { email: "buyer@cancel.test", emailVerified: new Date() } });
    Object.assign(ids, { v: p.variants[0].id, user: u.id });
    getCurrentUser.mockResolvedValue({ id: u.id, email: u.email, name: "Buyer" });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  /** An online order awaiting payment (as createOrder leaves it before checkout). */
  function unpaidOrder() {
    seq += 1;
    return prisma.order.create({
      data: {
        orderNumber: `CNL-${Date.now()}-${seq}`,
        userId: ids.user,
        subtotal: 50000,
        total: 50000,
        shippingAddress: { fullName: "Buyer" },
        paymentMethod: "RAZORPAY",
        razorpayOrderId: `order_cnl_${seq}`,
        items: {
          create: [{ variantId: ids.v, productName: "cnl", variantLabel: "250g", price: 25000, quantity: 2 }],
        },
      },
    });
  }

  const stock = async () => (await prisma.productVariant.findUniqueOrThrow({ where: { id: ids.v } })).stock;

  it("a payment captured after the customer cancelled is flagged, never deducted", async () => {
    const order = await unpaidOrder();
    const before = await stock();
    expect(await account.cancelOrder({ orderNumber: order.orderNumber })).toEqual({ ok: true });

    await expect(orders.markOrderPaid(order.id, { paymentId: "pay_after_cancel" })).rejects.toBeInstanceOf(
      orders.OrderFulfillmentError,
    );

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("CANCELLED");
    expect(after.stockDeducted).toBe(false);
    expect(after.razorpayPaymentId).toBe("pay_after_cancel"); // kept for the manual refund
    expect(await stock()).toBe(before);
    const last = await prisma.orderEvent.findFirstOrThrow({ where: { orderId: order.id }, orderBy: { createdAt: "desc" } });
    expect(last.status).toBe("CANCELLED");
    expect(last.note).toMatch(/refund/);
    // A webhook retry of the same capture is recorded once, still never deducted.
    await expect(orders.markOrderPaid(order.id, { paymentId: "pay_after_cancel" })).rejects.toBeInstanceOf(
      orders.OrderFulfillmentError,
    );
    expect(await prisma.orderEvent.count({ where: { orderId: order.id, note: { contains: "after this order was cancelled" } } })).toBe(1);
    expect(await stock()).toBe(before);
  });

  it("a confirm without a payment never rewrites an already-closed order", async () => {
    const order = await unpaidOrder();
    await account.cancelOrder({ orderNumber: order.orderNumber, reason: "Changed my mind" });
    await expect(orders.markOrderPaid(order.id)).rejects.toBeInstanceOf(orders.OrderFulfillmentError);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o).toMatchObject({ status: "CANCELLED", paymentStatus: "PENDING", cancelReason: "Changed my mind", stockDeducted: false });
  });

  it("cancel racing payment confirmation never leaves a charged order unpaid-and-cancelled", async () => {
    for (let i = 0; i < 20; i++) {
      const order = await unpaidOrder();
      const before = await stock();
      await Promise.allSettled([
        account.cancelOrder({ orderNumber: order.orderNumber }),
        orders.markOrderPaid(order.id, { paymentId: `pay_race_${i}` }),
      ]);
      const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      const delta = before - (await stock());
      if (o.status === "CANCELLED") {
        // Either the payment never landed, or it was refunded/flagged — and stock is back.
        expect(o.stockDeducted).toBe(false);
        expect(delta).toBe(0);
        if (o.razorpayPaymentId) expect(["REFUNDED", "PAID"]).toContain(o.paymentStatus);
      } else {
        expect(o.paymentStatus).toBe("PAID");
        expect(o.stockDeducted).toBe(true);
        expect(delta).toBe(2);
      }
    }
  });
});
