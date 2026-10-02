import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { StarRating } from "@/components/storefront/star-rating";
import { ReviewForm } from "@/components/storefront/review-form";
import { ReviewList, type ReviewVM } from "@/components/storefront/review-list";

export async function ProductReviews({
  productId,
  slug,
  ratingAvg,
  ratingCount,
  reviews,
  cloudinaryReady,
}: {
  productId: string;
  slug: string;
  ratingAvg: number;
  ratingCount: number;
  reviews: ReviewVM[];
  cloudinaryReady: boolean;
}) {
  const user = await getCurrentUser();

  // Star distribution from the visible (approved) reviews.
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
  const distTotal = reviews.length || 1;

  return (
    <section id="reviews" className="mt-14 scroll-mt-20">
      <h2 className="mb-6 text-xl font-bold sm:text-2xl">Customer reviews</h2>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border p-5">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-4xl font-bold leading-none">
                  {ratingAvg.toFixed(1)}
                </div>
                <StarRating rating={ratingAvg} size="sm" className="mt-1.5 justify-center" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Based on {ratingCount} {ratingCount === 1 ? "review" : "reviews"}
                </p>
              </div>
            </div>

            {reviews.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {dist.map((d) => (
                  <div key={d.star} className="flex items-center gap-2 text-xs">
                    <span className="w-6 text-muted-foreground">{d.star}★</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${(d.count / distTotal) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right tabular-nums text-muted-foreground">
                      {d.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {user ? (
            <ReviewForm productId={productId} slug={slug} cloudinaryReady={cloudinaryReady} />
          ) : (
            <div className="rounded-2xl border p-4 text-center text-sm text-muted-foreground">
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/products/${slug}`)}`}
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </Link>{" "}
              to write a review.
            </div>
          )}
        </div>

        <ReviewList reviews={reviews} />
      </div>
    </section>
  );
}
