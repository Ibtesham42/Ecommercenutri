import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { ProductGrid, ProductRail } from "@/components/storefront/product-card";
import { SectionHeading } from "@/components/storefront/section-heading";
import { BlurImage } from "@/components/storefront/blur-image";
import { Reveal } from "@/components/storefront/reveal";
import { StoriesRail } from "@/components/storefront/stories-rail";
import { EditorialHero } from "@/components/storefront/home/editorial-hero";
import { StoryBand } from "@/components/storefront/home/story-band";
import { JournalSection } from "@/components/storefront/home/journal-section";
import { HeroRevealOverlay } from "@/components/storefront/hero-reveal/hero-reveal-overlay";
import { Showcase3D } from "@/components/storefront/showcase-3d";
import { BannerStrip } from "@/components/storefront/banner-strip";
import { RecommendedProducts } from "@/components/storefront/recommended-products";
import { RecoClickArea } from "@/components/storefront/reco-click-area";
import { HomeHero } from "@/components/storefront/home/home-hero";
import { HomeAiBanner } from "@/components/storefront/home/home-ai-banner";
import { HomeWhyChooseUs } from "@/components/storefront/home/home-why-choose-us";
import { HomeTestimonials } from "@/components/storefront/home/home-testimonials";
import { TrustSection } from "@/components/storefront/growth/trust-section";
import { getGrowthSettings } from "@/lib/growth-settings";
import { heroRevealLive } from "@/lib/hero-reveal";
import {
  getFeaturedProducts,
  getBestSellers,
  getDealProducts,
} from "@/lib/queries/products";
import { trending, productCombos } from "@/lib/recommendations/service";
import { getCategories, getPublishedStories } from "@/lib/queries/catalog";
import {
  getActiveHeroSlides,
  heroSlideHref,
  getHomeSectionOrder,
  getHomeSectionsContent,
  getActiveShowcase,
  getHeroRevealSettings,
} from "@/lib/queries/home";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import type { HomeSectionKey } from "@/lib/home-sections";

// Personalized + catalog-driven, so render at request time. This also keeps the
// database out of the build step (it's only needed at runtime).
export const dynamic = "force-dynamic";

/** A product rail with fewer items than this reads as broken (a lone card in
 *  an empty row), so data-driven rails below it are skipped. */
const MIN_RAIL_ITEMS = 3;

