"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/storefront/star-rating";
import { ReviewPhotoGallery } from "@/components/storefront/review-photo-gallery";
import { cn } from "@/lib/utils";

export type ReviewVM = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: string;
  userName: string | null;
  userImage: string | null;
  images: string[];
  verifiedPurchase: boolean;
};

type SortKey = "recent" | "highest" | "lowest" | "photos";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Most recent" },
  { key: "highest", label: "Highest rated" },
  { key: "lowest", label: "Lowest rated" },
  { key: "photos", label: "With photos first" },
];

const PAGE_SIZE = 5;

// Fixed to the store's timezone: this list renders on the server (UTC) and
// hydrates in the browser, so a timezone-dependent date (e.g. a review posted
// 00:00–05:30 IST) would differ between the two and throw React #418.
const reviewDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

function initials(name: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ReviewList({ reviews }: { reviews: ReviewVM[] }) {
  const [sort, setSort] = useState<SortKey>("recent");
  const [photosOnly, setPhotosOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const base = photosOnly ? reviews.filter((r) => r.images.length > 0) : reviews;
    const sorted = [...base];
    switch (sort) {
      case "highest":
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case "lowest":
        sorted.sort((a, b) => a.rating - b.rating);
        break;
      case "photos":
        sorted.sort((a, b) => b.images.length - a.images.length);
        break;
      default:
        // Already createdAt desc from the server query.
        break;
    }
    return sorted;
  }, [reviews, sort, photosOnly]);

  if (reviews.length === 0) {
    return (
      <div className="rounded-xl bg-oat px-6 py-12 text-center">
        <MessageSquare aria-hidden className="mx-auto size-8 text-muted-foreground/50" strokeWidth={1.5} />
        <p className="mt-3 font-heading text-lg">No reviews yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Be the first to share your experience with this product.
        </p>
      </div>
    );
  }

  const shown = filtered.slice(0, visible);
  const withPhotos = reviews.some((r) => r.images.length > 0);

  return (
    <div>
      {/* Sorting only earns its place once there's something to sort. */}
      {reviews.length >= 3 && (
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-4">
        <div className="flex flex-wrap gap-1.5">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setSort(s.key);
                setVisible(PAGE_SIZE);
              }}
              aria-pressed={sort === s.key}
              className={cn(
                "inline-flex h-11 items-center rounded-full border px-3.5 text-[13px] transition-colors [@media(pointer:fine)]:h-8",
                sort === s.key
                  ? "border-foreground/70 text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {withPhotos && (
          <label className="flex min-h-11 shrink-0 items-center gap-2 text-[13px] text-muted-foreground [@media(pointer:fine)]:min-h-8">
            <input
              type="checkbox"
              checked={photosOnly}
              onChange={(e) => {
                setPhotosOnly(e.target.checked);
                setVisible(PAGE_SIZE);
              }}
              className="size-4 accent-primary"
            />
            Photos only
          </label>
        )}
      </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No reviews match that filter.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
        {shown.map((r) => (
          <li key={r.id} className="py-6">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                {r.userImage && <AvatarImage src={r.userImage} alt="" />}
                <AvatarFallback>{initials(r.userName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{r.userName ?? "Nutriyet customer"}</span>
                  {r.verifiedPurchase && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary">
                      <BadgeCheck className="size-3.5" /> Verified Purchase
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{reviewDate.format(new Date(r.createdAt))}</p>
              </div>
              <StarRating rating={r.rating} size="sm" className="ml-auto shrink-0" />
            </div>
            {r.title && <h3 className="mt-4 font-heading text-base font-medium">{r.title}</h3>}
            {r.comment && (
              <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{r.comment}</p>
            )}
            <ReviewPhotoGallery images={r.images} reviewerName={r.userName ?? "Nutriyet customer"} />
          </li>
        ))}
        </ul>
      )}

      {visible < filtered.length && (
        <Button
          variant="outline"
          className="mt-6 h-11 w-full rounded-lg"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
        >
          Show more reviews ({filtered.length - visible} more)
        </Button>
      )}
    </div>
  );
}
