import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { productCandidates } from "@/lib/spin/selection";
import { isTransientTxError, withTxRetry } from "@/lib/db-retry";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/razorpay", () => ({ razorpay: null }));
const { classifyPayments, orderFingerprint } = await import("@/lib/spin/checkout-guard");

/** Phase 2B pure rules: reserved stock, payment-state classification, retry. Sequential unit tests. */

const v = (variantId: string, productId: string, stock: number) => ({
  variantId,
  productId,
  stock,
  variantActive: true,
  productActive: true,
});
const cfg = { eligibleVariantIds: ["a1", "a2", "b1"], minStock: 5, weightCap: 200 };

describe("reserved stock in selection", () => {
  it("subtracts outstanding claimed offers from a product's surplus", () => {
    const stock = [v("a1", "A", 15), v("a2", "A", 10), v("b1", "B", 20)]; // A: 10+5, B: 15
    const reserved = new Map([["A", 4]]);
    const c = productCandidates(stock, { ...cfg, reserved });
    expect(c.find((x) => x.productId === "A")?.weight).toBe(11);
    expect(c.find((x) => x.productId === "B")?.weight).toBe(15);
  });

  it("drops a product whose surplus is fully promised", () => {
    const c = productCandidates([v("a1", "A", 8), v("b1", "B", 20)], { ...cfg, reserved: new Map([["A", 3]]) });
    expect(c.map((x) => x.productId)).toEqual(["B"]);
  });

  it("without reservations behaves exactly as before", () => {
    const stock = [v("a1", "A", 15), v("b1", "B", 400)];
    expect(productCandidates(stock, cfg)).toEqual(productCandidates(stock, { ...cfg, reserved: new Map() }));
    expect(productCandidates(stock, cfg).find((x) => x.productId === "B")?.weight).toBe(200); // cap still applies
  });
});

describe("Razorpay payment classification (stale pending orders)", () => {
  it("no payments, or only failed ones → verified unpaid", () => {
    expect(classifyPayments([])).toEqual({ state: "UNPAID" });
    expect(classifyPayments([{ id: "p1", status: "failed" }, { id: "p2", status: "failed" }])).toEqual({ state: "UNPAID" });
  });
  it("a captured payment wins → reconcile", () => {
    expect(classifyPayments([{ id: "p1", status: "failed" }, { id: "p2", status: "captured" }])).toEqual({
      state: "CAPTURED",
      paymentId: "p2",
    });
  });
  it("created / authorized / refunded / unknown → uncertain (never ignored)", () => {
    for (const status of ["created", "authorized", "refunded", "something-new"]) {
      expect(classifyPayments([{ id: "p", status }])).toEqual({ state: "UNCERTAIN" });
    }
  });
});

describe("orderFingerprint", () => {
  const base = {
    items: [
      { variantId: "a", quantity: 1, price: 100 },
      { variantId: "b", quantity: 2, price: 50 },
    ],
    total: 200,
    addressId: "addr",
    paymentMethod: "RAZORPAY" as const,
  };
  it("ignores line order but not content", () => {
    expect(orderFingerprint({ ...base, items: [...base.items].reverse() })).toBe(orderFingerprint(base));
    expect(orderFingerprint({ ...base, total: 201 })).not.toBe(orderFingerprint(base));
    expect(orderFingerprint({ ...base, addressId: "other" })).not.toBe(orderFingerprint(base));
    expect(orderFingerprint({ ...base, paymentMethod: "COD" })).not.toBe(orderFingerprint(base));
  });
});

describe("bounded transaction retry (O2)", () => {
  const deadlock = new Prisma.PrismaClientKnownRequestError("Transaction failed due to a write conflict or a deadlock", {
    code: "P2034",
    clientVersion: "6",
  });

  it("recognises deadlock / serialization aborts only", () => {
    expect(isTransientTxError(deadlock)).toBe(true);
    expect(isTransientTxError(new Error('ERROR: deadlock detected (SQLSTATE 40P01)'))).toBe(true);
    expect(isTransientTxError(new Error("unique constraint"))).toBe(false);
  });

  it("retries a deadlock and returns the next result", async () => {
    const run = vi.fn().mockRejectedValueOnce(deadlock).mockResolvedValueOnce("ok");
    await expect(withTxRetry(run)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 attempts and never retries business errors", async () => {
    const always = vi.fn().mockRejectedValue(deadlock);
    await expect(withTxRetry(always)).rejects.toBe(deadlock);
    expect(always).toHaveBeenCalledTimes(3);
    const business = vi.fn().mockRejectedValue(new Error("CLAIM_LIMIT"));
    await expect(withTxRetry(business)).rejects.toThrow("CLAIM_LIMIT");
    expect(business).toHaveBeenCalledTimes(1);
  });
});
