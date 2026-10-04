import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Batch 1 (production-safety audit) — isolated unit tests for confirmOrder's
 * stock-decrement and coupon-usedCount race fixes.
 *
 * These mock Prisma entirely (no real database connection, no writes of any
 * kind) and simulate each race DETERMINISTICALLY by controlling what the
 * guarded `updateMany` calls return — the same technique used to prove the
 * pre-existing `stockDeducted` double-confirmation guard works. This proves
 * the application-level logic (the new throw/rollback/flag-for-review
 * behavior) is correct; it does not exercise Postgres's actual row-locking
 * under real concurrent load, which is a staging/load-test concern (see the
 * execution plan's Batch 1 test requirements) and is intentionally not run
 * here since this project's configured database is real production data.
 */

const txMock = {
  order: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  orderItem: {
    findMany: vi.fn(),
  },
  productVariant: {
    updateMany: vi.fn(),
  },
  coupon: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  orderEvent: {
    create: vi.fn(),
  },
};

const prismaMock = {
  $transaction: vi.fn(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)),
  order: {
    update: vi.fn(),
  },
  orderEvent: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/emails", () => ({ orderConfirmationEmail: vi.fn(() => ({ subject: "", html: "" })) }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/invoices", () => ({
  ensureInvoice: vi.fn(async () => ({ invoiceNumber: "INV-TEST" })),
  getInvoiceData: vi.fn(async () => null),
}));
vi.mock("@/lib/recommendations/events", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/affiliate/commissions", () => ({
  createOrderCommission: vi.fn(),
  setCommissionMature: vi.fn(),
  voidCommission: vi.fn(),
}));

const { confirmOrder, markOrderPaid, OrderFulfillmentError } = await import("@/lib/orders");

const BASE_ORDER_ID = "order_1";

function resetMocks() {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
  txMock.order.findUnique.mockResolvedValue({ id: BASE_ORDER_ID, couponId: null });
  txMock.order.updateMany.mockResolvedValue({ count: 1 }); // claim succeeds by default
  txMock.orderItem.findMany.mockResolvedValue([
    { variantId: "variant_1", quantity: 2, productId: "product_1" },
  ]);
  txMock.productVariant.updateMany.mockResolvedValue({ count: 1 }); // stock decrement succeeds by default
  txMock.order.findUniqueOrThrow.mockResolvedValue({
    id: BASE_ORDER_ID,
    userId: "user_1",
    items: [{ productId: "product_1" }],
    user: { email: null, name: null },
  });
}

beforeEach(resetMocks);

describe("confirmOrder — existing idempotency guard (no regression)", () => {
  it("scenario 7: a second confirm attempt on an already-confirmed order is a safe no-op", async () => {
    txMock.order.updateMany.mockResolvedValue({ count: 0 }); // lost the claim race
    await expect(confirmOrder(BASE_ORDER_ID, { paymentStatus: "PAID" })).resolves.toBeUndefined();
    expect(txMock.productVariant.updateMany).not.toHaveBeenCalled();
    expect(txMock.coupon.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.order.update).not.toHaveBeenCalled(); // no fulfillment-failure handling triggered
  });
});

describe("confirmOrder — stock-decrement race (fix #3)", () => {
  it("scenario 3: concurrent order takes the final unit — aborts cleanly, no coupon touched", async () => {
    txMock.productVariant.updateMany.mockResolvedValue({ count: 0 }); // guard rejected it
    await expect(confirmOrder(BASE_ORDER_ID, { paymentStatus: "PENDING" })).rejects.toThrow(
      OrderFulfillmentError,
    );
    expect(txMock.coupon.findUnique).not.toHaveBeenCalled(); // never reached — tx aborted first
    expect(txMock.order.findUniqueOrThrow).not.toHaveBeenCalled(); // order was never "completed"
  });

  it("COD/no-payment-captured: insufficient stock cancels the order outright (safe — nothing was charged)", async () => {
    txMock.productVariant.updateMany.mockResolvedValue({ count: 0 });
    await expect(confirmOrder(BASE_ORDER_ID, { paymentStatus: "PENDING" })).rejects.toThrow(
      OrderFulfillmentError,
    );
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: BASE_ORDER_ID },
      data: expect.objectContaining({ status: "CANCELLED", paymentStatus: "FAILED" }),
    });
  });

  it("Razorpay payment already captured: never cancels/refunds — preserves payment ref, flags for review", async () => {
    txMock.productVariant.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      markOrderPaid(BASE_ORDER_ID, { paymentId: "pay_123", signature: "sig" }),
    ).rejects.toThrow(OrderFulfillmentError);

    // Must NOT cancel the order or touch paymentStatus — money was already taken.
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: BASE_ORDER_ID },
      data: { razorpayPaymentId: "pay_123", razorpaySignature: "sig" },
    });
    const updateCallArgs = prismaMock.order.update.mock.calls[0][0];
    expect(updateCallArgs.data.status).toBeUndefined();
    expect(updateCallArgs.data.paymentStatus).toBeUndefined();
  });
});

