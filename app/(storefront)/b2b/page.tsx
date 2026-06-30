import type { Metadata } from "next";
import {
  Building2,
  BadgePercent,
  Boxes,
  Tags,
  Truck,
  ShieldCheck,
  Headset,
  Handshake,
  ArrowRight,
} from "lucide-react";
import { B2BForm } from "@/components/storefront/b2b-form";
import { Reveal } from "@/components/storefront/reveal";
import { buildMetadata } from "@/lib/seo";

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
    <div className="pb-4">
      {/* Hero */}
      <section className="border-b bg-surface-deep text-surface-deep-foreground">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-8 px-4 py-14 md:grid-cols-2 md:py-20">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
              <Building2 className="size-3.5" /> Nutriyet for Business
            </span>
            <h1 className="font-heading text-3xl font-bold leading-[1.1] sm:text-4xl lg:text-5xl">
              Partner with Nutriyet — wholesale, bulk &amp; private label
            </h1>
            <p className="max-w-xl text-surface-deep-foreground/75">
              Stock India&apos;s fast-growing healthy-nutrition range at business pricing.
              Built for distributors, retailers, supermarkets, HoReCa, gyms and corporates —
              with quality you can trust and a team that has your back.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <a
                href="#inquiry"
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-bold text-gold-foreground transition-transform hover:brightness-105 active:scale-95"
              >
                Send Business Inquiry <ArrowRight className="size-4" />
              </a>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="grid grid-cols-2 gap-3">
              {benefits.slice(0, 4).map((b) => (
                <div
                  key={b.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <b.icon className="size-6 text-gold" />
                  <p className="mt-2 text-sm font-semibold">{b.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why partner */}
      <section className="mx-auto w-full max-w-7xl px-4 py-14">
        <div className="mb-8 max-w-2xl">
          <span className="mb-2.5 block h-1 w-10 rounded-full bg-gradient-to-r from-primary to-gold" />
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Why partner with Nutriyet
          </h2>
          <p className="mt-1 text-muted-foreground">
            Everything a serious business buyer needs to grow with confidence.
          </p>
        </div>
        <Reveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="hover-lift rounded-2xl border bg-card p-6 shadow-elev-1 hover:shadow-elev-2"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-gold/15 text-primary">
                <b.icon className="size-6" />
              </span>
              <h3 className="mt-4 font-semibold">{b.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </Reveal>

        {/* Audiences */}
        <div className="mt-10 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Trusted by:</span>
          {audiences.map((a) => (
            <span
              key={a}
              className="rounded-full border bg-accent/40 px-3 py-1 text-xs font-medium"
            >
              {a}
            </span>
          ))}
        </div>
      </section>

      {/* Inquiry */}
      <section id="inquiry" className="border-t bg-muted/30 scroll-mt-20">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-14 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Handshake className="size-3.5" /> Send Business Inquiry
            </span>
            <h2 className="font-heading text-2xl font-bold sm:text-3xl">
              Let&apos;s talk business
            </h2>
            <p className="text-muted-foreground">
              Share a few details and our B2B team will get back to you within 24 hours with
              pricing and next steps. Fields marked <span className="text-destructive">*</span>{" "}
              are required.
            </p>
            <ul className="space-y-2 pt-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> No obligation, no spam
              </li>
              <li className="flex items-center gap-2">
                <Headset className="size-4 text-primary" /> Dedicated business support
              </li>
              <li className="flex items-center gap-2">
                <Truck className="size-4 text-primary" /> Pan-India delivery
              </li>
            </ul>
          </div>
          <B2BForm />
        </div>
      </section>
    </div>
  );
}
