import Link from "next/link";
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

  return (
    <section id="reviews" className="mt-14 scroll-mt-20">
      <h2 className="mb-6 text-xl font-bold">Customer reviews</h2>
      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border p-5 text-center">
            <div className="text-4xl font-bold">{ratingAvg.toFixed(1)}</div>
            <StarRating
              rating={ratingAvg}
              size="md"
              className="mt-1 justify-center"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              {ratingCount} {ratingCount === 1 ? "review" : "reviews"}
            </p>
          </div>
          {user ? (
            <ReviewForm productId={productId} slug={slug} />
          ) : (
            <div className="rounded-xl border p-4 text-center text-sm text-muted-foreground">
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

        <div className="space-y-4">
          {reviews.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No reviews yet. Be the first to share your experience!
            </p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9">
                    {r.userImage && <AvatarImage src={r.userImage} alt="" />}
                    <AvatarFallback>{initials(r.userName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {r.userName ?? "Verified buyer"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <StarRating rating={r.rating} className="ml-auto" />
                </div>
                {r.title && <p className="mt-3 text-sm font-semibold">{r.title}</p>}
                {r.comment && (
                  <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