describe("confirmOrder — coupon usedCount race (fix #2)", () => {
  beforeEach(() => {
    txMock.order.findUnique.mockResolvedValue({ id: BASE_ORDER_ID, couponId: "coupon_1" });
  });

  it("scenario 1: concurrent order claims the final coupon slot first — this one aborts, stock already decremented is rolled back", async () => {
    txMock.coupon.findUnique.mockResolvedValue({ usageLimit: 10 });
    txMock.coupon.updateMany.mockResolvedValue({ count: 0 }); // guard rejected — limit already hit
    await expect(confirmOrder(BASE_ORDER_ID, { paymentStatus: "PENDING" })).rejects.toThrow(
      OrderFulfillmentError,
    );
    // Stock WAS decremented before the coupon check ran, in this transaction attempt —
    // but since the whole $transaction callback throws, Prisma rolls every write in
    // it back atomically, so nothing from this attempt is persisted.
    expect(txMock.productVariant.updateMany).toHaveBeenCalledTimes(1);
    expect(txMock.order.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("unlimited coupon (usageLimit null) still increments unconditionally — unchanged behavior", async () => {
    txMock.coupon.findUnique.mockResolvedValue({ usageLimit: null });
    await confirmOrder(BASE_ORDER_ID, { paymentStatus: "PENDING" });
    expect(txMock.coupon.updateMany).not.toHaveBeenCalled();
    expect(txMock.coupon.update).toHaveBeenCalledWith({
      where: { id: "coupon_1" },
      data: { usedCount: { increment: 1 } },
    });
  });

  it("limited coupon with a free slot increments via the guarded update", async () => {
    txMock.coupon.findUnique.mockResolvedValue({ usageLimit: 10 });
    txMock.coupon.updateMany.mockResolvedValue({ count: 1 });
    await confirmOrder(BASE_ORDER_ID, { paymentStatus: "PENDING" });
    expect(txMock.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: "coupon_1", usedCount: { lt: 10 } },
      data: { usedCount: { increment: 1 } },
    });
  });
});

describe("confirmOrder — normal successful flows (no regression)", () => {
  it("scenario 5: a normal COD checkout confirms cleanly", async () => {
    await expect(confirmOrder(BASE_ORDER_ID, { paymentStatus: "PENDING" })).resolves.toBeUndefined();
    expect(txMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: BASE_ORDER_ID, stockDeducted: false },
      data: {
        stockDeducted: true,
        paymentStatus: "PENDING",
        razorpayPaymentId: undefined,
        razorpaySignature: undefined,
      },
    });
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it("scenario 6: a normal Razorpay checkout confirms cleanly with the payment reference stored", async () => {
    await expect(
      markOrderPaid(BASE_ORDER_ID, { paymentId: "pay_999", signature: "sig_999" }),
    ).resolves.toBeUndefined();
    expect(txMock.order.updateMany).toHaveBeenCalledWith({
      where: { id: BASE_ORDER_ID, stockDeducted: false },
      data: {
        stockDeducted: true,
        paymentStatus: "PAID",
        razorpayPaymentId: "pay_999",
        razorpaySignature: "sig_999",
      },
    });
    expect(prismaMock.order.update).not.toHaveBeenCalled(); // no failure handling triggered
  });
});
