import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { buildMetadata, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { getStoreSettings } from "@/lib/queries/settings";
import { Button } from "@/components/ui/button";
import { CONTENT_PAGE_CLASS, PageHeader, ReadingLayout } from "@/components/storefront/page-header";

export const metadata: Metadata = buildMetadata({
  title: "Careers",
  description: "Build the future of Indian food with Nutriyet.",
  path: "/careers",
});

// Reads admin-editable contact details — render per request.
export const dynamic = "force-dynamic";

const AREAS = [
  "Operations",
  "Quality",
  "Sales",
  "Marketing",
  "E-commerce",
  "Customer Experience",
  "Logistics",
  "Technology",
];

export default async function CareersPage() {
  const store = await getStoreSettings();

  return (
    <div className={CONTENT_PAGE_CLASS}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Careers", path: "/careers" }]),
        )}
      />
      <PageHeader
        crumbs={[{ name: "Home", href: "/" }, { name: "Careers" }]}
        eyebrow="Careers"
        title="Careers at Nutriyet"
        lede="We're building a modern Indian food brand rooted in the traditions of Bihar and Mithila — and growing the team behind it."
      />

      <ReadingLayout>
        <p className="text-[15px] leading-relaxed text-foreground/80 sm:text-base">
          We don&apos;t have specific open roles listed right now, but we&apos;re always happy to hear from
          people who care about good food, honest brands and building something real. If that&apos;s you,
          we&apos;d love to know what you&apos;re interested in.
        </p>

        <section aria-labelledby="careers-areas" className="mt-12">
          <h2 id="careers-areas" className="font-heading text-subheading font-medium">
            Areas we grow in
          </h2>
          <ul className="mt-4 grid grid-cols-2 border-t border-border sm:grid-cols-4">
            {AREAS.map((a) => (
              <li key={a} className="border-b border-border py-3 text-[15px]">
                {a}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="careers-apply" className="mt-12 rounded-xl bg-oat p-6 text-oat-foreground sm:p-8">
          <h2 id="careers-apply" className="font-heading text-subheading font-medium">
            Get in touch
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed">
            Send us a note at <span className="font-medium [overflow-wrap:anywhere]">{store.supportEmail}</span>{" "}
            with a little about yourself and what you&apos;re interested in — we read every message.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild className="h-12 gap-2 rounded-lg px-6 text-[15px]">
              <a href={`mailto:${store.supportEmail}`}>
                <Mail className="size-4" aria-hidden /> Email us
              </a>
            </Button>
            <Link href="/about" className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">
              Read our story first
            </Link>
          </div>
        </section>
      </ReadingLayout>
    </div>
  );
}
