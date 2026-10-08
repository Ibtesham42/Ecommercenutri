import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({
  rating,
  count,
  size = "sm",
  className,
}: {
  rating: number;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const sizeClass = size === "md" ? "size-4" : "size-3.5";
  const label = `Rated ${rating.toFixed(1)} out of 5${
    typeof count === "number" ? ` from ${count} ${count === 1 ? "review" : "reviews"}` : ""
  }`;
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span className="sr-only">{label}</span>
      <div className="flex" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < Math.round(rating);
          return (
            <Star
              key={i}
              className={cn(
                sizeClass,
                filled ? "fill-gold text-gold" : "fill-foreground/10 text-foreground/20",
              )}
            />
          );
        })}
      </div>
      {typeof count === "number" && (
        <span aria-hidden className="text-xs text-muted-foreground tabular-nums">
          {rating.toFixed(1)} ({count})
        </span>
      )}
    </div>
  );
}
