import Link from "next/link";
import { Star } from "lucide-react";
import { WishlistButton } from "@/components/storefront/wishlist-button";
import { BlurImage } from "@/components/storefront/blur-image";
import { QuickAddButton } from "@/components/storefront/quick-add-button";
import { QuickViewButton } from "@/components/storefront/quick-view-button";
import { ProductPrice } from "@/components/storefront/product-price";
import { Reveal } from "@/components/storefront/reveal";
import { ProductRailScroller } from "@/components/storefront/product-rail-scroller";
import { cn } from "@/lib/utils";
import { PRODUCT_GRID_CLASS, productCardView } from "@/lib/product-card";
import type { ProductCardData } from "@/lib/queries/products";

const BADGE_LABEL = { soldOut: "Sold out", bestSeller: "Bestseller" } as const;

/**
 * The storefront product card: image-first on a warm oat surface, no box, one
 * quiet badge at most, then name → size → rating → price → Add to cart.
 * The name link is stretched over the whole card (one tab stop to the PDP);
 * wishlist, quick view and add-to-cart sit above it on their own layer.
 */
export function ProductCard({
  product,
  wishlisted,
  priority,
  showBestSellerBadge = true,
}: {
  product: ProductCardData;
  wishlisted?: boolean;
  /** LCP hint for cards likely visible above the fold (first homepage section only). */
  priority?: boolean;
  /** Off inside a "Best sellers" section, where the badge would repeat on every card. */
  showBestSellerBadge?: boolean;
}) {
  const image = product.images[0];
  const view = productCardView(product, { showBestSeller: showBestSellerBadge });

  return (
    <article
      className="pcard group relative flex h-full flex-col rounded-xl has-[.pcard-link:focus-visible]:outline-2 has-[.pcard-link:focus-visible]:outline-offset-4 has-[.pcard-link:focus-visible]:outline-ring"
      data-heat="product-card"
    >
      {/* First in the DOM, second on screen (flex order): keyboard and screen
          readers meet the product name before the image's controls. */}
      <h3 className="order-2 pt-3 font-heading text-[15px] font-medium leading-snug text-foreground sm:pt-3.5 sm:text-base">
        <Link
          href={`/products/${product.slug}`}
          className="pcard-link line-clamp-2 outline-none after:absolute after:inset-0 after:z-10 after:content-[''] group-hover:text-primary"
        >
          {product.name}
        </Link>
      </h3>
      <div className="pcard-media relative order-1 aspect-square overflow-hidden rounded-xl bg-(--pcard-media)">
        {image ? (
          <BlurImage
            src={image.url}
            alt={image.alt ?? product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
            className={cn(
              "object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]",
              view.outOfStock && "opacity-60 grayscale-[35%]",
            )}
          />
        ) : null}
        {view.badge && (
          <span
            className={cn(
              "pointer-events-none absolute left-2.5 top-2.5 z-10 rounded-md bg-background/92 px-2 py-1 text-[11px] font-medium leading-none tracking-[0.03em]",
              view.badge === "bestSeller" ? "text-primary" : "text-muted-foreground",
            )}
          >
            {BADGE_LABEL[view.badge]}
          </span>
        )}
        {/* Hover/focus-revealed on pointer devices only: on touch the whole card
            already opens the product, so a second floating control is clutter. */}
        <div className="absolute bottom-2 right-2 z-20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:hidden">
          <QuickViewButton productId={product.id} productName={product.name} wishlisted={wishlisted} />
        </div>
      </div>
      <div className="absolute right-0.5 top-0.5 z-20">
        <WishlistButton productId={product.id} initial={wishlisted} appearance="overlay" />
      </div>

      <div className="order-3 flex flex-1 flex-col">
        {(view.sizeLabel || view.lowStock) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {view.sizeLabel}
            {view.sizeLabel && view.lowStock ? " · " : null}
            {view.lowStock ? `Only ${view.lowStock} left` : null}
          </p>
        )}
        {product.ratingCount > 0 && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Star aria-hidden className="size-3.5 fill-gold text-gold" />
            <span aria-hidden>
              <span className="font-medium text-foreground">{product.ratingAvg.toFixed(1)}</span> ({product.ratingCount})
            </span>
            <span className="sr-only">
              Rated {product.ratingAvg.toFixed(1)} out of 5 from {product.ratingCount}{" "}
              {product.ratingCount === 1 ? "review" : "reviews"}
            </span>
          </p>
        )}
        <ProductPrice
          className="mt-auto pt-2.5"
          price={view.price}
          mrp={view.mrp}
          off={view.off}
          fromPrice={view.fromPrice}
        />
        <div className="relative z-20 pt-3">
          <QuickAddButton product={product} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  wishlistedIds,
  className,
  priorityCount = 0,
  showBestSellerBadge,
}: {
  products: ProductCardData[];
  wishlistedIds?: Set<string>;
  /** Override the responsive grid classes when a section needs a different density. */
  className?: string;
  /** LCP hint: eagerly load the first N card images (pass only for the section actually rendered first on the page). */
  priorityCount?: number;
  showBestSellerBadge?: boolean;
}) {
  return (
    <div className="@container">
      <div className={cn(PRODUCT_GRID_CLASS, className)}>
        {products.map((p, i) => (
          // Fade each card up as it scrolls into view (staggered per row).
          // Reveal is reduced-motion gated + passes RSC children straight through.
          <Reveal key={p.id} className="h-full" delay={(i % 5) * 40}>
            <ProductCard
              product={p}
              wishlisted={wishlistedIds?.has(p.id)}
              priority={i < priorityCount}
              showBestSellerBadge={showBestSellerBadge}
            />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/**
 * Horizontal scroll-snap rail on mobile, scroller with arrows on tablet/desktop.
 * Home sections get a browsable "carousel" vs. the catalog grid — same card.
 */
export function ProductRail({
  products,
  wishlistedIds,
  priorityCount = 0,
  showBestSellerBadge,
}: {
  products: ProductCardData[];
  wishlistedIds?: Set<string>;
  /** LCP hint: eagerly load the first N card images (pass only for the section actually rendered first on the page). */
  priorityCount?: number;
  showBestSellerBadge?: boolean;
}) {
  return (
    <>
      {/* Mobile: edge-to-edge rail; ~2.2 cards visible so the next one peeks.
          `md:hidden` lives on a wrapper: the unlayered `.scroll-rail` display:flex
          beats it on the track itself, which used to show both rails on desktop. */}
      <div className="md:hidden">
        <div className="scroll-rail -mx-4 scroll-px-4 gap-3 px-4 pb-1">
          {products.map((p, i) => (
            <div key={p.id} className="w-[44vw] max-w-[220px] shrink-0">
              <Reveal className="h-full" delay={(i % 4) * 50}>
                <ProductCard
                  product={p}
                  wishlisted={wishlistedIds?.has(p.id)}
                  priority={i < priorityCount}
                  showBestSellerBadge={showBestSellerBadge}
                />
              </Reveal>
            </div>
          ))}
        </div>
      </div>
      {/* Tablet/desktop: a real horizontal rail (hover-revealed arrows), not a
          static grid — browsing past what fits on screen is the point of a
          "rail" vs. the catalog's paginated ProductGrid. */}
      <ProductRailScroller className="hidden md:block">
        {products.map((p, i) => (
          <div
            key={p.id}
            data-rail-item
            className="w-[29vw] max-w-[250px] shrink-0 lg:w-[22vw] xl:w-[18vw] xl:max-w-[240px]"
          >
            <Reveal className="h-full" delay={(i % 5) * 40}>
              <ProductCard
                product={p}
                wishlisted={wishlistedIds?.has(p.id)}
                priority={i < priorityCount}
                showBestSellerBadge={showBestSellerBadge}
              />
            </Reveal>
          </div>
        ))}
      </ProductRailScroller>
    </>
  );
}
