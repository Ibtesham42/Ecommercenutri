import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/storefront/star-rating";
import { WishlistButton } from "@/components/storefront/wishlist-button";
import { BlurImage } from "@/components/storefront/blur-image";
import { QuickAddButton } from "@/components/storefront/quick-add-button";
import { Reveal } from "@/components/storefront/reveal";
import { cn } from "@/lib/utils";
import { formatPrice, discountPercent, effectivePrice } from "@/lib/format";
import { minVariantPrice, type ProductCardData } from "@/lib/queries/products";

export function ProductCard({
  product,
  wishlisted,
}: {
  product: ProductCardData;
  wishlisted?: boolean;
}) {
  const image = product.images[0];
  const defaultVariant =
    product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const min = minVariantPrice(product.variants);
  const hasMultiple = product.variants.length > 1;
  const mrp = defaultVariant?.price ?? 0;
  const sale = min ?? mrp;
  const off = defaultVariant
    ? discountPercent(defaultVariant.price, defaultVariant.discountPrice)
    : null;
  const hasDiscount =
    !!defaultVariant?.discountPrice &&
    effectivePrice(mrp, defaultVariant.discountPrice) < mrp;
  const totalStock = product.variants.reduce((sum, v) => sum + Math.max(0, v.stock), 0);
  const outOfStock = totalStock <= 0;
  const lowStock = !outOfStock && totalStock <= 5;

  return (
    <Card className="group card-lift relative flex h-full flex-col overflow-hidden rounded-2xl border-border/70 p-0 shadow-elev-1 hover:border-primary/40 hover:shadow-elev-2">
      <div className="pointer-events-none absolute left-2.5 top-2.5 z-10 flex flex-col items-start gap-1">
        {product.isBestSeller && (
          <Badge className="badge-breathe gap-1 border-transparent bg-surface-deep text-surface-deep-foreground shadow-sm hover:bg-surface-deep">
            <span className="text-gold">★</span> Best Seller
          </Badge>
        )}
        {off ? (
          <Badge className="badge-breathe border-transparent bg-gold text-gold-foreground shadow-sm [animation-delay:1.6s] hover:bg-gold">
            {off}% OFF
          </Badge>
        ) : null}
      </div>
      <div className="absolute right-2.5 top-2.5 z-10">
        <WishlistButton productId={product.id} initial={wishlisted} />
      </div>

      <Link
        href={`/products/${product.slug}`}
        className="block focus-visible:outline-none"
        aria-label={product.name}
      >
        <div className="relative aspect-square overflow-hidden bg-muted">
          {image ? (
            <BlurImage
              src={image.url}
              alt={image.alt ?? product.name}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04]"
            />
          ) : null}
          {outOfStock && (
            <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-[1px]">
              <Badge variant="secondary">Out of stock</Badge>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5 sm:p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {product.category.name}
        </p>
        <Link href={`/products/${product.slug}`}>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug transition-colors group-hover:text-primary">
            {product.name}
          </h3>
        </Link>
        {product.ratingCount > 0 && (
          <StarRating rating={product.ratingAvg} count={product.ratingCount} />
        )}
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-1.5">
          <span className="text-base font-bold tracking-tight">
            {hasMultiple ? "From " : ""}
            {formatPrice(sale)}
          </span>
          {hasDiscount && (
            <>
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(mrp)}
              </span>
              {off ? (
                <span className="text-xs font-semibold text-primary">Save {off}%</span>
              ) : null}
            </>
          )}
        </div>
        {lowStock && (
          <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
            Only {totalStock} left
          </p>
        )}
        <div className="pt-2">
          <QuickAddButton product={product} />
        </div>
      </div>
    </Card>
  );
}

export function ProductGrid({
  products,
  wishlistedIds,
  className,
}: {
  products: ProductCardData[];
  wishlistedIds?: Set<string>;
  /** Override the responsive grid classes when a section needs a different density. */
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5",
        className,
      )}
    >
      {products.map((p, i) => (
        // Fade each card up as it scrolls into view (staggered per row for a
        // premium cascade). Reveal is reduced-motion gated + passes RSC children
        // straight through, so the server-rendered card is untouched.
        <Reveal key={p.id} className="h-full" delay={(i % 5) * 40}>
          <ProductCard product={p} wishlisted={wishlistedIds?.has(p.id)} />
        </Reveal>
      ))}
    </div>
  );
}

/**
 * Horizontal scroll-snap rail on mobile, responsive grid on tablet/desktop.
 * Gives home sections a distinct, premium "carousel" feel vs. the catalog grid
 * — purely presentational, reuses `ProductCard`.
 */
export function ProductRail({
  products,
  wishlistedIds,
}: {
  products: ProductCardData[];
  wishlistedIds?: Set<string>;
}) {
  return (
    <>
      {/* Mobile: edge-to-edge horizontal rail (staggered reveal like the grid) */}
      <div className="scroll-rail -mx-4 gap-3 px-4 pb-1 md:hidden">
        {products.map((p, i) => (
          <div key={p.id} className="w-[44vw] max-w-[210px] shrink-0">
            <Reveal className="h-full" delay={(i % 4) * 50}>
              <ProductCard product={p} wishlisted={wishlistedIds?.has(p.id)} />
            </Reveal>
          </div>
        ))}
      </div>
      {/* Tablet/desktop: grid */}
      <div className="hidden gap-4 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((p, i) => (
          <Reveal key={p.id} className="h-full" delay={(i % 5) * 40}>
            <ProductCard product={p} wishlisted={wishlistedIds?.has(p.id)} />
          </Reveal>
        ))}
      </div>
    </>
  );
}
