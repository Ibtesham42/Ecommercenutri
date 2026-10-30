import { describe, it, expect, vi } from "vitest";

/**
 * checkAnalyticsRateLimit: rotating the client-supplied id must not escape the
 * server-controlled per-IP ceiling. Upstash is replaced by an in-memory
 * fixed counter (no network).
 */

vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    private max: number;
    private hits = new Map<string, number>();
    constructor(opts: { limiter: { max: number }; prefix: string }) {
      this.max = opts.limiter.max;
    }
    static slidingWindow(max: number) {
      return { max };
    }
    async limit(key: string) {
      const n = (this.hits.get(key) ?? 0) + 1;
      this.hits.set(key, n);
      return { success: n <= this.max, limit: this.max, remaining: Math.max(0, this.max - n), reset: 0 };
    }
  }
  return { Ratelimit };
});

const { checkAnalyticsRateLimit } = await import("@/lib/rate-limit");

function beacon(ip: string, extra: Record<string, string> = {}) {
  return new Request("http://localhost/api/track", {
    method: "POST",
    headers: { "x-forwarded-for": ip, ...extra },
  });
}

describe("checkAnalyticsRateLimit", () => {
  it("one id is still capped at the per-client limit", async () => {
    let ok = 0;
    for (let i = 0; i < 100; i++) if (await checkAnalyticsRateLimit(beacon("10.0.0.1"), "t1", "cid-fixed")) ok++;
    expect(ok).toBe(60);
  });

  it("rotating the client id can't exceed the per-IP ceiling", async () => {
    let ok = 0;
    for (let i = 0; i < 1000; i++) {
      if (await checkAnalyticsRateLimit(beacon("10.0.0.2"), "t2", `cid-${i}`)) ok++;
    }
    expect(ok).toBe(600);
  });

  it("client-settable headers other than the edge IP don't change the key", async () => {
    let ok = 0;
    for (let i = 0; i < 700; i++) {
      const spoof = { "x-real-ip": `1.2.3.${i % 250}`, "x-client-ip": `5.6.7.${i % 250}`, "true-client-ip": "9.9.9.9" };
      if (await checkAnalyticsRateLimit(beacon("10.0.0.4", spoof), "t3", `cid-${i}`)) ok++;
    }
    expect(ok).toBe(600);
  });

  it("other IPs are unaffected", async () => {
    expect(await checkAnalyticsRateLimit(beacon("10.0.0.3"), "t2", "cid-new")).toBe(true);
  });
});
