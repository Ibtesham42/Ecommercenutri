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
    <section
      id="reviews"
      aria-labelledby="reviews-heading"
      className="mt-16 scroll-mt-24 border-t border-border pt-10 lg:mt-24 lg:pt-14"
    >
      <p className="eyebrow">Reviews</p>
      <h2 id="reviews-heading" className="mt-2 font-heading text-heading text-foreground">
        Customer reviews
      </h2>
      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16">
        <div>
          {ratingCount > 0 ? (
            <div className="flex items-end gap-4">
              <span className="font-heading text-[3.5rem] leading-none text-foreground tabular-nums">
                {ratingAvg.toFixed(1)}
              </span>
              <div className="pb-1">
                <StarRating rating={ratingAvg} size="md" />
                <p className="mt-1 text-sm text-muted-foreground">
                  Based on {ratingCount} {ratingCount === 1 ? "review" : "reviews"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No ratings yet.</p>
          )}

          {reviews.length > 0 && (
            <div className="mt-6 space-y-2">
              {dist.map((d) => (
                <div key={d.star} className="flex items-center gap-3 text-xs">
                  <span className="w-7 text-muted-foreground tabular-nums">{d.star} ★</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
                    <div
                      className="h-full rounded-full bg-gold"
                      style={{ width: `${(d.count / distTotal) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right tabular-nums text-muted-foreground">{d.count}</span>
                  <span className="sr-only">
                    {d.count} {d.count === 1 ? "review" : "reviews"} with {d.star} stars
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 border-t border-border pt-6">
            {user ? (
              <ReviewForm productId={productId} slug={slug} cloudinaryReady={cloudinaryReady} />
            ) : (
              <p className="text-sm text-muted-foreground">
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(`/products/${slug}`)}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>{" "}
                to write a review.
              </p>
            )}
          </div>
        </div>

        <ReviewList reviews={reviews} />
      </div>
    </section>
  );
}