export default async function HomePage() {
  // Content first so catalog sections can honor admin-set item limits.
  const content = await getHomeSectionsContent();

  const [
    featured,
    bestSellers,
    deals,
    categories,
    stories,
    heroSlides,
    sectionOrder,
    wishlistIds,
    trendingProducts,
    combos,
    showcase,
    growth,
    heroReveal,
  ] = await Promise.all([
    getFeaturedProducts(content.featured.limit ?? 8),
    getBestSellers(content.bestSellers.limit ?? 8),
    getDealProducts(content.deals.limit ?? 8),
    getCategories(),
    getPublishedStories(),
    getActiveHeroSlides(),
    getHomeSectionOrder(),
    getWishlistProductIds(),
    trending({ windowDays: 7, limit: content.trending.limit ?? 8 }),
    productCombos(content.combos.items, content.combos.limit ?? 4),
    getActiveShowcase(),
    getGrowthSettings(),
    getHeroRevealSettings(),
  ]);

  // LCP hint: eagerly load the first couple of card images in whichever
  // product section actually renders first in the admin-configured order
  // (varies — hence computed from `sectionOrder`, not hardcoded).
  const firstProductSectionKey = sectionOrder.find(
    (s) => s.enabled && (s.key === "featured" || s.key === "bestSellers"),
  )?.key;

  // Trending excludes what's already shown in featured/best-sellers above.
  const shownIds = new Set([...featured, ...bestSellers].map((p) => p.id));
  const trendingFresh = trendingProducts.filter((p) => !shownIds.has(p.id));

  // Optional "Product Reveal" packet animation overlaid on the hero slider.
  // Fully additive: when disabled (or with no packet image / no slides), the
  // slider renders bare — no wrapper, no overlay, markup identical to before.
  const revealLive = heroSlides.length > 0 && heroRevealLive(heroReveal);
  // Keep the overlay off the side the slide copy is aligned to.
  const revealSide = heroSlides.some((s) => s.textAlign === "right") ? "left" : "right";
  // The legacy static hero block owns the page <h1> when an admin enables it.
  const heroBlockOn = sectionOrder.some((s) => s.key === "hero" && s.enabled);

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

    heroSlider: (() => {
      if (heroSlides.length === 0) return null;
      return (
        <EditorialHero
          content={content.hero}
          headingAs={heroBlockOn ? "h2" : "h1"}
          showPromises={!growth.trustEnabled}
          overlay={revealLive ? <HeroRevealOverlay settings={heroReveal} side={revealSide} /> : undefined}
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
      );
    })(),

    hero: <HomeHero content={content.hero} />,

    categories: (
      <section className="shop-section mx-auto w-full max-w-7xl px-4" data-heat="categories">
        <SectionHeading
          title={content.categories.title}
          subtitle={content.categories.subtitle}
          ctaLabel={content.categories.ctaLabel}
          ctaHref={content.categories.ctaHref}
        />
        <Reveal>
          <ul className="scroll-rail -mx-4 gap-5 px-4 pb-1 sm:mx-0 sm:flex sm:flex-wrap sm:gap-x-10 sm:gap-y-8 sm:px-0">
            {categories.slice(0, content.categories.limit ?? 6).map((c) => (
              <li key={c.slug} className="w-24 shrink-0 snap-start sm:w-32">
                <Link href={`/categories/${c.slug}`} className="group flex flex-col items-center gap-3 text-center">
                  <span className="relative grid size-24 place-items-center overflow-hidden rounded-full bg-oat ring-1 ring-border transition-shadow group-hover:ring-primary/40 sm:size-32">
                    {c.image ? (
                      <BlurImage
                        src={c.image}
                        alt=""
                        fill
                        sizes="128px"
                        className="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-105"
                      />
                    ) : (
                      <span aria-hidden className="font-heading text-3xl text-oat-foreground">
                        {c.name.charAt(0)}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-medium leading-snug text-foreground group-hover:text-primary sm:text-[15px]">
                    {c.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>
    ),

    featured:
      featured.length > 0 ? (
        <section className="shop-section mx-auto w-full max-w-7xl px-4">
          <SectionHeading
            title={content.featured.title}
            subtitle={content.featured.subtitle}
            ctaLabel={content.featured.ctaLabel}
            ctaHref={content.featured.ctaHref}
          />
          <Reveal>
            <ProductGrid
              products={featured}
              wishlistedIds={wishlistIds}
              priorityCount={firstProductSectionKey === "featured" ? 2 : 0}
            />
          </Reveal>
        </section>
      ) : null,

    bestSellers:
      bestSellers.length > 0 ? (
        <section className="bg-oat">
          <div className="shop-section mx-auto w-full max-w-7xl px-4">
            <SectionHeading
              title={content.bestSellers.title}
              subtitle={content.bestSellers.subtitle}
              ctaLabel={content.bestSellers.ctaLabel}
              ctaHref={content.bestSellers.ctaHref}
            />
            <Reveal>
              <ProductRail
                products={bestSellers}
                wishlistedIds={wishlistIds}
                priorityCount={firstProductSectionKey === "bestSellers" ? 2 : 0}
                showBestSellerBadge={false}
              />
            </Reveal>
          </div>
        </section>
      ) : null,

    deals:
      deals.length >= MIN_RAIL_ITEMS ? (
        <section className="shop-section mx-auto w-full max-w-7xl px-4">
          <SectionHeading
            title={content.deals.title}
            subtitle={content.deals.subtitle}
            ctaLabel={content.deals.ctaLabel}
            ctaHref={content.deals.ctaHref}
          />
          <Reveal>
            <ProductRail products={deals} wishlistedIds={wishlistIds} />
          </Reveal>
        </section>
      ) : null,

    // Personalized when signed in; gracefully falls back to best-seller/
    // featured picks for guests (recommendedForYou's topUp()) — never gated
    // behind login, so first-time visitors still see a populated homepage.
    // RecommendedProducts renders null internally when empty, so this never
    // leaves a blank padded section behind.
    recommended: (
      <RecommendedProducts
        title={content.recommended.title}
        subtitle={content.recommended.subtitle}
        excludeProductIds={[...featured, ...bestSellers].map((p) => p.id)}
        className="shop-section mx-auto w-full max-w-7xl px-4"
      />
    ),

    trending:
      trendingFresh.length >= MIN_RAIL_ITEMS ? (
        <section className="shop-section mx-auto w-full max-w-7xl px-4">
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
        <section className="border-y border-border">
          <div className="shop-section mx-auto w-full max-w-7xl space-y-12 px-4 max-sm:space-y-9">
            <SectionHeading
              title={content.combos.title}
              subtitle={content.combos.subtitle}
            />
            {combos.map((combo) => (
              <div key={combo.key}>
                <h3 className="mb-5 font-heading text-subheading font-medium">
                  {combo.title}
                  <span className="ml-2 font-sans text-sm font-normal tracking-normal text-muted-foreground">
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

    story: <StoryBand />,

    journal: <JournalSection />,
  };

  const visible = sectionOrder.filter((s) => s.enabled && sections[s.key] != null);
  const hasStories = visible.some((s) => s.key === "stories");

  // Trust section renders right below the hero banner (or the hero slider if the
  // banner is hidden, else the first section). Admin-toggleable; always additive.
  const trustAfterKey = growth.trustEnabled
    ? visible.find((s) => s.key === "hero")?.key ??
      visible.find((s) => s.key === "heroSlider")?.key ??
      visible[0]?.key
    : null;

  const showcaseNode = showcase.enabled ? (
    <Showcase3D items={showcase.items} />
  ) : null;

  // The static "hero" block normally carries the page's one <h1>; heroSlider's
  // per-slide heading is deliberately an <h2> (every slide renders in the DOM
  // for the carousel track, so an <h1> there would duplicate per slide). When
  // "hero" is off (the default now, to avoid the stacked-hero redundancy) this
  // keeps exactly one real <h1> on the page for SEO/a11y without an extra
  // visible heading.
  const needsFallbackH1 = !visible.some((s) => s.key === "hero" || s.key === "heroSlider");

  return (
    <>
      {needsFallbackH1 && <h1 className="sr-only">Nutriyet — Eat clean. Live strong.</h1>}
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
          {s.key === trustAfterKey && <TrustSection />}
        </Fragment>
      ))}
    </>
  );
}
