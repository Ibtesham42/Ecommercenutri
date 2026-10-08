import type { Metadata } from "next";
import Link from "next/link";
import { Gift, Package, MessageSquare, ArrowRight } from "lucide-react";
import { buildMetadata, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { CONTENT_PAGE_CLASS, PageHeader } from "@/components/storefront/page-header";

export const metadata: Metadata = buildMetadata({
  title: "Corporate Gifting",
  description: "Curated Nutriyet gifting for employees, clients and celebrations.",
  path: "/corporate-gifting",
});

const OCCASIONS = [
  "Employee gifting",
  "Client appreciation",
  "Diwali & festivals",
  "Weddings & celebrations",
  "Corporate events",
];

const STEPS = [
  {
    icon: MessageSquare,
    title: "Tell us what you need",
    desc: "Share your occasion, quantity and budget through our business enquiry form.",
  },
  {
    icon: Package,
    title: "We curate options",
    desc: "Our team puts together product and packaging options that fit your brief.",
  },
  {
    icon: Gift,
    title: "We fulfil at scale",
    desc: "Once confirmed, we handle packing and delivery for your full order.",
  },
];

export default function CorporateGiftingPage() {
  return (
    <div className={CONTENT_PAGE_CLASS}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Corporate Gifting", path: "/corporate-gifting" },
          ]),
        )}
      />
      <PageHeader
        crumbs={[{ name: "Home", href: "/" }, { name: "Corporate Gifting" }]}
        eyebrow="For business"
        title="Corporate gifting"
        lede="Give something rooted in tradition — curated Nutriyet gifting for the people and occasions that matter to your business."
      />

      <section aria-labelledby="gifting-occasions" className="mt-12 sm:mt-14">
        <h2 id="gifting-occasions" className="font-heading text-subheading font-medium">
          Suited for
        </h2>
        <ul className="mt-4 grid grid-cols-2 border-t border-border sm:grid-cols-3 lg:grid-cols-4">
          {OCCASIONS.map((o) => (
            <li key={o} className="border-b border-border py-3 text-[15px]">
              {o}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="gifting-steps" className="mt-14 sm:mt-16">
        <h2 id="gifting-steps" className="font-heading text-subheading font-medium">
          How it works
        </h2>
        <ol className="mt-6 grid gap-8 sm:grid-cols-3 sm:gap-10">
          {STEPS.map((step, i) => (
            <li key={step.title} className="border-t border-foreground/80 pt-5">
              <span className="flex items-center justify-between">
                <span className="font-heading text-subheading text-muted-foreground tabular-nums">
                  0{i + 1}
                </span>
                <step.icon className="size-5 text-terracotta" strokeWidth={1.5} aria-hidden />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{step.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="gifting-start"
        className="mt-14 flex flex-col items-start gap-6 rounded-xl bg-surface-deep p-6 text-surface-deep-foreground sm:mt-16 sm:p-10 md:flex-row md:items-center md:justify-between"
      >
        <div className="max-w-xl">
          <h2 id="gifting-start" className="font-heading text-heading font-medium">
            Ready to start?
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-surface-deep-foreground/80">
            Submit a business enquiry with your requirements — select &quot;Corporate Order&quot; as the
            purpose and mention gifting details in your message.
          </p>
        </div>
        <Link
          href="/b2b"
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-lg bg-gold px-6 text-[15px] font-medium text-gold-foreground outline-none transition-colors hover:bg-gold/90 focus-visible:ring-3 focus-visible:ring-gold/50"
        >
          Enquire now <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}
