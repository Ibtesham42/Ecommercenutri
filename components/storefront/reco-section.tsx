import { ProductGrid } from "@/components/storefront/product-card";
import { RecoClickArea } from "@/components/storefront/reco-click-area";
import type { ProductCardData } from "@/lib/queries/products";

/** A titled recommendation strip. Renders nothing when there are no products,
 *  so any section degrades gracefully (cold start, sparse history). `source`
 *  (when set) records RECO_CLICK analytics for click-through on this strip. */
export function RecoSection({
  title,
  subtitle,
  products,
  wishlistedIds,
  className,
  source,
}: {
  title: string;
  subtitle?: string;
  products: ProductCardData[];
  wishlistedIds?: Set<string>;
  className?: string;
  source?: string;
}) {
  if (!products || products.length === 0) return null;
  const grid = <ProductGrid products={products} wishlistedIds={wishlistedIds} />;
  return (
    <section className={className}>
      <div className="mb-6">
        <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-[1.6rem]">{title}</h2>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {source ? <RecoClickArea source={source}>{grid}</RecoClickArea> : grid}
    </section>
  );
}
