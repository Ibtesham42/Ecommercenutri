import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgePercent,
  Boxes,
  Tags,
  Truck,
  ShieldCheck,
  Headset,
  ArrowRight,
  Store,
  Warehouse,
  UtensilsCrossed,
  Building2,
} from "lucide-react";
import { B2BForm } from "@/components/storefront/b2b-form";
import { BlurImage } from "@/components/storefront/blur-image";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";
import { Reveal } from "@/components/storefront/reveal";
import { Button } from "@/components/ui/button";
import { buildMetadata, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { isConfigured } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db-retry";
import { CACHE_TAGS, cachedQuery } from "@/lib/cache";
import { isVideoUrl } from "@/lib/cld";
import { slugify } from "@/lib/format";

export const metadata: Metadata = buildMetadata({
  title: "B2B & Wholesale — Partner with Nutriyet",
  description:
    "Partner with Nutriyet for wholesale pricing, bulk orders, private-label and dedicated business support — for distributors, retailers, supermarkets, hotels, restaurants, cafés, gyms, corporates and more.",
  path: "/b2b",
});

const highlights = [
  {
    icon: BadgePercent,
    title: "Wholesale pricing",
    desc: "Tiered pricing that scales with your volume.",
  },
  {
    icon: Boxes,
    title: "Bulk orders",
    desc: "Large-quantity supply with consistent batch quality.",
  },
  {
    icon: ShieldCheck,
    title: "Quality assurance",
    desc: "Lab-tested, FSSAI-compliant, 100% natural.",
  },
  {
    icon: Headset,
    title: "Dedicated support",
    desc: "One account manager for pricing, orders and after-sales.",
  },
];

const extras = [
  {
    icon: Truck,
    title: "Fast delivery",
    desc: "Pan-India logistics with dependable lead times so your shelves stay stocked.",
  },
  {
    icon: Tags,
    title: "Custom & private label",
    desc: "Future-ready private-label and custom branding for your own retail line.",
  },
];

// Grouped from BUSINESS_TYPES (lib/b2b.ts) — the same types the form offers.
const audiences = [
  {
    icon: Store,
    title: "Retail",
    desc: "Retailers, supermarkets, nutrition stores and pharmacies.",
  },
  {
    icon: Warehouse,
    title: "Distribution",
    desc: "Distributors and wholesalers supplying their own network.",
  },
  {
    icon: UtensilsCrossed,
    title: "Hospitality",
    desc: "Hotels, restaurants and cafés.",
  },
  {
    icon: Building2,
    title: "Corporates & gyms",
    desc: "Corporate orders, gyms and fitness centres.",
  },
];

type B2BImage = { url: string; alt: string };

// Real catalog photography for the editorial slots (images only — no price or
// stock, so it's safe to data-cache; Product writes invalidate "home").
const readB2BImagery = cachedQuery(
  async (): Promise<B2BImage[]> => {
    const rows = await withDbRetry(() =>
      prisma.product.findMany({
        where: { isActive: true, images: { some: {} } },
        orderBy: [{ isFeatured: "desc" }, { isBestSeller: "desc" }, { ratingCount: "desc" }],
        take: 4,
        select: {
          name: true,
          images: {
            orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
            take: 1,
            select: { url: true, alt: true },
          },
        },
      }),
    );
    return rows.flatMap((p) =>
      p.images
        .filter((img) => !isVideoUrl(img.url))
        .map((img) => ({ url: img.url, alt: img.alt || p.name })),
    );
  },
  "b2b-imagery",
  [CACHE_TAGS.home],
);

async function getB2BImagery(): Promise<B2BImage[]> {
  try {
    return await readB2BImagery();
  } catch (err) {
    console.error("[b2b] imagery read failed", err);
    return [];
  }
}

export default async function B2BPage() {
  const [heroImage, storyImage] = await getB2BImagery();

  return (
    <div className="bg-card">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Business", path: "/b2b" },
          ]),
        )}
      />

      {/* Hero */}
      <section className="shop-container pt-6 pb-12 sm:pt-8 md:pb-16 lg:pb-20">
        <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: "Business" }]} />
        <div
          className={`mt-6 grid items-center gap-8 sm:mt-8 md:gap-10 lg:gap-16 ${
            heroImage ? "md:grid-cols-2" : ""
          }`}
        >
          <div className="max-w-xl">
            <p className="eyebrow">For businesses</p>
            <h1 className="mt-3 font-heading text-title text-foreground [overflow-wrap:anywhere]">
              Partner with Nutriyet
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground sm:text-lg">
              Wholesale pricing, bulk supply and dedicated business support for India&apos;s
              fast-growing healthy-nutrition range — for distributors, retailers, HoReCa, gyms
              and corporates.
            </p>
            <div className="mt-7 flex flex-col gap-3 min-[400px]:flex-row">
              <Button asChild className="h-12 rounded-lg px-6 text-[15px]">
                <a href="#inquiry">
                  Get a quote <ArrowRight className="size-4" aria-hidden />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-lg border-foreground/25 bg-transparent px-6 text-[15px]"
              >
                <Link href="/products">Explore products</Link>
              </Button>
            </div>
          </div>
          {heroImage && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-oat md:aspect-[5/4]">
              <BlurImage
                src={heroImage.url}
                alt={heroImage.alt}
                fill
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 600px"
                className="object-cover"
              />
            </div>
          )}
        </div>
      </section>

      {/* Highlights strip */}
      <section aria-label="Business benefits" className="border-y border-border bg-background">
        <ul className="shop-container grid grid-cols-1 py-2 sm:grid-cols-2 sm:py-6 lg:grid-cols-4 lg:py-8">
          {highlights.map((h) => (
            <li
              key={h.title}
              className="flex items-start gap-3.5 border-b border-border py-4 last:border-b-0 sm:border-b-0 sm:py-3 sm:pr-6 lg:border-l lg:px-6 lg:first:border-l-0 lg:first:pl-0"
            >
              <h.icon className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
              <div>
                <p className="text-[15px] font-medium text-foreground">{h.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{h.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Why partner */}
      <section className="shop-container shop-section">
        <Reveal
          className={`grid items-center gap-8 md:gap-12 lg:gap-20 ${
            storyImage ? "md:grid-cols-2" : ""
          }`}
        >
          {storyImage && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-oat md:aspect-square lg:aspect-[5/4]">
              <BlurImage
                src={storyImage.url}
                alt={storyImage.alt}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 600px"
                className="object-cover"
              />
            </div>
          )}
          <div className="max-w-xl">
            <p className="eyebrow">Why partner with us</p>
            <h2 className="mt-3 font-heading text-heading font-medium text-foreground">
              Rooted in tradition.
              <span className="block">Ready for business.</span>
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              Nutriyet brings together the food traditions of Bihar and Mithila with the
              convenience of modern, everyday shopping. We focus on makhana, spices and other
              pantry staples — sourced and prepared with care and labelled honestly — so the
              products you stock are ones your customers can trust.
            </p>
            <ul className="mt-8 grid gap-x-8 sm:grid-cols-2">
              {extras.map((e) => (
                <li key={e.title} className="border-t border-border py-5">
                  <e.icon className="size-5 text-terracotta" strokeWidth={1.5} aria-hidden />
                  <h3 className="mt-3 text-[15px] font-medium text-foreground">{e.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{e.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* Who we work with — informational only, deliberately not interactive. */}
      <section className="shop-container pb-14 md:pb-18 lg:pb-26">
        <div className="max-w-2xl">
          <h2 className="font-heading text-heading font-medium text-foreground">Who we work with</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Businesses of every size, across India.
          </p>
        </div>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {audiences.map((a) => (
            <li
              key={a.title}
              className="flex items-start gap-4 rounded-xl border border-border p-5 sm:flex-col sm:gap-0 sm:p-6"
            >
              <a.icon className="mt-0.5 size-5 shrink-0 text-primary sm:mt-0" strokeWidth={1.5} aria-hidden />
              <div className="sm:mt-5">
                <h3 className="text-[15px] font-medium text-foreground">{a.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{a.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Inquiry */}
      <section id="inquiry" className="scroll-mt-28 border-t border-border bg-background">
        <div className="shop-container shop-section">
          <div className="max-w-2xl">
            <p className="eyebrow">Get in touch</p>
            <h2 className="mt-3 font-heading text-heading font-medium text-foreground">
              Let&apos;s talk business
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Share a few details and our B2B team will get back to you within 24 hours with
              pricing and next steps. Fields marked <span className="text-destructive">*</span>{" "}
              are required.
            </p>
          </div>

          <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-12">
            <B2BForm cloudinaryReady={isConfigured.cloudinary()} />

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <ul className="border-t border-border text-[15px]">
                <li className="flex items-center gap-3 border-b border-border py-3.5">
                  <ShieldCheck className="size-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
                  No obligation, no spam
                </li>
                <li className="flex items-center gap-3 border-b border-border py-3.5">
                  <Headset className="size-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
                  Dedicated business support
                </li>
                <li className="flex items-center gap-3 border-b border-border py-3.5">
                  <Truck className="size-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
                  Pan-India delivery
                </li>
              </ul>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                Questions first? See our{" "}
                <Link
                  href={`/faq#${slugify("Bulk, business & gifting")}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  bulk &amp; business FAQs
                </Link>
                .
              </p>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
