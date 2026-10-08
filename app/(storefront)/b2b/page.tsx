import type { Metadata } from "next";
import {
  BadgePercent,
  Boxes,
  Tags,
  Truck,
  ShieldCheck,
  Headset,
  ArrowRight,
} from "lucide-react";
import { B2BForm } from "@/components/storefront/b2b-form";
import { Reveal } from "@/components/storefront/reveal";
import { SectionHeading } from "@/components/storefront/section-heading";
import { buildMetadata } from "@/lib/seo";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = buildMetadata({
  title: "B2B & Wholesale — Partner with Nutriyet",
  description:
    "Partner with Nutriyet for wholesale pricing, bulk orders, private-label and dedicated business support — for distributors, retailers, supermarkets, hotels, restaurants, cafés, gyms, corporates and more.",
  path: "/b2b",
});

const benefits = [
  {
    icon: BadgePercent,
    title: "Wholesale pricing",
    desc: "Competitive tiered pricing that scales with your volume and grows your margins.",
  },
  {
    icon: Boxes,
    title: "Bulk orders",
    desc: "Reliable, large-quantity supply with consistent batch quality and availability.",
  },
  {
    icon: Tags,
    title: "Custom & private label",
    desc: "Future-ready private-label and custom branding for your own retail line.",
  },
  {
    icon: Truck,
    title: "Fast delivery",
    desc: "Pan-India logistics with dependable lead times so your shelves stay stocked.",
  },
  {
    icon: ShieldCheck,
    title: "Quality assurance",
    desc: "Lab-tested, FSSAI-compliant products — 100% natural, every single batch.",
  },
  {
    icon: Headset,
    title: "Dedicated support",
    desc: "A dedicated B2B account manager for pricing, orders and after-sales care.",
  },
];

const audiences = [
  "Distributors",
  "Wholesalers",
  "Retailers",
  "Supermarkets",
  "Hotels",
  "Restaurants",
  "Cafés",
  "Corporates",
  "Gyms",
  "Nutrition stores",
  "Pharmacies",
];

export default function B2BPage() {
  return (
    <div>
      {/* Hero — forest colour block */}
      <section className="bg-surface-deep text-surface-deep-foreground">
        <div className="shop-container grid items-center gap-10 py-14 md:grid-cols-2 md:py-20 lg:gap-16 lg:py-24">
          <div>
            <p className="eyebrow !text-gold">Nutriyet for business</p>
            <h1 className="mt-3 font-heading text-title [overflow-wrap:anywhere]">
              Partner with Nutriyet — wholesale, bulk &amp; private label
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-surface-deep-foreground/80 sm:text-base">
              Stock India&apos;s fast-growing healthy-nutrition range at business pricing.
              Built for distributors, retailers, supermarkets, HoReCa, gyms and corporates —
              with quality you can trust and a team that has your back.
            </p>
            <a
              href="#inquiry"
              className="mt-7 inline-flex h-12 items-center gap-2 rounded-lg bg-gold px-6 text-[15px] font-medium text-gold-foreground outline-none transition-colors hover:bg-gold/90 focus-visible:ring-3 focus-visible:ring-gold/50"
            >
              Send business inquiry <ArrowRight className="size-4" />
            </a>
          </div>
          <ul className="hidden grid-cols-2 border-t border-white/15 md:grid">
            {benefits.slice(0, 4).map((b) => (
              <li key={b.title} className="flex items-center gap-3 border-b border-white/15 py-5 pr-4 text-[15px] font-medium">
                <b.icon className="size-5 shrink-0 text-gold" strokeWidth={1.5} aria-hidden />
                {b.title}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Why partner */}
      <section className="shop-container shop-section">
        <SectionHeading
          eyebrow="Why Nutriyet"
          title="Why partner with Nutriyet"
          subtitle="Everything a serious business buyer needs to grow with confidence."
        />
        <Reveal className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="border-t border-border py-6">
              <b.icon className="size-5 text-terracotta" strokeWidth={1.5} aria-hidden />
              <h3 className="mt-4 font-heading text-subheading font-medium">{b.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </Reveal>

        {/* Audiences */}
        <p className="mt-10 max-w-3xl text-[15px] leading-relaxed">
          <span className="eyebrow mr-3 align-middle">Built for</span>
          <span className="text-muted-foreground">{audiences.join(" · ")}</span>
        </p>
      </section>

      {/* Inquiry */}
      <section id="inquiry" className="scroll-mt-28 bg-oat">
        <div className="shop-container shop-section grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="text-oat-foreground">
            <p className="eyebrow">Business inquiry</p>
            <h2 className="mt-3 font-heading text-heading font-medium text-foreground">
              Let&apos;s talk business
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed">
              Share a few details and our B2B team will get back to you within 24 hours with
              pricing and next steps. Fields marked <span className="text-destructive">*</span>{" "}
              are required.
            </p>
            <ul className="mt-6 max-w-sm border-t border-foreground/15 text-[15px]">
              <li className="flex items-center gap-3 border-b border-foreground/15 py-3">
                <ShieldCheck className="size-4 shrink-0" strokeWidth={1.75} aria-hidden /> No obligation, no spam
              </li>
              <li className="flex items-center gap-3 border-b border-foreground/15 py-3">
                <Headset className="size-4 shrink-0" strokeWidth={1.75} aria-hidden /> Dedicated business support
              </li>
              <li className="flex items-center gap-3 border-b border-foreground/15 py-3">
                <Truck className="size-4 shrink-0" strokeWidth={1.75} aria-hidden /> Pan-India delivery
              </li>
            </ul>
          </div>
          <B2BForm cloudinaryReady={isConfigured.cloudinary()} />
        </div>
      </section>
    </div>
  );
}
