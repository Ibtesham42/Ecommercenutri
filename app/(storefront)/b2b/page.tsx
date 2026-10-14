import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Mail, MapPin, MessageCircle, Phone, Plus } from "lucide-react";
import { B2BForm } from "@/components/storefront/b2b-form";
import { BlurImage } from "@/components/storefront/blur-image";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { buildMetadata, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { isConfigured } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db-retry";
import { CACHE_TAGS, cachedQuery } from "@/lib/cache";
import { isVideoUrl } from "@/lib/cld";
import { getStoreSettings } from "@/lib/queries/settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = buildMetadata({
  title: "B2B & Wholesale — Partner with Nutriyet",
  description:
    "Partner with Nutriyet for bulk orders, wholesale pricing and dedicated business support — for distributors, retailers, supermarkets, hotels, restaurants, cafés, gyms, institutions and corporates.",
  path: "/b2b",
});

// Every line on this page is either brand copy (the Website Structure brief) or
// live data — no invented stats, tiers, prices or testimonials.

/** Supporting trust points from the brand brief. */
const TRUST_POINTS = [
  "Authentic ingredients",
  "Thoughtful processing",
  "Small-batch approach",
  "No added preservatives where applicable",
  "Carefully packed",
  "Dedicated customer care",
];

/** BUSINESS_TYPES (lib/b2b.ts — the form's own list) + institutions from the brief. */
const AUDIENCES = [
  "Distributors",
  "Wholesalers",
  "Retailers",
  "Supermarkets",
  "Hotels",
  "Restaurants",
  "Cafés",
  "Corporates",
  "Nutrition stores",
  "Gyms",
  "Pharmacies",
  "Institutions",
];

/** What a quote is built from — the brief's enquiry fields, not price tiers. */
const QUOTE_FACTORS = [
  {
    label: "Products",
    title: "What you need",
    points: [
      "One product or a mixed range",
      "Any item from our current catalogue",
      "Tell us your estimated quantity",
    ],
  },
  {
    label: "Packaging",
    title: "How it's packed",
    points: [
      "Our standard retail packs",
      "Tell us your preferred packaging",
      "Gift boxes for corporate orders",
    ],
    featured: true,
  },
  {
    label: "Frequency",
    title: "How often",
    points: ["One-time order", "Monthly or quarterly", "Regular supply — or to be discussed"],
  },
];

/** "The Nutriyet Quality Journey" — verbatim from the brand brief. */
const QUALITY_JOURNEY = [
  ["Ingredient selection", "We select ingredients appropriate for the individual product."],
  ["Responsible processing", "Different foods require different processing approaches."],
  [
    "Quality checks",
    "Depending on the product: appearance, aroma, texture, taste, packaging integrity, batch information and specifications.",
  ],
  ["Hygienic packaging", "Packaging is selected to help protect the product during storage and delivery."],
  ["Batch & date information", "Applicable product information is provided on the packaging."],
  ["Storage & delivery", "We aim to maintain appropriate handling and storage throughout fulfilment."],
];

const STEPS = [
  ["Tell us what you need", "Share your business, the products you're interested in, quantities and packaging."],
  ["We review it", "Our team reviews the requirements you've shared — a business card upload helps us move faster."],
  ["Pricing & next steps", "We get back to you within 24 hours with pricing and next steps for your order."],
  ["Supply & support", "One point of contact for orders, delivery and after-sales — across India."],
];

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "How can I place a bulk order?",
    a: "Submit an enquiry using the form on this page — our team will get back to you about pricing, quantities and fulfilment.",
  },
  {
    q: "Do you publish a wholesale price list?",
    a: "Not a fixed one. Pricing depends on the products, quantities, packaging and how often you order, so every business gets a quote prepared for their requirement.",
  },
  {
    q: "How can I become a distributor?",
    a: "Submit your details through the form and choose “Distributor Partnership” as your purpose — our team will review and get in touch about territory, terms and product range.",
  },
  {
    q: "Do you offer corporate gifting?",
    a: (
      <>
        Yes — see our{" "}
        <Link href="/corporate-gifting" className="font-medium text-primary underline-offset-4 hover:underline">
          Corporate Gifting
        </Link>{" "}
        page, or send a business enquiry here with your requirements.
      </>
    ),
  },
  {
    q: "Can I share my business card instead of typing everything?",
    a: "Yes. Upload a photo of your visiting or business card in the form and our team can use it to understand your enquiry faster.",
  },
  {
    q: "Do you deliver across India?",
    a: "Yes — we deliver pan-India. Delivery timelines for bulk orders are confirmed with your quote.",
  },
];

