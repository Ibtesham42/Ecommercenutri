import type { Metadata } from "next";
import { Leaf, ShieldCheck, Sparkles } from "lucide-react";
import { buildMetadata, breadcrumbSchema, organizationSchema, jsonLd } from "@/lib/seo";
import { siteConfig } from "@/config/site";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/storefront/page-header";

export const metadata: Metadata = buildMetadata({
  title: "About us",
  description:
    "The story behind Nutriyet — an Indian food brand rooted in the traditions of Bihar and Mithila, " +
    "bringing makhana, spices and everyday pantry staples to households across India.",
  path: "/about",
});

const aboutSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: `About ${siteConfig.name}`,
  url: new URL("/about", siteConfig.url).toString(),
  mainEntity: organizationSchema(),
};

const VALUES = [
  { icon: Leaf, title: "Honest ingredients", desc: "Clear information on every pack — no hidden language, no exaggerated claims." },
  { icon: ShieldCheck, title: "Careful processing", desc: "Every product gets the handling appropriate to it, batch by batch." },
  { icon: Sparkles, title: "A little help when you want it", desc: "Our AI assistant is there if you have a question — never required, never the point." },
];

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(aboutSchema)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
        )}
      />
      <div className="shop-container pt-6 pb-14 sm:pt-8 lg:pb-20">
        <PageHeader
          crumbs={[{ name: "Home", href: "/" }, { name: "About" }]}
          eyebrow="Our story"
          title={
            <>
              Rooted in tradition.
              <span className="block text-primary">Made for today.</span>
            </>
          }
          lede="Nutriyet brings together the food traditions of Bihar and Mithila with the convenience of modern, everyday shopping. We focus on makhana, spices and other pantry staples that feel familiar — sourced and prepared with care, labelled honestly, and shipped straight to your door."
        />
      </div>

      {/* From the heart of Mithila — the brand's roots as a colour-block band. */}
      <section className="bg-oat">
        <div className="shop-container shop-section">
          <figure className="max-w-4xl rounded-2xl bg-surface-deep px-7 py-10 text-surface-deep-foreground sm:px-12 sm:py-14">
            <p className="eyebrow !text-gold">From the heart of Mithila</p>
            <blockquote className="mt-5 font-heading text-[1.6rem] leading-snug font-normal sm:text-[2rem]">
              Makhana has been grown in the Mithila region for generations. We bring that heritage to
              your everyday kitchen — alongside spices and staples chosen with the same care.
            </blockquote>
          </figure>
        </div>
      </section>

      <div className="shop-container shop-section">
        <p className="eyebrow">What we care about</p>
        <ul className="mt-6 grid border-t border-border sm:grid-cols-3 sm:border-t-0">
          {VALUES.map((v) => (
            <li
              key={v.title}
              className="border-b border-border py-7 sm:border-b-0 sm:border-l sm:px-8 sm:py-2 sm:first:border-l-0 sm:first:pl-0"
            >
              <v.icon className="size-6 text-terracotta" strokeWidth={1.5} aria-hidden />
              <h2 className="mt-4 font-heading text-subheading font-medium">{v.title}</h2>
              <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-muted-foreground">{v.desc}</p>
            </li>
          ))}
        </ul>

        <div className="mt-16 flex flex-col gap-6 border-t border-border pt-10 sm:flex-row sm:items-end sm:justify-between lg:mt-20">
          <p className="max-w-xl font-heading text-subheading text-foreground">
            Built for anyone who wants food that feels like home — one honest pack at a time.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="h-12 rounded-lg px-6 text-[15px]">
              <Link href="/products">Shop the range</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-lg border-foreground/70 bg-transparent px-6 text-[15px] hover:bg-foreground hover:text-background"
            >
              <Link href="/blog">Read the journal</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
