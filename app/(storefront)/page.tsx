import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles, Leaf, ShieldCheck, Truck, HeartPulse, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProductGrid } from "@/components/storefront/product-card";
import { StoriesRail } from "@/components/storefront/stories-rail";
import { RecommendedProducts } from "@/components/storefront/recommended-products";
import {
  getFeaturedProducts,
  getBestSellers,
} from "@/lib/queries/products";
import { getCategories, getPublishedStories } from "@/lib/queries/catalog";
import { getWishlistProductIds } from "@/lib/queries/wishlist";
import { getCurrentUser } from "@/lib/auth";

// Personalized + catalog-driven, so render at request time. This also keeps the
// database out of the build step (it's only needed at runtime).
export const dynamic = "force-dynamic";

const valueProps = [
  { icon: Leaf, title: "100% Natural", desc: "Clean-label products with no artificial preservatives." },
  { icon: ShieldCheck, title: "Lab Tested", desc: "Every batch quality-checked for purity and nutrition." },
  { icon: Truck, title: "Fast Delivery", desc: "Freshly packed and shipped with care across India." },
  { icon: HeartPulse, title: "AI Nutrition Expert", desc: "Personalized guidance for what your body needs." },
];

const testimonials = [
  { name: "Aisha K.", text: "The makhana is unbelievably fresh and crunchy. My go-to evening snack now!", rating: 5 },
  { name: "Rohan M.", text: "Loved the AI assistant — it suggested the perfect protein for my goals.", rating: 5 },
  { name: "Sneha P.", text: "Premium quality dry fruits at fair prices. Fast delivery too.", rating: 5 },
];

export default async function HomePage() {
  const [featured, bestSellers, categories, stories, wishlistIds, user] =
    await Promise.all([
      getFeaturedProducts(8),
      getBestSellers(8),
      getCategories(),
      getPublishedStories(),
      getWishlistProductIds(),
      getCurrentUser(),
    ]);

  return (
    <>
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

      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-accent/40 via-background to-background">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="space-y-6">
            <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
              <Sparkles className="size-3.5" />
              AI-powered nutrition marketplace
            </Badge>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Eat clean. <span className="text-primary">Live strong.</span>
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
              Premium makhana, dry fruits, seeds, protein and wellness
              essentials — handpicked for your health and guided by your own AI
              nutrition expert.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link href="/products">
                  Shop Now <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link href="/assistant">
                  <Sparkles className="size-4" /> Ask the AI Expert
                </Link>
              </Button>
            </div>
            <div className="flex gap-8 pt-4">
              <Stat value="10k+" label="Happy customers" />
              <Stat value={`${categories.length}+`} label="Categories" />
              <Stat value="4.8★" label="Average rating" />
            </div>
          </div>

          <div className="relative hidden md:block">
            <div className="aspect-square w-full rounded-3xl bg-gradient-to-br from-primary/15 via-accent to-secondary p-1.5 shadow-xl">
              <div className="grid size-full place-items-center rounded-[calc(var(--radius)*2)] bg-card">
                <div className="flex flex-col items-center gap-4 p-8 text-center">
                  <span className="grid size-24 place-items-center rounded-full bg-primary/10 text-primary">
                    <Leaf className="size-12" />
                  </span>
                  <p className="font-heading text-xl font-bold">
                    Nutrition, reimagined
                  </p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Wholesome foods, lab-tested quality, delivered fresh.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-7xl px-4 py-14">
        <SectionHeading
          title="Shop by category"
          subtitle="Find exactly what your body craves."
          href="/categories"
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {categories.slice(0, 6).map((c) => (
            <Link key={c.slug} href={`/categories/${c.slug}`}>
              <Card className="group overflow-hidden p-0 transition-all hover:border-primary/40 hover:shadow-md">
                <div className="relative aspect-square bg-accent/30">
                  {c.image && (
                    <Image
                      src={c.image}
                      alt={c.name}
                      fill
                      sizes="(max-width: 768px) 33vw, 16vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="p-3 text-center text-sm font-medium">{c.name}</div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 py-6">
          <SectionHeading
            title="Featured products"
            subtitle="Handpicked favorites we think you'll love."
            href="/products"
          />
          <ProductGrid products={featured} wishlistedIds={wishlistIds} />
        </section>
      )}

      {/* Best sellers */}
      {bestSellers.length > 0 && (
        <section className="border-y bg-muted/30">
          <div className="mx-auto w-full max-w-7xl px-4 py-14">
            <SectionHeading
              title="Best sellers"
              subtitle="What everyone's adding to cart."
              href="/products?sort=best-sellers"
            />
            <ProductGrid products={bestSellers} wishlistedIds={wishlistIds} />
          </div>
        </section>
      )}

      {/* Personalized recommendations (logged-in only) */}
      {user && (
        <section className="mx-auto w-full max-w-7xl px-4 py-14">
          <RecommendedProducts
            title="Recommended for you"
            subtitle="Picked from your wishlist and past orders."
            excludeProductIds={[...featured, ...bestSellers].map((p) => p.id)}
          />
        </section>
      )}

      {/* Why choose */}
      <section className="mx-auto w-full max-w-7xl px-4 py-14">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Why choose Nutriyet</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            We obsess over quality so you can focus on feeling your best.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {valueProps.map((vp) => (
            <Card key={vp.title} className="h-full">
              <CardContent className="space-y-3 p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <vp.icon className="size-6" />
                </span>
                <h3 className="font-semibold">{vp.title}</h3>
                <p className="text-sm text-muted-foreground">{vp.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-14">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">Loved by thousands</h2>
            <p className="mt-2 text-muted-foreground">
              Real words from the Nutriyet community.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {testimonials.map((t) => (
              <Card key={t.name} className="h-full">
                <CardContent className="space-y-3 p-6">
                  <div className="flex">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">“{t.text}”</p>
                  <p className="text-sm font-semibold">{t.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI banner */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-12 text-primary-foreground sm:px-12">
          <div className="relative z-10 max-w-2xl space-y-4">
            <Badge className="gap-1.5 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/20">
              <Sparkles className="size-3.5" /> Powered by Groq AI
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Not sure what to buy? Ask our AI nutrition expert.
            </h2>
            <p className="text-primary-foreground/80">
              &ldquo;What is makhana?&rdquo; · &ldquo;Best foods for weight
              loss?&rdquo; · &ldquo;Compare almonds and cashews&rdquo; — get
              instant, science-backed answers grounded in our catalog.
            </p>
            <Button asChild size="lg" variant="secondary" className="gap-2">
              <Link href="/assistant">
                Start chatting <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <Sparkles className="absolute -right-6 -top-6 size-48 opacity-10" />
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-heading text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle?: string;
  href?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between">
      <div>
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      </div>
      {href && (
        <Button asChild variant="ghost" className="gap-1">
          <Link href={href}>
            View all <ArrowRight className="size-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}
