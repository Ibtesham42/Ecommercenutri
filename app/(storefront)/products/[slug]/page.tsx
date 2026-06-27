import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getProductBySlug,
  getRelatedProducts,
  minVariantPrice,
} from "@/lib/queries/products";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { getPricingSettings } from "@/lib/queries/settings";
import { buildMetadata, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductPurchase } from "@/components/storefront/product-purchase";
import { NutritionFacts } from "@/components/storefront/nutrition-facts";
import { ProductReviews } from "@/components/storefront/product-reviews";
import { ProductAiAssistant } from "@/components/storefront/product-ai-assistant";
import {
  RecentlyViewed,
  RecentlyViewedTracker,
} from "@/components/storefront/recently-viewed";
import { ProductGrid } from "@/components/storefront/product-card";
import { StarRating } from "@/components/storefront/star-rating";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type NutritionFact = { label: string; value: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return buildMetadata({
    title: product.metaTitle ?? product.name,
    description:
      product.metaDescription ??
      product.shortDescription ??
      product.description.slice(0, 160),
    path: `/products/${slug}`,
    image: product.images[0]?.url,
  });
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [related, wishlistIds, pricingSettings] = await Promise.all([
    getRelatedProducts(product.id, product.categoryId),
    getWishlistProductIds(),
    getPricingSettings(),
  ]);

  const facts: NutritionFact[] = Array.isArray(product.nutritionFacts)
    ? (product.nutritionFacts as unknown as NutritionFact[])
    : [];

  const min = minVariantPrice(product.variants) ?? 0;

  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.images.map((i) => i.url),
    description: product.shortDescription ?? product.description.slice(0, 200),
    sku: product.sku ?? product.id,
    brand: { "@type": "Brand", name: product.brand?.name ?? "Nutriyet" },
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAvg.toFixed(1),
            reviewCount: product.ratingCount,
          },
        }
      : {}),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: (min / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: product.variants.some((v) => v.stock > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-8 pb-28 lg:pb-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: product.category.name, path: `/categories/${product.category.slug}` },
            { name: product.name, path: `/products/${product.slug}` },
          ]),
        )}
      />

      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/categories/${product.category.slug}`}>
                {product.category.name}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="line-clamp-1">
              {product.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery
          images={product.images.map((i) => ({ url: i.url, alt: i.alt }))}
          name={product.name}
        />

        <div className="space-y-5">
          {product.brand && (
            <p className="text-sm font-medium text-muted-foreground">
              {product.brand.name}
            </p>
          )}
          <h1 className="text-2xl font-bold sm:text-3xl">{product.name}</h1>
          {product.ratingCount > 0 && (
            <StarRating
              rating={product.ratingAvg}
              count={product.ratingCount}
              size="md"
            />
          )}
          {product.shortDescription && (
            <p className="text-muted-foreground">{product.shortDescription}</p>
          )}

          <ProductPurchase
            productId={product.id}
            slug={product.slug}
            name={product.name}
            image={product.images[0]?.url ?? null}
            variants={product.variants.map((v) => ({
              id: v.id,
              weightLabel: v.weightLabel,
              price: v.price,
              discountPrice: v.discountPrice,
              stock: v.stock,
            }))}
            wishlisted={wishlistIds.has(product.id)}
            highlights={facts.slice(0, 3)}
            gstRate={product.gstRate}
            deliveryCharge={product.deliveryCharge}
            settings={pricingSettings}
          />

          <ProductAiAssistant productId={product.id} productName={product.name} />
        </div>
      </div>

      {/* Details tabs */}
      <div className="mt-12 grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="description">
            <TabsList>
              <TabsTrigger value="description">Description</TabsTrigger>
              {product.benefits && (
                <TabsTrigger value="benefits">Benefits</TabsTrigger>
              )}
              {product.ingredients && (
                <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
              )}
            </TabsList>
            <TabsContent
              value="description"
              className="prose prose-sm max-w-none pt-4 text-muted-foreground"
            >
              <p className="whitespace-pre-line">{product.description}</p>
            </TabsContent>
            {product.benefits && (
              <TabsContent value="benefits" className="pt-4 text-muted-foreground">
                <p className="whitespace-pre-line">{product.benefits}</p>
              </TabsContent>
            )}
            {product.ingredients && (
              <TabsContent
                value="ingredients"
                className="pt-4 text-muted-foreground"
              >
                <p className="whitespace-pre-line">{product.ingredients}</p>
              </TabsContent>
            )}
          </Tabs>
        </div>
        <div>{facts.length > 0 && <NutritionFacts facts={facts} />}</div>
      </div>

      {/* Reviews */}
      <ProductReviews
        productId={product.id}
        slug={product.slug}
        ratingAvg={product.ratingAvg}
        ratingCount={product.ratingCount}
        reviews={product.reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          title: r.title,
          comment: r.comment,
          createdAt: r.createdAt.toISOString(),
          userName: r.user.name,
          userImage: r.user.image,
        }))}
      />

      {/* Related (similar products) */}
      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-6 text-xl font-bold">You may also like</h2>
          <ProductGrid products={related} wishlistedIds={wishlistIds} />
        </section>
      )}

      {/* Recently viewed */}
      <div className="mt-14">
        <RecentlyViewed excludeSlug={product.slug} />
      </div>

      <RecentlyViewedTracker
        item={{
          slug: product.slug,
          name: product.name,
          image: product.images[0]?.url ?? null,
          price: min || null,
        }}
      />
    </div>
  );
}