type SourceCategory = { name: string; slug: string; image: string | null; count: number };
type Range = { productCount: number; categories: SourceCategory[] };

// Live catalogue shape (names, counts, images — no price or stock, no Dates),
// safe to data-cache; category/product writes invalidate it.
const readRange = cachedQuery(
  async (): Promise<Range> => {
    const [productCount, categories] = await withDbRetry(() =>
      Promise.all([
        prisma.product.count({ where: { isActive: true } }),
        prisma.category.findMany({
          where: { isActive: true, parentId: null },
          orderBy: { sortOrder: "asc" },
          select: {
            name: true,
            slug: true,
            image: true,
            _count: { select: { products: { where: { isActive: true } } } },
            products: {
              where: { isActive: true, images: { some: {} } },
              orderBy: [{ isBestSeller: "desc" }, { ratingCount: "desc" }],
              take: 1,
              select: {
                images: {
                  orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
                  take: 1,
                  select: { url: true },
                },
              },
            },
          },
        }),
      ]),
    );
    return {
      productCount,
      categories: categories
        .filter((c) => c._count.products > 0)
        .map((c) => {
          const productImage = c.products[0]?.images[0]?.url ?? null;
          const image = c.image ?? (productImage && !isVideoUrl(productImage) ? productImage : null);
          return { name: c.name, slug: c.slug, image, count: c._count.products };
        }),
    };
  },
  "b2b-range",
  [CACHE_TAGS.home, CACHE_TAGS.categories],
);

async function getRange(): Promise<Range> {
  try {
    return await readRange();
  } catch (err) {
    console.error("[b2b] range read failed", err);
    return { productCount: 0, categories: [] };
  }
}

/** Section frame: full-bleed band, editorial-width column. */
function Section({
  id,
  tone = "ground",
  className,
  children,
}: {
  id?: string;
  tone?: "ground" | "card" | "deep";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        tone === "card" && "border-y border-border bg-card",
        tone === "deep" && "bg-surface-deep text-surface-deep-foreground",
        className,
      )}
    >
      <div className="shop-container py-14 md:py-16 lg:py-20">
        <div className="mx-auto max-w-5xl">{children}</div>
      </div>
    </section>
  );
}

