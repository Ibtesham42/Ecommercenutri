import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Truck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductGrid, ProductRail } from "@/components/storefront/product-card";
import { BlurImage } from "@/components/storefront/blur-image";
import { Reveal } from "@/components/storefront/reveal";
import { StoriesRail } from "@/components/storefront/stories-rail";
import { HeroSlider } from "@/components/storefront/hero-slider";
import { Showcase3D } from "@/components/storefront/showcase-3d";
import { BannerStrip } from "@/components/storefront/banner-strip";
import { RecommendedProducts } from "@/components/storefront/recommended-products";
import { RecoClickArea } from "@/components/storefront/reco-click-area";
import { HomeHero } from "@/components/storefront/home/home-hero";
import { HomeAiBanner } from "@/components/storefront/home/home-ai-banner";
import { HomeWhyChooseUs } from "@/components/storefront/home/home-why-choose-us";
import { HomeTestimonials } from "@/components/storefront/home/home-testimonials";
import {
  getFeaturedProducts,
  getBestSellers,
} from "@/lib/queries/products";
import { trending, productCombos } from "@/lib/recommendations/service";
import { getCategories, getPublishedStories } from "@/lib/queries/catalog";
import {
  getActiveHeroSlides,
  heroSlideHref,
  getHomeSectionOrder,
  getHomeSectionsContent,
  getActiveShowcase,
} from "@/lib/queries/home";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { getCurrentUser } from "@/lib/auth";
import type { HomeSectionKey } from "@/lib/home-sections";

