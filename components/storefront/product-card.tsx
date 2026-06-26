import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/storefront/star-rating";
import { WishlistButton } from "@/components/storefront/wishlist-button";
import { BlurImage } from "@/components/storefront/blur-image";
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
    <Card className="group hover-lift relative overflow-hidden p-0 shadow-elev-1 transition-colors hover:border-primary/40 hover:shadow-elev-2">
      <div className="pointer-events-none absolute left-2.5 top-2.5 z-10 flex flex-col items-start gap-1">
        {product.isBestSeller && (
          <Badge className="border-transparent bg-gold text-gold-foreground shadow-sm hover:bg-gold">
            ★ Best Seller
          </Badge>
        )}
        {off ? (
          <Badge className="border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary">
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
        <div className="relative aspect-square overflow-hidden bg-accent/30">
          {image ? (
            <BlurImage
              src={image.url}
              alt={image.alt ?? product.name}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
            />
          ) : null}
          {outOfStock && (
            <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-[1px]">
              <Badge variant="secondary">Out of stock</Badge>
            </div>
          )}
        </div>
      </Link>

      <CardContent className="space-y-1.5 p-4">
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
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-1">
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
      </CardContent>
    </Card>
  );
}

export function ProductGrid({
  products,
  wishlistedIds,
}: {
  products: ProductCardData[];
  wishlistedIds?: Set<string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          wishlisted={wishlistedIds?.has(p.id)}
        />
      ))}
    </div>
  );
}
