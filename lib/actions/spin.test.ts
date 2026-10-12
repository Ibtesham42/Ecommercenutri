import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * B1 regression: every NEW anonymous spin must pass the rate limiter, whatever
 * `nut_spin` cookie the request carries. Exercises the real spinAction +
 * spinWheel with Prisma, cookies, auth and the limiter mocked (no DB).
 */

const cookieStore = new Map<string, string>();
const jar = {
  get: (k: string) => (cookieStore.has(k) ? { value: cookieStore.get(k)! } : undefined),
  set: vi.fn((k: string, v: string) => void cookieStore.set(k, v)),
  delete: vi.fn((k: string) => void cookieStore.delete(k)),
};
vi.mock("next/headers", () => ({
  cookies: async () => jar,
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn, revalidateTag: vi.fn() }));

const getCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({ getCurrentUser }));

const checkRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit, limiters: { spin: {}, spinClaim: {} } }));
vi.mock("@/lib/recommendations/events", () => ({ trackEvent: vi.fn() }));

const LIVE = {
  id: "camp_live",
  name: "Live",
  isActive: true,
  startsAt: null,
  endsAt: null,
  prizes: [{ percent: 10, weight: 1 }],
  eligibleVariantIds: ["v1"],
  minStock: 5,
  weightCap: 200,
  claimWindowHours: 24,
  offerValidDays: 7,
  maxClaims: null,
  claimCount: 0,
  minOrder: null,
  maxDiscount: null,
  saleMode: "BEST_OF",
  createdAt: new Date(),
  updatedAt: new Date(),
};
const spinRow = (over: Record<string, unknown> = {}) => ({
  id: "spin_1",
  campaignId: LIVE.id,
  userId: null,
  tokenHash: "h",
  anonId: "anon_1",
  percent: 10,
  productId: "p1",
  variantIds: ["v1"],
  status: "AWARDED",
  expiresAt: new Date(Date.now() + 3_600_000),
  couponId: null,
  claimedAt: null,
  redeemedAt: null,
  createdAt: new Date(),
  ...over,
});

const prismaMock = {
  spinCampaign: { findMany: vi.fn() },
  spinResult: { findUnique: vi.fn(), create: vi.fn() },
  productVariant: { findMany: vi.fn() },
  product: { findUnique: vi.fn() },
  coupon: { findUnique: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { spinAction } = await import("@/lib/actions/spin");

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.clear();
  cookieStore.set("nut_anon", "anon_1");
  getCurrentUser.mockResolvedValue(null);
  checkRateLimit.mockResolvedValue({ success: true });
  prismaMock.spinCampaign.findMany.mockResolvedValue([LIVE]);
  prismaMock.spinResult.findUnique.mockResolvedValue(null);
  prismaMock.spinResult.create.mockImplementation(async ({ data }) => spinRow(data));
  // findMany serves both loadVariantStock (stock fields) and toSpinView (labels).
  prismaMock.productVariant.findMany.mockResolvedValue([
    { id: "v1", productId: "p1", stock: 50, isActive: true, product: { isActive: true }, weightLabel: "100g" },
  ]);
  prismaMock.product.findUnique.mockResolvedValue({ name: "Makhana", slug: "makhana", images: [] });
});

const denied = () => checkRateLimit.mockResolvedValue({ success: false });

describe("spinAction rate limiting (B1)", () => {
  it("limits a visitor with no cookie", async () => {
    denied();
    const res = await spinAction();
    expect(res).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(prismaMock.spinResult.create).not.toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalledWith(expect.anything(), "ip:203.0.113.7");
    expect(checkRateLimit).toHaveBeenCalledWith(expect.anything(), "anon:anon_1");
  });

  it("does NOT let a forged/garbage cookie bypass the limiter", async () => {
    cookieStore.set("nut_spin", "garbage-value");
    denied();
    const res = await spinAction();
    expect(res).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(prismaMock.spinResult.create).not.toHaveBeenCalled();
  });

  it("does NOT let a claimed/consumed cookie bypass the limiter (hash no longer resolves)", async () => {
    cookieStore.set("nut_spin", "token-of-a-claimed-spin");
    prismaMock.spinResult.findUnique.mockResolvedValue(null); // claim nulls tokenHash
    denied();
    expect(await spinAction()).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(prismaMock.spinResult.create).not.toHaveBeenCalled();
  });

  it("does NOT let a cookie from another (paused/ended) campaign bypass the limiter", async () => {
    cookieStore.set("nut_spin", "old-campaign-token");
    prismaMock.spinResult.findUnique.mockResolvedValue(spinRow({ campaignId: "camp_old" }));
    denied();
    expect(await spinAction()).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(prismaMock.spinResult.create).not.toHaveBeenCalled();
  });

  it("creates a new anonymous spin only when the limiter allows it", async () => {
    cookieStore.set("nut_spin", "garbage-value");
    const res = await spinAction();
    expect(res.ok).toBe(true);
    expect(checkRateLimit).toHaveBeenCalled();
    expect(prismaMock.spinResult.create).toHaveBeenCalledTimes(1);
    expect(jar.set).toHaveBeenCalledWith("nut_spin", expect.any(String), expect.objectContaining({ httpOnly: true }));
  });

  it("replays a valid live-campaign cookie without consuming the limit or re-rolling", async () => {
    cookieStore.set("nut_spin", "valid-token");
    prismaMock.spinResult.findUnique.mockResolvedValue(spinRow());
    denied(); // even an exhausted limiter must not block a replay
    const res = await spinAction();
    expect(res).toMatchObject({ ok: true, view: { percent: 10 } });
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(prismaMock.spinResult.create).not.toHaveBeenCalled();
  });

  it("does not IP-limit signed-in spins (bounded by one spin per account instead)", async () => {
    getCurrentUser.mockResolvedValue({ id: "user_1" });
    prismaMock.spinResult.findUnique.mockResolvedValue(spinRow({ userId: "user_1", status: "CLAIMED" }));
    denied();
    const res = await spinAction();
    expect(res.ok).toBe(true);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });
});
