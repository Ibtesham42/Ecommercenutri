import type { Metadata } from "next";
import { Leaf, ShieldCheck, Sparkles } from "lucide-react";
import { buildMetadata, breadcrumbSchema, organizationSchema, jsonLd } from "@/lib/seo";
import { siteConfig } from "@/config/site";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";

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
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:py-20">
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
      <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: "About" }]} />

      {/* Lead — editorial, warm */}
      <p className="mt-6 text-sm font-medium tracking-[0.16em] text-gold uppercase">Our story</p>
      <h1 className="mt-3 font-heading text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
        Rooted in tradition.
        <br className="hidden sm:block" /> Made for today.
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-muted-foreground">
        Nutriyet brings together the food traditions of Bihar and Mithila with the convenience of
        modern, everyday shopping. We focus on makhana, spices and other pantry staples that feel
        familiar — sourced and prepared with care, labelled honestly, and shipped straight to your
        door.
      </p>

      {/* From the heart of Mithila — the brand's roots, told as an editorial pull-quote */}
      <div className="surface-rich mt-12 overflow-hidden rounded-3xl px-7 py-9 text-surface-deep-foreground sm:px-10 sm:py-11">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-gold uppercase">From the heart of Mithila</p>
        <p className="mt-4 font-heading text-2xl leading-snug font-medium sm:text-[1.75rem]">
          Makhana has been grown in the Mithila region for generations. We bring that heritage to
          your everyday kitchen — alongside spices and staples chosen with the same care.
        </p>
      </div>

      {/* Values — a single warm panel with gold thin-stroke icons + hairline
          dividers (one considered statement, not three stamped cards). */}
      <div className="mt-12 divide-y divide-border rounded-3xl border bg-card/60 shadow-elev-1 sm:divide-x sm:divide-y-0 sm:grid sm:grid-cols-3">
        {VALUES.map((v) => (
          <div key={v.title} className="p-6 sm:p-7">
            <v.icon className="size-6 text-gold" strokeWidth={1.75} aria-hidden />
            <h2 className="mt-3.5 font-heading text-lg font-semibold">{v.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{v.desc}</p>
          </div>
        ))}
      </div>

      <p className="mt-12 text-lg leading-relaxed text-muted-foreground">
        Built for anyone who wants food that feels like home — one honest pack at a time.
      </p>
    </div>
  );
}
