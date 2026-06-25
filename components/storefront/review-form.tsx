"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { submitReview, type ReviewState } from "@/lib/actions/reviews";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";
import { cn } from "@/lib/utils";

export function ReviewForm({
  productId,
  slug,
}: {
  productId: string;
  slug: string;
}) {
  const [state, action] = useActionState<ReviewState, FormData>(
    submitReview,
    undefined,
  );
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

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
            >
              <Star
                className={cn(
                  "size-6 transition-colors",
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
      <SubmitButton className="sm:w-auto">Submit review</SubmitButton>
    </form>
  );
}
