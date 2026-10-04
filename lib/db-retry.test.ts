import { describe, it, expect, vi } from "vitest";
import { withDbRetry } from "@/lib/db-retry";

describe("withDbRetry", () => {
  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withDbRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once after a failure and returns the second attempt's result", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("P1001: can't reach database server"))
      .mockResolvedValueOnce("recovered");
    await expect(withDbRetry(fn)).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("propagates the error if the retry also fails (no infinite/extra retries)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("still down"));
    await expect(withDbRetry(fn)).rejects.toThrow("still down");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
