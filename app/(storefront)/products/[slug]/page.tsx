import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProductBySlug,
  minVariantPrice,
} from "@/lib/queries/products";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { getPricingSettings } from "@/lib/queries/settings";
import { effectivePrice } from "@/lib/format";
import { env } from "@/lib/env";
import { cloudinaryEnabled } from "@/lib/cloudinary";
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
import { ProductDetails } from "@/components/storefront/product-details";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";

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

  const hasNutrition =
    facts.length > 0 || product.variants.some((v) => Boolean(v.nutritionImageUrl));

  return (
    // Bottom padding keeps the mobile sticky buy bar off the last section.
    <div className="shop-container pt-5 pb-28 sm:pt-7 lg:pb-24">
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

      <PageBreadcrumb
        items={[
          { name: "Home", href: "/" },
          { name: "Shop", href: "/products" },
          { name: product.category.name, href: `/categories/${product.category.slug}` },
          { name: product.name },
        ]}
      />

      {/* One shared variant selection: picking a weight switches the gallery,
          price panel, description and nutrition image together — no reload. */}
      <VariantSelectionProvider
        initialId={
          (product.variants.find((v) => v.stock > 0) ?? product.variants[0])?.id ?? null
        }
      >
      <div className="mt-5 sm:mt-7 md:grid md:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] md:items-start md:gap-8 lg:gap-14 xl:gap-20">
        <ProductGallery
          images={product.images.map((i) => ({ url: i.url, alt: i.alt }))}
          name={product.name}
          variantMedia={product.variants.map((v) => ({ id: v.id, images: v.images }))}
        />

        <div className="mt-6 min-w-0 md:mt-0">
          <p className="eyebrow">
            {product.brand && product.brand.name !== "Nutriyet"
              ? `${product.brand.name} · ${product.category.name}`
              : product.category.name}
          </p>
          <h1 className="mt-2.5 font-heading text-[1.75rem] leading-[1.12] tracking-[-0.015em] text-foreground sm:text-[2.125rem] lg:text-[2.5rem]">
            {product.name}
          </h1>
          {product.ratingCount > 0 && (
            <a
              href="#reviews"
              className="mt-3 inline-flex min-h-8 items-center rounded-sm outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <StarRating rating={product.ratingAvg} count={product.ratingCount} size="md" />
            </a>
          )}
          {product.shortDescription && (
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              {product.shortDescription}
            </p>
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

          <div className="mt-8">
            <ProductAiAssistant productId={product.id} productName={product.name} />
          </div>

          {/* Share — WhatsApp-first product discovery (dominant in India). */}
          <div className="mt-5">
            <ShareButtons
              url={productUrl}
              title={product.name}
              image={product.images[0]?.url ?? null}
            />
          </div>
        </div>
      </div>

      <ProductDetails
        name={product.name}
        description={
          <VariantDescription
            fallback={product.description}
            variants={product.variants.map((v) => ({
              id: v.id,
              description: v.description,
            }))}
          />
        }
        benefits={product.benefits}
        ingredients={product.ingredients}
        nutrition={
          hasNutrition ? (
            <>
              {facts.length > 0 && <NutritionFacts facts={facts} />}
              <VariantNutritionImage
                variants={product.variants.map((v) => ({
                  id: v.id,
                  nutritionImageUrl: v.nutritionImageUrl,
                }))}
                name={product.name}
              />
            </>
          ) : null
        }
      />
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
          images: r.images,
          verifiedPurchase: r.verifiedPurchase,
        }))}
        cloudinaryReady={cloudinaryEnabled}
      />

      {/* Frequently bought together — interactive one-tap bundle (AOV). Falls
          back to a passive strip when there aren't ≥2 in-stock companions. */}
      {fbt.length >= 2 ? (
        <FrequentlyBoughtTogether className="mt-16 lg:mt-24" products={fbt} />
      ) : (
        <RecoSection
          className="mt-16 lg:mt-24"
          title="Frequently bought together"
          products={fbt}
          wishlistedIds={wishlistIds}
          source="fbt"
        />
      )}

      {/* Customers also bought */}
      <RecoSection
        className="mt-16 lg:mt-24"
        title="Customers also bought"
        products={alsoBought}
        wishlistedIds={wishlistIds}
        source="also-bought"
      />

      {/* Similar products */}
      <RecoSection
        className="mt-16 lg:mt-24"
        title="Similar products"
        products={similar}
        wishlistedIds={wishlistIds}
        source="similar"
      />

      {/* Recently viewed */}
      <div className="mt-16 lg:mt-24">
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
