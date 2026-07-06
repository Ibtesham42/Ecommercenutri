"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/store/cart";
import { trackClient } from "@/components/storefront/behavior-tracker";
import { getReorderItems } from "@/lib/actions/orders";
import { cn } from "@/lib/utils";

/**
 * One-tap "Buy it again" — re-adds a past order's still-available items to the
 * cart at current prices, then sends the shopper to the cart. The key repeat-
 * purchase lever for a consumables brand. Stops event propagation so it can sit
 * inside a linked order card without triggering navigation.
 */
export function BuyAgainButton({
  orderNumber,
  variant = "default",
  size = "sm",
  className,
  label = "Buy it again",
}: {
  orderNumber: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);
  const [pending, start] = useTransition();

  function handle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    start(async () => {
      const res = await getReorderItems(orderNumber);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      for (const { quantity, ...item } of res.items) {
        addItem(item, quantity);
        trackClient({ type: "CART_ADD", productId: item.productId });
      }
      toast.success(
        res.unavailable > 0
          ? `Added ${res.items.length} back to your cart · ${res.unavailable} now unavailable`
          : "Added back to your cart",
      );
      router.push("/cart");
    });
  }

  return (
    <Button
      type="button"
      onClick={handle}
      disabled={pending}
      variant={variant}
      size={size}
      className={cn("gap-2", className)}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
      {label}
    </Button>
  );
}
