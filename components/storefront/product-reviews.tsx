import Link from "next/link";
import { BadgeCheck, MessageSquare } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { StarRating } from "@/components/storefront/star-rating";
import { ReviewForm } from "@/components/storefront/review-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate } from "@/lib/format";

type ReviewVM = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: string;
  userName: string | null;
  userImage: string | null;
};

function initials(name: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export async function ProductReviews({
  productId,
  slug,
  ratingAvg,
  ratingCount,
  reviews,
}: {
  productId: string;
  slug: string;
  ratingAvg: number;
  ratingCount: number;
  reviews: ReviewVM[];
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
      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
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
            <ReviewForm productId={productId} slug={slug} />
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

        <div className="space-y-3">
          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center">
              <MessageSquare className="mx-auto size-10 text-muted-foreground/40" />
              <p className="mt-3 font-medium">No reviews yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Be the first to share your experience with this product.
              </p>
            </div>
          ) : (
            reviews.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border p-4 transition hover:border-foreground/15 sm:p-5"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    {r.userImage && <AvatarImage src={r.userImage} alt="" />}
                    <AvatarFallback>{initials(r.userName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{r.userName ?? "Nutriyet customer"}</span>
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary">
                        <BadgeCheck className="size-3.5" /> Verified
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <StarRating rating={r.rating} size="sm" className="ml-auto shrink-0" />
                </div>
                {r.title && <p className="mt-3 text-sm font-semibold">{r.title}</p>}
                {r.comment && (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {r.comment}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
