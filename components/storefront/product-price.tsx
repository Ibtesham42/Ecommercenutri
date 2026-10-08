import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Storefront price line: selling price leads, struck MRP and a small discount
 * note support it. Renders a discount only when the data has a real one.
 * Plain component (no hooks) so server cards and client dialogs share it.
 */
export function ProductPrice({
  price,
  mrp,
  off,
  fromPrice = false,
  size = "md",
  className,
}: {
  price: number;
  mrp?: number | null;
  off?: number | null;
  fromPrice?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  const discounted = !!off && !!mrp && mrp > price;
  return (
    <p className={cn("pcard-price flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span
        className={cn(
          "font-semibold tracking-tight text-foreground tabular-nums",
          size === "lg" ? "text-xl" : "text-[15px] sm:text-base",
        )}
      >
        {fromPrice && (
          <span className="mr-1 text-xs font-normal tracking-normal text-muted-foreground">From</span>
        )}
        {formatPrice(price)}
      </span>
      {discounted && (
        <>
          <s className={cn("text-muted-foreground tabular-nums", size === "lg" ? "text-sm" : "text-xs")}>
            <span className="sr-only">MRP </span>
            {formatPrice(mrp)}
          </s>
          <span
            className={cn(
              "font-medium text-(--pcard-accent-text)",
              size === "lg" ? "text-sm" : "text-xs",
            )}
          >
            {off}% off
          </span>
        </>
      )}
    </p>
  );
}
