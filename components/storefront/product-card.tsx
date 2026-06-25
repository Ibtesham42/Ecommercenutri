import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/storefront/star-rating";
import { WishlistButton } from "@/components/storefront/wishlist-button";
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
  const outOfStock = product.variants.every((v) => v.stock <= 0);

  return (
    <Card className="group relative overflow-hidden p-0 transition-all hover:border-primary/40 hover:shadow-md">
      <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
        {product.isBestSeller && (
          <Badge className="bg-amber-500 text-white hover:bg-amber-500">
            Best Seller
          </Badge>
        )}
        {off ? (
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {off}% OFF
          </Badge>
        ) : null}
      </div>
      <div className="absolute right-2 top-2 z-10">
        <WishlistButton productId={product.id} initial={wishlisted} />
      </div>

      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-accent/30">
          {image ? (
            <Image
              src={image.url}
              alt={image.alt ?? product.name}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : null}
          {outOfStock && (
            <div className="absolute inset-0 grid place-items-center bg-background/60">
              <Badge variant="secondary">Out of stock</Badge>
            </div>
          )}
        </div>
      </Link>

      <CardContent className="space-y-1.5 p-4">
        <p className="text-xs text-muted-foreground">{product.category.name}</p>
        <Link href={`/products/${product.slug}`}>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary">
            {product.name}
          </h3>
        </Link>
        {product.ratingCount > 0 && (
          <StarRating rating={product.ratingAvg} count={product.ratingCount} />
        )}
        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-base font-bold">
            {hasMultiple ? "From " : ""}
            {formatPrice(sale)}
          </span>
          {defaultVariant?.discountPrice &&
            effectivePrice(mrp, defaultVariant.discountPrice) < mrp && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(mrp)}
              </span>
            )}
        </div>
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
