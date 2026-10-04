import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Batch 4 — unit tests for the review-moderation default change
 * (lib/actions/reviews.ts). Mocks Prisma, auth, rate-limiting and Cloudinary
 * URL validation entirely — no real database connection or writes, no
 * production/staging data touched, consistent with the mocking approach used
 * for the Batch 1 coupon/stock tests.
 */

const prismaMock = {
  review: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  },
  product: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  orderItem: {
    findFirst: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ success: true, limit: 0, remaining: 0, reset: 0 })),
  limiters: { api: {} },
}));
vi.mock("@/lib/cloudinary", () => ({
  isTrustedCloudinaryUrl: (url: string) => url.startsWith("https://res.cloudinary.com/"),
}));

const { getCurrentUser } = await import("@/lib/auth");
const { submitReview } = await import("@/lib/actions/reviews");

const USER = { id: "user_1", email: "a@example.com" };
const TRUSTED_IMAGE = "https://res.cloudinary.com/nutriyet/image/upload/v1/review.jpg";

function formData(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(USER);
  prismaMock.product.findUnique.mockResolvedValue({ id: "product_1" });
  prismaMock.orderItem.findFirst.mockResolvedValue(null); // not a verified purchase, by default
  prismaMock.review.aggregate.mockResolvedValue({ _avg: { rating: 4 }, _count: 1 });
  prismaMock.product.update.mockResolvedValue({});
  prismaMock.review.upsert.mockResolvedValue({});
});

describe("submitReview — new-review photo moderation (Batch 4)", () => {
  it("a brand-new text-only review still publishes instantly (unchanged behavior)", async () => {
    prismaMock.review.findUnique.mockResolvedValue(null); // no existing row — this is a create
    const result = await submitReview(undefined, formData({
      productId: "product_1",
      slug: "p1",
      rating: "5",
      comment: "Great product",
    }));
    expect(result?.success).toBe("Thanks for your review!");
    const createData = prismaMock.review.upsert.mock.calls[0][0].create;
    expect(createData.isApproved).toBe(true);
  });

  it("a brand-new review WITH photos is held for moderation (isApproved: false), not published instantly", async () => {
    prismaMock.review.findUnique.mockResolvedValue(null); // create path
    const result = await submitReview(undefined, formData({
      productId: "product_1",
      slug: "p1",
      rating: "5",
      comment: "Love it",
      images: [TRUSTED_IMAGE],
    }));
    const createData = prismaMock.review.upsert.mock.calls[0][0].create;
    expect(createData.isApproved).toBe(false);
    expect(result?.success).toMatch(/after a quick check/i);
  });

  it("editing an EXISTING review never touches its current approval status, even if the edit adds photos", async () => {
    prismaMock.review.findUnique.mockResolvedValue({ id: "existing_review_1" }); // update path
    await submitReview(undefined, formData({
      productId: "product_1",
      slug: "p1",
      rating: "4",
      comment: "Updated my review",
      images: [TRUSTED_IMAGE],
    }));
    const updateData = prismaMock.review.upsert.mock.calls[0][0].update;
    expect(updateData).not.toHaveProperty("isApproved"); // omitted entirely — Prisma leaves it untouched
  });

  it("verified-purchase computation is unaffected by the moderation change", async () => {
    prismaMock.review.findUnique.mockResolvedValue(null);
    prismaMock.orderItem.findFirst.mockResolvedValue({ id: "order_item_1" }); // a real confirmed purchase
    await submitReview(undefined, formData({
      productId: "product_1",
      slug: "p1",
      rating: "5",
      comment: "Verified buyer",
      images: [TRUSTED_IMAGE],
    }));
    const createData = prismaMock.review.upsert.mock.calls[0][0].create;
    expect(createData.verifiedPurchase).toBe(true);
    expect(createData.isApproved).toBe(false); // still gated — the two are independent
  });

  it("untrusted (non-Cloudinary) image URLs are stripped before the images.length moderation check runs", async () => {
    prismaMock.review.findUnique.mockResolvedValue(null);
    await submitReview(undefined, formData({
      productId: "product_1",
      slug: "p1",
      rating: "5",
      comment: "Trying to inject a URL",
      images: ["https://evil.example.com/not-ours.jpg"],
    }));
    const createData = prismaMock.review.upsert.mock.calls[0][0].create;
    expect(createData.images).toEqual([]);
    expect(createData.isApproved).toBe(true); // no real photos survived filtering, so it still auto-publishes
  });

  it("the rating aggregate query still only counts isApproved reviews (unchanged)", async () => {
    prismaMock.review.findUnique.mockResolvedValue(null);
    await submitReview(undefined, formData({
      productId: "product_1",
      slug: "p1",
      rating: "5",
      comment: "x",
    }));
    expect(prismaMock.review.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: "product_1", isApproved: true } }),
    );
  });
});
