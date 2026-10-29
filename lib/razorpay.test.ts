import { afterEach, describe, expect, it, vi } from "vitest";

/** Keyless payments must never "succeed" on a real deployment. */
async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
  return import("./razorpay");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("keyless payment fallbacks", () => {
  const keyless = { RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "" };

  it("are allowed locally (mock checkout + mock refund)", async () => {
    const m = await load({ ...keyless, VERCEL: "", ALLOW_MOCK_CHECKOUT: "" });
    expect(m.mockCheckoutAllowed).toBe(true);
    await expect(m.refundPayment("pay_x", 100)).resolves.toMatchObject({ status: "processed" });
  });

  it("are refused on a Vercel deployment with missing keys", async () => {
    const m = await load({ ...keyless, VERCEL: "1", ALLOW_MOCK_CHECKOUT: "" });
    expect(m.razorpayEnabled).toBe(false);
    expect(m.mockCheckoutAllowed).toBe(false);
    await expect(m.refundPayment("pay_x", 100)).rejects.toThrow(/not configured/);
  });

  it("can be opted into explicitly for a demo deployment", async () => {
    const m = await load({ ...keyless, VERCEL: "1", ALLOW_MOCK_CHECKOUT: "1" });
    expect(m.mockCheckoutAllowed).toBe(true);
  });
});
