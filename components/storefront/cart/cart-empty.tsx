import { ShoppingBag } from "lucide-react";
import { EmptyState } from "@/components/storefront/empty-state";

/** One empty-cart moment for both /cart and /checkout. */
export function CartEmpty({ description = "Add some wholesome goodness to get started." }: { description?: string }) {
  return (
    <EmptyState
      icon={ShoppingBag}
      title="Your cart is empty"
      description={description}
      action={{ label: "Browse products", href: "/products" }}
    />
  );
}
