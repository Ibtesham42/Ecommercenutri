import type { Metadata } from "next";
import Link from "next/link";
import { Gift, Sparkles, Package, MessageSquare } from "lucide-react";
import { buildMetadata, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";

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
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Corporate Gifting", path: "/corporate-gifting" },
          ]),
        )}
      />
      <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: "Corporate Gifting" }]} />

      <header className="mt-6 border-b pb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Corporate Gifting</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Give something rooted in tradition — curated Nutriyet gifting for the people and occasions that
          matter to your business.
        </p>
      </header>

      <div className="mt-8 space-y-10">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Suited for
          </h2>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <span
                key={o}
                className="rounded-full border bg-card px-4 py-1.5 text-sm font-medium shadow-elev-1"
              >
                {o}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            How it works
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.title} className="rounded-2xl border bg-card p-5 shadow-elev-1">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-rich hover-lift flex flex-col items-start gap-4 rounded-3xl p-6 text-surface-deep-foreground shadow-elev-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-heading text-lg font-semibold">
              <Sparkles className="size-5 text-gold" aria-hidden /> Ready to start?
            </p>
            <p className="mt-1 text-sm text-surface-deep-foreground/80">
              Submit a business enquiry with your requirements — select &quot;Corporate Order&quot; as the
              purpose and mention gifting details in your message.
            </p>
          </div>
          <Button asChild size="lg" className="btn-rich btn-rich-gold shrink-0 gap-2 rounded-full bg-gold font-semibold text-gold-foreground">
            <Link href="/b2b">
              Enquire now
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