// Personalized + catalog-driven, so render at request time. This also keeps the
// database out of the build step (it's only needed at runtime).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Content first so catalog sections can honor admin-set item limits.
  const content = await getHomeSectionsContent();

  const [
    featured,
    bestSellers,
    categories,
    stories,
    heroSlides,
    sectionOrder,
    wishlistIds,
    user,
    trendingProducts,
    combos,
    showcase,
  ] = await Promise.all([
    getFeaturedProducts(content.featured.limit ?? 8),
    getBestSellers(content.bestSellers.limit ?? 8),
    getCategories(),
    getPublishedStories(),
    getActiveHeroSlides(),
    getHomeSectionOrder(),
    getWishlistProductIds(),
    getCurrentUser(),
    trending({ windowDays: 7, limit: content.trending.limit ?? 8 }),
    productCombos(content.combos.limit ?? 4),
    getActiveShowcase(),
  ]);

  // Trending excludes what's already shown in featured/best-sellers above.
  const shownIds = new Set([...featured, ...bestSellers].map((p) => p.id));
  const trendingFresh = trendingProducts.filter((p) => !shownIds.has(p.id));

  // Each homepage section keyed for the admin Section Builder. Content comes from
  // the editable defaults (lib/home-content.ts) merged with admin edits, so the
  // page is unchanged until customized. A `null` value (data condition unmet) is
  // skipped even when the section is enabled.
  const sections: Record<HomeSectionKey, ReactNode> = {
    stories: (
      <StoriesRail
        stories={stories.map((s) => ({
          id: s.id,
          title: s.title,
          coverImage: s.coverImage,
          mediaUrl: s.mediaUrl,
          mediaType: s.mediaType,
          ctaText: s.ctaText,
          product: s.product,
        }))}
      />
    ),

    heroSlider:
      heroSlides.length > 0 ? (
        <HeroSlider
          slides={heroSlides.map((s) => ({
            id: s.id,
            mediaType: s.mediaType,
            videoUrl: s.videoUrl,
            videoPoster: s.videoPoster,
            videoQuality: s.videoQuality,
            title: s.title,
            subtitle: s.subtitle,
            description: s.description,
            desktopImage: s.desktopImage,
            mobileImage: s.mobileImage,
            ctaText: s.ctaText,
            overlay: s.overlay,
            buttonColor: s.buttonColor,
            textAlign: s.textAlign,
            href: heroSlideHref(s),
          }))}
        />
      ) : null,

    hero: <HomeHero content={content.hero} />,

    categories: (
      <section className="mx-auto w-full max-w-7xl px-4 py-14">
        <SectionHeading
          title={content.categories.title}
          subtitle={content.categories.subtitle}
          ctaLabel={content.categories.ctaLabel}
          ctaHref={content.categories.ctaHref}
        />
        <Reveal className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {categories.slice(0, content.categories.limit ?? 6).map((c) => (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="hover-lift group relative block aspect-square overflow-hidden rounded-2xl border bg-accent/30 shadow-elev-1 hover:shadow-elev-2"
            >
              {c.image && (
                <BlurImage
                  src={c.image}
                  alt={c.name}
                  fill
                  sizes="(max-width: 768px) 33vw, 16vw"
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-3 text-center text-sm font-semibold text-white drop-shadow">
                {c.name}
              </span>
            </Link>
          ))}
        </Reveal>
      </section>
    ),

    featured:
      featured.length > 0 ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-6">
          <SectionHeading
            title={content.featured.title}
            subtitle={content.featured.subtitle}
            ctaLabel={content.featured.ctaLabel}
            ctaHref={content.featured.ctaHref}
          />
          <Reveal>
            <ProductGrid products={featured} wishlistedIds={wishlistIds} />
          </Reveal>
          <PromoStrip />
        </section>
      ) : null,

    bestSellers:
      bestSellers.length > 0 ? (
        <section className="border-y bg-muted/30">
          <div className="mx-auto w-full max-w-7xl px-4 py-14">
            <SectionHeading
              title={content.bestSellers.title}
              subtitle={content.bestSellers.subtitle}
              ctaLabel={content.bestSellers.ctaLabel}
              ctaHref={content.bestSellers.ctaHref}
            />
            <Reveal>
              <ProductRail products={bestSellers} wishlistedIds={wishlistIds} />
            </Reveal>
          </div>
        </section>
      ) : null,

    recommended: user ? (
      <section className="mx-auto w-full max-w-7xl px-4 py-14">
        <RecommendedProducts
          title={content.recommended.title}
          subtitle={content.recommended.subtitle}
          excludeProductIds={[...featured, ...bestSellers].map((p) => p.id)}
        />
      </section>
    ) : null,

    trending:
      trendingFresh.length > 0 ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-14">
          <SectionHeading
            title={content.trending.title}
            subtitle={content.trending.subtitle}
          />
          <Reveal>
            <RecoClickArea source="trending">
              <ProductRail products={trendingFresh} wishlistedIds={wishlistIds} />
            </RecoClickArea>
          </Reveal>
        </section>
      ) : null,

    combos:
      combos.length > 0 ? (
        <section className="border-y bg-muted/30">
          <div className="mx-auto w-full max-w-7xl space-y-12 px-4 py-14">
            <SectionHeading
              title={content.combos.title}
              subtitle={content.combos.subtitle}
            />
            {combos.map((combo) => (
              <div key={combo.key}>
                <h3 className="mb-5 text-lg font-bold sm:text-xl">
                  {combo.title}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {combo.description}
                  </span>
                </h3>
                <Reveal>
                  <RecoClickArea source={`combo:${combo.key}`}>
                    <ProductGrid products={combo.products} wishlistedIds={wishlistIds} />
                  </RecoClickArea>
                </Reveal>
              </div>
            ))}
          </div>
        </section>
      ) : null,

    whyChooseUs: <HomeWhyChooseUs content={content.whyChooseUs} />,

    testimonials: <HomeTestimonials content={content.testimonials} />,

    aiBanner: <HomeAiBanner content={content.aiBanner} />,
  };

  const visible = sectionOrder.filter((s) => s.enabled && sections[s.key] != null);
  const hasStories = visible.some((s) => s.key === "stories");

  const showcaseNode = showcase.enabled ? (
    <Showcase3D items={showcase.items} />
  ) : null;

  return (
    <>
      {/* When stories are hidden, the showcase + banner sit at the top. */}
      {!hasStories && (
        <>
          {showcaseNode}
          <BannerStrip position="homeTop" fullBleed className="py-6" />
        </>
      )}
      {visible.map((s) => (
        <Fragment key={s.key}>
          {sections[s.key]}
          {/* Stories stay on top; the 3D showcase sits right below them. */}
          {s.key === "stories" && showcaseNode}
          {s.key === "stories" && <BannerStrip position="homeTop" fullBleed className="py-6" />}
        </Fragment>
      ))}
    </>
  );
}

/** Presentational promo tiles (free shipping + AI expert) — reference-style. */
function PromoStrip() {
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2">
      <div className="flex items-center gap-3 rounded-2xl border bg-accent/40 p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Truck className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">Free shipping</p>
          <p className="text-xs text-muted-foreground">On orders over ₹499</p>
        </div>
      </div>
      <Link
        href="/assistant"
        className="hover-lift flex items-center gap-3 rounded-2xl bg-surface-deep p-4 text-surface-deep-foreground shadow-elev-1"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-gold">
          <Sparkles className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">Ask the AI expert</p>
          <p className="text-xs text-surface-deep-foreground/70">
            Not sure what to buy? Get picks →
          </p>
        </div>
      </Link>
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <span className="mb-2.5 block h-1 w-10 rounded-full bg-gradient-to-r from-primary to-gold" />
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {ctaHref && ctaLabel && (
        <Button asChild variant="ghost" className="shrink-0 gap-1 text-primary hover:text-primary">
          <Link href={ctaHref}>
            {ctaLabel} <ArrowRight className="size-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}
