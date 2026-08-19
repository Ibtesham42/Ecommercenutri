"use client";

import { useActionState, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { submitReview, type ReviewState } from "@/lib/actions/reviews";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";
import { ReviewPhotoUpload } from "@/components/storefront/review-photo-upload";
import { cn } from "@/lib/utils";

export function ReviewForm({
  productId,
  slug,
  cloudinaryReady,
}: {
  productId: string;
  slug: string;
  cloudinaryReady: boolean;
}) {
  const [state, action] = useActionState<ReviewState, FormData>(
    submitReview,
    undefined,
  );
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [images, setImages] = useState<string[]>([]);

  // Clear photos after a successful submit so a re-open of the form starts fresh.
  useEffect(() => {
    if (state?.success) setImages([]);
  }, [state?.success]);

  return (
    <form action={action} className="space-y-3 rounded-xl border p-4">
      <p className="text-sm font-semibold">Write a review</p>
      {state?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {state.success}
        </p>
      )}

      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="rating" value={rating} />
      {images.map((url) => (
        <input key={url} type="hidden" name="images" value={url} />
      ))}

      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => {
          const value = i + 1;
          const filled = (hover || rating) >= value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHover(value)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${value} star${value > 1 ? "s" : ""}`}
              className="p-1 -m-1"
            >
              <Star
                className={cn(
                  "size-7 transition-colors sm:size-6",
                  filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
                )}
              />
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="review-title">Title (optional)</Label>
        <Input id="review-title" name="title" placeholder="Loved it!" maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="review-comment">Your review (optional)</Label>
        <Textarea
          id="review-comment"
          name="comment"
          placeholder="Share your experience with this product…"
          rows={3}
          maxLength={2000}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Photos (optional)</Label>
        <ReviewPhotoUpload value={images} onChange={setImages} cloudinaryReady={cloudinaryReady} />
      </div>
      <SubmitButton className="w-full sm:w-auto">Submit review</SubmitButton>
    </form>
  );
}
