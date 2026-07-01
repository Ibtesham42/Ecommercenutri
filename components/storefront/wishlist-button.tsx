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
}: {
  productId: string;
  initial?: boolean;
  className?: string;
  withLabel?: boolean;
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

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full transition-transform active:scale-90",
        withLabel
          ? "h-9 border px-4 text-sm font-medium hover:bg-accent"
          : "size-8 bg-background/80 shadow-sm backdrop-blur hover:bg-background",
        className,
      )}
    >
      <Heart
        // `key` remounts the icon on each favorite so the pop keyframe replays.
        key={pop}
        className={cn(
          "size-4 transition-all duration-200",
          active ? "scale-110 fill-rose-500 text-rose-500" : "hover:text-rose-500",
          // `.animate-pop` lives inside the reduced-motion `no-preference` block,
          // so it's already suppressed for users who prefer reduced motion.
          pop > 0 && active && "animate-pop",
        )}
      />
      {withLabel && (active ? "Wishlisted" : "Wishlist")}
    </button>
  );
}
