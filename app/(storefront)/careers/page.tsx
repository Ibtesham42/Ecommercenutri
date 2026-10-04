import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Sparkles } from "lucide-react";
import { buildMetadata, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { getStoreSettings } from "@/lib/queries/settings";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";

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
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Careers", path: "/careers" }]),
        )}
      />
      <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: "Careers" }]} />

      <header className="mt-6 border-b pb-6">
        <h1 className="text-3xl font-bold sm:text-4xl">Careers at Nutriyet</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          We&apos;re building a modern Indian food brand rooted in the traditions of Bihar and Mithila —
          and growing the team behind it.
        </p>
      </header>

      <div className="mt-8 space-y-6">
        <p className="text-muted-foreground">
          We don&apos;t have specific open roles listed right now, but we&apos;re always happy to hear from
          people who care about good food, honest brands and building something real. If that&apos;s you,
          we&apos;d love to know what you&apos;re interested in.
        </p>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Areas we grow in
          </h2>
          <div className="flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <span
                key={a}
                className="rounded-full border bg-card px-4 py-1.5 text-sm font-medium shadow-elev-1"
              >
                {a}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <p className="flex items-center gap-2 font-semibold text-primary">
            <Mail className="size-4" aria-hidden /> Get in touch
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Send us a note at{" "}
            <a href={`mailto:${store.supportEmail}`} className="font-medium text-primary hover:underline">
              {store.supportEmail}
            </a>{" "}
            with a little about yourself and what you&apos;re interested in — we read every message.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border bg-accent/30 p-4 text-sm text-muted-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p>
            Prefer to explore the brand first? Read our{" "}
            <Link href="/about" className="font-medium text-primary hover:underline">
              story
            </Link>{" "}
            to see what we&apos;re building.
          </p>
        </div>
      </div>
    </div>
  );
}
