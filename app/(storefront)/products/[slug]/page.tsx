import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getProductBySlug,
  minVariantPrice,
} from "@/lib/queries/products";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { getPricingSettings } from "@/lib/queries/settings";
import { effectivePrice } from "@/lib/format";
import { env } from "@/lib/env";
import {
  similarProducts,
  frequentlyBoughtTogether,
  customersAlsoBought,
} from "@/lib/recommendations/service";
import { buildMetadata, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductPurchase } from "@/components/storefront/product-purchase";
import {
  VariantSelectionProvider,
  VariantDescription,
  VariantNutritionImage,
} from "@/components/storefront/variant-selection";
import { ShareButtons } from "@/components/storefront/share-buttons";
import { NutritionFacts } from "@/components/storefront/nutrition-facts";
import { ProductReviews } from "@/components/storefront/product-reviews";
import { ProductAiAssistant } from "@/components/storefront/product-ai-assistant";
import {
  RecentlyViewed,
  RecentlyViewedTracker,
} from "@/components/storefront/recently-viewed";
import { RecoSection } from "@/components/storefront/reco-section";
import { FrequentlyBoughtTogether } from "@/components/storefront/frequently-bought-together";
import { BehaviorTracker } from "@/components/storefront/behavior-tracker";
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

  const [similar, fbt, alsoBought, wishlistIds, pricingSettings] = await Promise.all([
    similarProducts(product.id),
    frequentlyBoughtTogether(product.id),
    customersAlsoBought(product.id),
    getWishlistProductIds(),
    getPricingSettings(),
  ]);

  const facts: NutritionFact[] = Array.isArray(product.nutritionFacts)
    ? (product.nutritionFacts as unknown as NutritionFact[])
    : [];

  const min = minVariantPrice(product.variants) ?? 0;
  const max = product.variants.length
    ? Math.max(...product.variants.map((v) => effectivePrice(v.price, v.discountPrice)))
    : min;
  const inStock = product.variants.some((v) => v.stock > 0);
  const productUrl = `${env.appUrl}/products/${product.slug}`;
  // Google recommends a priceValidUntil; a rolling ~30-day window keeps offers
  // "fresh" for rich results without implying a fixed sale end.
  const priceValidUntil = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  // Individual review nodes broaden review rich-result eligibility (real,
  // approved customer reviews only — never fabricated). Capped for a lean blob.
  const reviewNodes = product.reviews.slice(0, 12).map((r) => ({
    "@type": "Review",
    reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    author: { "@type": "Person", name: r.user?.name ?? "Verified buyer" },
    datePublished: r.createdAt.toISOString().slice(0, 10),
    ...(r.title ? { name: r.title } : {}),
    ...(r.comment ? { reviewBody: r.comment } : {}),
  }));

  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.images.map((i) => i.url),
    description: product.shortDescription ?? product.description.slice(0, 200),
    sku: product.sku ?? product.id,
    brand: { "@type": "Brand", name: product.brand?.name ?? "Nutriyet" },
    ...(product.category ? { category: product.category.name } : {}),
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAvg.toFixed(1),
            reviewCount: product.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(reviewNodes.length > 0 ? { review: reviewNodes } : {}),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: (min / 100).toFixed(2),
      highPrice: (max / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      priceValidUntil,
      url: productUrl,
    },
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-8 pb-28 lg:pb-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(jsonLdData)}
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

      {/* One shared variant selection: picking a weight switches the gallery,
          price panel, description and nutrition image together — no reload. */}
      <VariantSelectionProvider
        initialId={
          (product.variants.find((v) => v.stock > 0) ?? product.variants[0])?.id ?? null
        }
      >
      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery
          images={product.images.map((i) => ({ url: i.url, alt: i.alt }))}
          name={product.name}
          variantMedia={product.variants.map((v) => ({ id: v.id, images: v.images }))}
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
              sku: v.sku,
              badge: v.badge,
              images: v.images,
            }))}
            wishlisted={wishlistIds.has(product.id)}
            highlights={facts.slice(0, 3)}
            gstRate={product.gstRate}
            deliveryCharge={product.deliveryCharge}
            settings={pricingSettings}
          />

          <ProductAiAssistant productId={product.id} productName={product.name} />

          {/* Share — WhatsApp-first product discovery (dominant in India). */}
          <div className="border-t pt-4">
            <ShareButtons
              url={productUrl}
              title={product.name}
              image={product.images[0]?.url ?? null}
            />
          </div>
        </div>
      </div>

      {/* Details tabs */}
      <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:gap-10">
        <div className="rounded-2xl border bg-card p-5 shadow-elev-1 sm:p-6 lg:col-span-2">
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
              <VariantDescription
                fallback={product.description}
                variants={product.variants.map((v) => ({
                  id: v.id,
                  description: v.description,
                }))}
              />
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
        <div className="space-y-6">
          {facts.length > 0 && <NutritionFacts facts={facts} />}
          <VariantNutritionImage
            variants={product.variants.map((v) => ({
              id: v.id,
              nutritionImageUrl: v.nutritionImageUrl,
            }))}
            name={product.name}
          />
        </div>
      </div>
      </VariantSelectionProvider>

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

      {/* Frequently bought together — interactive one-tap bundle (AOV). Falls
          back to a passive strip when there aren't ≥2 in-stock companions. */}
      {fbt.length >= 2 ? (
        <FrequentlyBoughtTogether className="mt-14" products={fbt} />
      ) : (
        <RecoSection
          className="mt-14"
          title="Frequently bought together"
          products={fbt}
          wishlistedIds={wishlistIds}
          source="fbt"
        />
      )}

      {/* Customers also bought */}
      <RecoSection
        className="mt-14"
        title="Customers also bought"
        products={alsoBought}
        wishlistedIds={wishlistIds}
        source="also-bought"
      />

      {/* Similar products */}
      <RecoSection
        className="mt-14"
        title="Similar products"
        products={similar}
        wishlistedIds={wishlistIds}
        source="similar"
      />

      {/* Recently viewed */}
      <div className="mt-14">
        <RecentlyViewed excludeSlug={product.slug} />
      </div>

      <BehaviorTracker
        event={{
          type: "PRODUCT_VIEW",
          productId: product.id,
          categoryId: product.categoryId,
        }}
      />

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