function SectionHead({
  label,
  title,
  lead,
  onDeep = false,
}: {
  label: string;
  title: string;
  lead?: string;
  onDeep?: boolean;
}) {
  return (
    <div className="max-w-2xl">
      <p
        className={cn(
          "text-xs font-semibold tracking-[0.14em] uppercase",
          onDeep ? "text-gold" : "text-sage-deep",
        )}
      >
        {label}
      </p>
      <h2
        className={`mt-2.5 font-heading text-heading font-normal ${onDeep ? "text-surface-deep-foreground" : "text-foreground"}`}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={cn(
            "mt-3 text-[15px] leading-relaxed sm:text-base",
            onDeep ? "text-surface-deep-foreground/75" : "text-muted-foreground",
          )}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

export default async function B2BPage() {
  const [range, store] = await Promise.all([getRange(), getStoreSettings()]);
  const whatsappDigits = store.whatsapp?.replace(/[^\d]/g, "");

  const stats = [
    range.productCount > 0 ? { value: String(range.productCount), label: "Products in our range" } : null,
    range.categories.length > 0 ? { value: String(range.categories.length), label: "Product categories" } : null,
    { value: "Pan-India", label: "Delivery across India" },
    { value: "Mithila", label: "Where our food story begins" },
  ].filter((s): s is { value: string; label: string } => s != null);

  const contacts = [
    { icon: Phone, label: "Business phone", value: store.supportPhone, href: `tel:${store.supportPhone.replace(/\s/g, "")}` },
    { icon: Mail, label: "Email", value: store.supportEmail, href: `mailto:${store.supportEmail}` },
    whatsappDigits
      ? { icon: MessageCircle, label: "WhatsApp", value: store.whatsapp!, href: `https://wa.me/${whatsappDigits}` }
      : null,
    store.address ? { icon: MapPin, label: "Address", value: store.address } : null,
    store.businessHours ? { icon: Clock, label: "Hours", value: store.businessHours } : null,
  ].filter((d): d is { icon: typeof Phone; label: string; value: string; href?: string } => d != null);

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Business", path: "/b2b" },
          ]),
        )}
      />

      <div className="shop-container py-4 sm:py-5">
        <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: "Business" }]} />
      </div>

      {/* Hero */}
      <section className="bg-surface-deep text-surface-deep-foreground">
        <div className="shop-container pt-12 pb-10 sm:pt-16 lg:pt-20 lg:pb-14">
          <div className="mx-auto max-w-5xl">
            <p className="text-xs font-semibold tracking-[0.16em] text-gold uppercase">Nutriyet for business</p>
            <h1 className="mt-4 max-w-3xl font-heading text-title font-normal text-balance text-surface-deep-foreground">
              Quality Indian foods at scale — let&apos;s build a reliable supply relationship
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-surface-deep-foreground/75 sm:text-lg">
              Bulk orders and wholesale supply of makhana, desi spices and other pantry staples — prepared in small
              batches and labelled honestly — for retailers, distributors, HoReCa, institutions and corporate buyers.
            </p>
            <div className="mt-8 flex flex-col gap-3 min-[400px]:flex-row">
              <Button
                asChild
                className="h-12 rounded-lg border-transparent bg-gold px-6 text-[15px] font-semibold text-gold-foreground hover:bg-gold/90"
              >
                <a href="#inquiry">
                  Send an enquiry <ArrowRight className="size-4" aria-hidden />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-lg border-surface-deep-foreground/30 bg-transparent px-6 text-[15px] text-surface-deep-foreground hover:bg-surface-deep-foreground/10 hover:text-surface-deep-foreground"
              >
                <a href="#range">See what you can source</a>
              </Button>
            </div>

            <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-surface-deep-foreground/15 pt-8 sm:mt-14 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="text-2xl leading-none font-semibold text-surface-deep-foreground tabular-nums sm:text-3xl">
                    {s.value}
                  </dd>
                  <dd className="mt-2 text-xs text-surface-deep-foreground/65 sm:text-sm">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Trust strip */}
        <div className="border-t border-surface-deep-foreground/10">
          <ul className="shop-container flex flex-wrap justify-center gap-x-8 gap-y-2.5 py-5 text-[13px] text-surface-deep-foreground/75">
            {TRUST_POINTS.map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-gold" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Who we work with */}
      <Section>
        <SectionHead
          label="Built for"
          title="Who partners with Nutriyet"
          lead="We supply businesses across retail, hospitality, wellness and corporate buying. If your customers value authentic, honestly labelled food, we'd like to work with you."
        />
        <ul className="mt-9 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {AUDIENCES.map((a) => (
            <li
              key={a}
              className="flex items-center gap-2.5 rounded-md border border-border bg-card px-4 py-3 text-sm font-medium text-foreground/85"
            >
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />
              {a}
            </li>
          ))}
        </ul>
      </Section>

      {/* Pricing — how quotes work (no invented tiers) */}
      <Section tone="card">
        <SectionHead
          label="Wholesale pricing"
          title="Pricing, quoted for your order"
          lead="We don't publish a fixed trade price list. Every quote is prepared for your business — built from three things you tell us in the enquiry form."
        />
        <p className="mt-7 rounded-md border border-gold/50 bg-oat px-5 py-4 text-sm leading-relaxed text-oat-foreground">
          Share your requirements below and our team will get back to you within 24 hours with pricing and next
          steps. No obligation.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {QUOTE_FACTORS.map((f) => (
            <div
              key={f.label}
              className={cn(
                "overflow-hidden rounded-lg border bg-card",
                f.featured ? "border-primary ring-1 ring-primary" : "border-border",
              )}
            >
              <div
                className={cn(
                  "border-b px-5 pt-4 pb-4",
                  f.featured ? "border-primary bg-primary text-primary-foreground" : "border-border bg-oat",
                )}
              >
                <p
                  className={cn(
                    "text-[11px] font-bold tracking-[0.1em] uppercase",
                    f.featured ? "text-primary-foreground/75" : "text-muted-foreground",
                  )}
                >
                  {f.label}
                </p>
                <p className="mt-1 font-heading text-xl">{f.title}</p>
              </div>
              <ul className="space-y-2.5 px-5 py-5 text-sm text-foreground/80">
                {f.points.map((p) => (
                  <li key={p} className="flex gap-2.5 leading-snug">
                    <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* The live range */}
      {range.categories.length > 0 && (
        <Section id="range" className="scroll-mt-24">
          <SectionHead
            label="Our range"
            title="What you can source"
            lead="Our current catalogue, by category. Any product here can be part of a bulk or wholesale enquiry."
          />
          <ul
            className={cn(
              "mt-9 grid grid-cols-2 gap-3 sm:gap-4",
              range.categories.length % 3 === 0 || range.categories.length < 4
                ? "sm:grid-cols-3"
                : range.categories.length === 5
                  ? "sm:grid-cols-3 lg:grid-cols-5"
                  : "sm:grid-cols-3 lg:grid-cols-4",
            )}
          >
            {range.categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/categories/${c.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="relative aspect-[4/3] bg-oat">
                    {c.image && (
                      <BlurImage
                        src={c.image}
                        alt=""
                        fill
                        sizes="(max-width: 1024px) 50vw, 240px"
                        className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-1 px-3.5 py-3">
                    <span className="text-sm leading-snug font-semibold text-foreground group-hover:text-primary sm:text-[15px]">
                      {c.name}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {c.count} {c.count === 1 ? "product" : "products"}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Quality journey */}
      <Section tone="card">
        <SectionHead
          label="Quality"
          title="Good food begins with trust"
          lead="Quality begins with the ingredients we select and continues through processing, packaging, storage, fulfilment and customer support."
        />
        <ol className="mt-9 grid overflow-hidden rounded-lg border border-border sm:grid-cols-2 lg:grid-cols-3">
          {QUALITY_JOURNEY.map(([title, desc], i) => (
            <li
              key={title}
              className="-mt-px -ml-px border-t border-l border-border px-5 py-4.5 sm:px-6 sm:py-6"
            >
              {/* Phones: number beside the title, so six steps don't stack into a tall column. */}
              <div className="flex items-baseline gap-3 sm:block">
                <span className="text-xl leading-none font-bold text-primary tabular-nums sm:text-2xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-sans text-sm font-semibold text-foreground sm:mt-3">{title}</h3>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground max-sm:pl-[2.6rem]">{desc}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* How it works */}
      <Section tone="deep">
        <SectionHead
          onDeep
          label="How it works"
          title="From enquiry to supply"
          lead="A straightforward process — you share what you need, we come back with a clear quote."
        />
        <ol className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="rounded-lg border border-surface-deep-foreground/12 bg-surface-deep-foreground/[0.05] p-5">
              <span className="grid size-8 place-items-center rounded-full bg-gold text-sm font-semibold text-gold-foreground tabular-nums">
                {i + 1}
              </span>
              <h3 className="mt-4 font-sans text-[15px] font-semibold text-surface-deep-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-surface-deep-foreground/70">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* FAQ */}
      <Section>
        <SectionHead
          label="Before you enquire"
          title="Frequently asked questions"
          lead="The questions businesses ask us most before a first order."
        />
        <div className="mt-9 overflow-hidden rounded-lg border border-border bg-card">
          {FAQS.map((f) => (
            <details key={f.q} className="group border-b border-border last:border-b-0">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold text-foreground outline-none hover:bg-oat/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-6 [&::-webkit-details-marker]:hidden">
                {f.q}
                <Plus
                  aria-hidden
                  className="size-5 shrink-0 text-primary motion-safe:transition-transform group-open:rotate-45"
                  strokeWidth={1.75}
                />
              </summary>
              <div className="border-t border-border bg-background px-5 py-4 text-sm leading-relaxed text-muted-foreground sm:px-6">
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </Section>

      {/* Enquiry */}
      <Section id="inquiry" tone="card" className="scroll-mt-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-14">
          <div>
            <SectionHead
              label="Get in touch"
              title="Let's talk business"
              lead="Whether you need pricing, want to become a distributor, or have a corporate requirement — tell us what you need. Fields marked * are required."
            />
            <ul className="mt-8 space-y-4">
              {contacts.map((c) => (
                <li key={c.label} className="flex items-start gap-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-sage text-sage-deep">
                    <c.icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="min-w-0 text-sm">
                    <span className="block text-xs text-muted-foreground">{c.label}</span>
                    {c.href ? (
                      <a
                        href={c.href}
                        className="font-medium break-words text-foreground underline-offset-4 hover:text-primary hover:underline"
                        {...(c.href.startsWith("https") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      >
                        {c.value}
                      </a>
                    ) : (
                      <span className="font-medium break-words whitespace-pre-line text-foreground">{c.value}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-8 flex gap-3 rounded-md bg-sage px-4 py-3.5 text-sm leading-relaxed text-sage-foreground">
              <Clock className="mt-0.5 size-4 shrink-0 text-sage-deep" strokeWidth={1.75} aria-hidden />
              <span>
                We reply to every business enquiry within <strong className="font-semibold">24 hours</strong>
                {whatsappDigits ? " — or message us on WhatsApp for a quick conversation." : "."}
              </span>
            </p>
          </div>

          <B2BForm cloudinaryReady={isConfigured.cloudinary()} />
        </div>
      </Section>
    </div>
  );
}
