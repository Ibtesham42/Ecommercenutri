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
    update: vi.fn(),
  },
  orderItem: {
    findMany: vi.fn(),
  },
  productVariant: {
    updateMany: vi.fn(),
    update: vi.fn(),
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
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  returnRequest: {
    aggregate: vi.fn(),
  },
  productVariant: {
    findMany: vi.fn(),
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
const refundPaymentMock = vi.fn();
vi.mock("@/lib/razorpay", () => ({ refundPayment: refundPaymentMock }));
vi.mock("@/lib/affiliate/commissions", () => ({
  createOrderCommission: vi.fn(),
  setCommissionMature: vi.fn(),
  voidCommission: vi.fn(),
}));

const { confirmOrder, markOrderPaid, OrderFulfillmentError, transitionOrderStatus, priceCart } =
  await import("@/lib/orders");

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
  prismaMock.order.findFirst.mockResolvedValue(null); // no fulfillment failure recorded yet
  prismaMock.order.updateMany.mockResolvedValue({ count: 1 }); // refund claim succeeds by default
  prismaMock.returnRequest.aggregate.mockResolvedValue({ _sum: { refundedAmount: null } });
  refundPaymentMock.mockResolvedValue({ id: "rfnd_test_1", status: "processed" });
  txMock.order.update.mockResolvedValue({ id: BASE_ORDER_ID });
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

// ---------------------------------------------------------------------------
// Checkout audit 2026-10-07: closing a prepaid order must actually refund it.

const PAID_ORDER = {
  id: BASE_ORDER_ID,
  orderNumber: "NUT-261007-TEST01",
  status: "PENDING",
  paymentStatus: "PAID",
  paymentMethod: "RAZORPAY",
  razorpayPaymentId: "pay_test_1",
  total: 49900,
  stockDeducted: true,
  items: [{ variantId: "variant_1", quantity: 2 }],
};

describe("transitionOrderStatus — refund on close of a prepaid order", () => {
  it("cancelling a PAID Razorpay order issues a full refund and marks REFUNDED", async () => {
    prismaMock.order.findUnique.mockResolvedValue(PAID_ORDER);
    await transitionOrderStatus(BASE_ORDER_ID, "CANCELLED", { actor: "customer" });
    expect(refundPaymentMock).toHaveBeenCalledWith("pay_test_1", 49900);
    expect(txMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentStatus: "REFUNDED" }) }),
    );
    expect(txMock.orderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ note: expect.stringContaining("rfnd_test_1") }),
    });
  });

  it("refunds only what returns haven't already refunded", async () => {
    prismaMock.order.findUnique.mockResolvedValue(PAID_ORDER);
    prismaMock.returnRequest.aggregate.mockResolvedValue({ _sum: { refundedAmount: 9900 } });
    await transitionOrderStatus(BASE_ORDER_ID, "CANCELLED", { actor: "admin" });
    expect(refundPaymentMock).toHaveBeenCalledWith("pay_test_1", 40000);
  });

  it("losing the claim to a concurrent close never refunds twice and leaves paymentStatus alone", async () => {
    prismaMock.order.findUnique.mockResolvedValue(PAID_ORDER);
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 });
    await transitionOrderStatus(BASE_ORDER_ID, "CANCELLED", { actor: "customer" });
    expect(refundPaymentMock).not.toHaveBeenCalled();
    const data = txMock.order.update.mock.calls[0][0].data;
    expect(data.paymentStatus).toBeUndefined();
  });

  it("a Razorpay refund error reverts to PAID (never claims a refund that didn't happen) and still cancels", async () => {
    prismaMock.order.findUnique.mockResolvedValue(PAID_ORDER);
    refundPaymentMock.mockRejectedValue(new Error("gateway down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await transitionOrderStatus(BASE_ORDER_ID, "CANCELLED", { actor: "customer" });
    errSpy.mockRestore();
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: BASE_ORDER_ID },
      data: { paymentStatus: "PAID" },
    });
    expect(txMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED", paymentStatus: "PAID" }),
      }),
    );
  });

  it("COD orders never touch the payment gateway", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      ...PAID_ORDER,
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      razorpayPaymentId: null,
    });
    await transitionOrderStatus(BASE_ORDER_ID, "CANCELLED", { actor: "customer" });
    expect(refundPaymentMock).not.toHaveBeenCalled();
    expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
  });
});

describe("recordFulfillmentFailure — webhook retries don't duplicate the review note", () => {
  it("a repeat failure for an already-recorded payment writes nothing", async () => {
    txMock.productVariant.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.order.findFirst.mockResolvedValue({ id: BASE_ORDER_ID }); // payment already recorded
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(markOrderPaid(BASE_ORDER_ID, { paymentId: "pay_test_1" })).rejects.toThrow(
      OrderFulfillmentError,
    );
    errSpy.mockRestore();
    expect(prismaMock.order.update).not.toHaveBeenCalled();
    expect(prismaMock.orderEvent.create).not.toHaveBeenCalled();
  });
});

describe("priceCart — repeated variants are merged before the stock check", () => {
  it("two lines of 3 against stock 5 are rejected up front, not after payment", async () => {
    prismaMock.productVariant.findMany.mockResolvedValue([
      {
        id: "variant_1",
        isActive: true,
        stock: 5,
        price: 10000,
        discountPrice: null,
        weightLabel: "250g",
        product: { id: "product_1", name: "Makhana", isActive: true, gstRate: null, deliveryCharge: null, images: [] },
      },
    ]);
    const res = await priceCart([
      { variantId: "variant_1", quantity: 3 },
      { variantId: "variant_1", quantity: 3 },
    ]);
    expect(res).toEqual({ ok: false, error: "Only 5 left of Makhana (250g)." });
  });
});
