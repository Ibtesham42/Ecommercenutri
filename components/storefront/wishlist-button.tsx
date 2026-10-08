"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { toggleWishlist } from "@/lib/actions/wishlist";
import { cn } from "@/lib/utils";

export function WishlistButton({
  productId,
  initial,
  className,
  withLabel = false,
  appearance = "default",
}: {
  productId: string;
  initial?: boolean;
  className?: string;
  withLabel?: boolean;
  /** "overlay": product-card corner control — a quiet 32px disc inside a 44px touch target. */
  appearance?: "default" | "overlay";
}) {
  const [active, setActive] = useState(Boolean(initial));
  // Bumped each time we favorite, to re-trigger the pop animation (via `key`).
  const [pop, setPop] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const res = await toggleWishlist(productId);
      if ("error" in res) {
        router.push(`/login?callbackUrl=${encodeURIComponent("/account/wishlist")}`);
        return;
      }
      setActive(res.wishlisted);
      if (res.wishlisted) setPop((n) => n + 1);
      toast.success(res.wishlisted ? "Added to wishlist" : "Removed from wishlist");
    });
  }

  const heart = (
    <Heart
      // `key` remounts the icon on each favorite so the pop keyframe replays.
      key={pop}
      className={cn(
        "size-4 transition-all duration-200",
        appearance === "overlay"
          ? active
            ? "fill-(--pcard-accent) text-(--pcard-accent)"
            : "text-foreground/80 group-hover/wl:text-(--pcard-accent)"
          : active
            ? "scale-110 fill-rose-500 text-rose-500"
            : "hover:text-rose-500",
        // `.animate-pop` lives inside the reduced-motion `no-preference` block,
        // so it's already suppressed for users who prefer reduced motion.
        pop > 0 && active && "animate-pop",
      )}
    />
  );

  if (appearance === "overlay") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={active}
        className={cn(
          "group/wl grid size-11 place-items-center rounded-full outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-ring",
          className,
        )}
      >
        <span className="grid size-8 place-items-center rounded-full bg-background/90 transition-[background-color,transform] group-hover/wl:bg-background group-active/wl:scale-90">
          {heart}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full transition-transform motion-safe:active:scale-90",
        withLabel
          ? "h-9 border px-4 text-sm font-medium hover:bg-accent"
          : "size-8 bg-background/80 shadow-elev-1 backdrop-blur hover:bg-background",
        className,
      )}
    >
      {heart}
      {withLabel && (active ? "Wishlisted" : "Wishlist")}
    </button>
  );
}
