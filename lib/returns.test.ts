import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * processRefund double-refund guard. Prisma is fully mocked (no DB connection):
 * the race is simulated deterministically by controlling what the atomic
 * `refundStatus` claim (`updateMany`) returns, the same technique as
 * lib/orders.test.ts uses for `stockDeducted`.
 */

const txMock = {
  returnRequest: { update: vi.fn() },
  returnEvent: { create: vi.fn() },
  orderItem: { findUnique: vi.fn() },
  productVariant: { update: vi.fn() },
  order: { update: vi.fn() },
  orderEvent: { create: vi.fn() },
};

const prismaMock = {
  $transaction: vi.fn(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)),
  returnRequest: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  order: { findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/queries/settings", () => ({ getReturnSettings: vi.fn() }));
const refundPaymentMock = vi.fn();
vi.mock("@/lib/razorpay", () => ({ refundPayment: refundPaymentMock }));
vi.mock("@/lib/credit-notes", () => ({ ensureCreditNote: vi.fn() }));
vi.mock("@/lib/affiliate/commissions", () => ({ syncCommissionWithRefunds: vi.fn() }));

const { processRefund } = await import("@/lib/returns");

const RET = {
  id: "ret_1",
  returnNumber: "RMA-1",
  refundStatus: "PENDING",
  items: [{ orderItemId: "oi_1", quantity: 1 }],
  order: {
    id: "order_1",
    orderNumber: "NUT-1",
    paymentMethod: "RAZORPAY",
    paymentStatus: "PAID",
    razorpayPaymentId: "pay_1",
    stockDeducted: true,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
  prismaMock.returnRequest.findUnique.mockResolvedValue(RET);
  prismaMock.returnRequest.findUniqueOrThrow.mockResolvedValue({ id: "ret_1" });
  prismaMock.returnRequest.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.order.findUnique.mockResolvedValue({ items: [{ id: "oi_1", quantity: 2 }], returns: [] });
  txMock.orderItem.findUnique.mockResolvedValue({ variantId: "v_1" });
  refundPaymentMock.mockResolvedValue({ id: "rfnd_1", status: "processed" });
});

describe("processRefund — concurrency guard", () => {
  it("refunds once and records the reference when it wins the claim", async () => {
    await processRefund("ret_1", { amount: 5000, method: "ORIGINAL" });
    expect(prismaMock.returnRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "ret_1", refundStatus: { in: ["PENDING", "FAILED"] } },
      data: { refundStatus: "PROCESSING" },
    });
    expect(refundPaymentMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.returnRequest.update).toHaveBeenCalledWith({
      where: { id: "ret_1" },
      data: { refundRef: "rfnd_1" },
    });
    expect(txMock.productVariant.update).toHaveBeenCalledTimes(1);
  });

  it("a concurrent second call that loses the claim never touches Razorpay or stock", async () => {
    prismaMock.returnRequest.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.returnRequest.findUnique
      .mockResolvedValueOnce(RET) // initial read (both callers saw PENDING)
      .mockResolvedValueOnce({ refundStatus: "PROCESSING" }); // winner is mid-refund
    await expect(processRefund("ret_1", { amount: 5000, method: "ORIGINAL" })).rejects.toThrow(
      "REFUND_IN_PROGRESS",
    );
    expect(refundPaymentMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("losing the claim to an already-completed refund is a silent no-op", async () => {
    prismaMock.returnRequest.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.returnRequest.findUnique
      .mockResolvedValueOnce(RET)
      .mockResolvedValueOnce({ refundStatus: "COMPLETED" });
    await expect(processRefund("ret_1", { amount: 5000, method: "ORIGINAL" })).resolves.toBeTruthy();
    expect(refundPaymentMock).not.toHaveBeenCalled();
  });

  it("a failed Razorpay refund releases the claim (FAILED) so it can be retried", async () => {
    refundPaymentMock.mockRejectedValue(new Error("gateway down"));
    await expect(processRefund("ret_1", { amount: 5000, method: "ORIGINAL" })).rejects.toThrow("gateway down");
    expect(prismaMock.returnRequest.update).toHaveBeenCalledWith({
      where: { id: "ret_1" },
      data: { refundStatus: "FAILED" },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("a paid-out refund whose bookkeeping fails stays PROCESSING (never re-issued)", async () => {
    prismaMock.$transaction.mockRejectedValue(new Error("db blip"));
    await expect(processRefund("ret_1", { amount: 5000, method: "ORIGINAL" })).rejects.toThrow("db blip");
    expect(prismaMock.returnRequest.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { refundStatus: "FAILED" } }),
    );
  });

  it("a manual-method refund whose bookkeeping fails is released for retry", async () => {
    prismaMock.$transaction.mockRejectedValue(new Error("db blip"));
    await expect(processRefund("ret_1", { amount: 5000, method: "UPI", reference: "utr1" })).rejects.toThrow();
    expect(refundPaymentMock).not.toHaveBeenCalled();
    expect(prismaMock.returnRequest.update).toHaveBeenCalledWith({
      where: { id: "ret_1" },
      data: { refundStatus: "FAILED" },
    });
  });

  it("an ORIGINAL refund on a COD order is refused before claiming", async () => {
    prismaMock.returnRequest.findUnique.mockResolvedValue({
      ...RET,
      order: { ...RET.order, paymentMethod: "COD", razorpayPaymentId: null },
    });
    await expect(processRefund("ret_1", { amount: 5000, method: "ORIGINAL" })).rejects.toThrow(
      "NO_ORIGINAL_PAYMENT",
    );
    expect(prismaMock.returnRequest.updateMany).not.toHaveBeenCalled();
  });
});
