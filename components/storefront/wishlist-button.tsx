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
        "inline-flex items-center justify-center gap-2 rounded-full",
        withLabel
          ? "h-9 border px-4 text-sm font-medium hover:bg-accent"
          : "size-8 bg-background/80 backdrop-blur hover:bg-background",
        className,
      )}
    >
      <Heart
        className={cn(
          "size-4 transition-colors",
          active && "fill-rose-500 text-rose-500",
        )}
      />
      {withLabel && (active ? "Wishlisted" : "Wishlist")}
    </button>
  );
}
