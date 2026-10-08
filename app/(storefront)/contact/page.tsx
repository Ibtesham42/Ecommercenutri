import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, MapPin, Clock, MessageCircle, ArrowRight } from "lucide-react";
import { buildMetadata, faqSchema, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { getStoreSettings, getReturnSettings } from "@/lib/queries/settings";
import { formatPrice } from "@/lib/format";
import { ContactForm } from "@/components/storefront/contact-form";
import { CONTENT_PAGE_CLASS, PageHeader } from "@/components/storefront/page-header";
import { FaqList } from "@/components/storefront/faq-list";

export const metadata: Metadata = buildMetadata({
  title: "Contact us",
  description: "Get in touch with the Nutriyet team — we're happy to help.",
  path: "/contact",
});

// Reads admin-editable store contact details and live pricing/return settings
// (free-shipping threshold, return window) so the FAQ answers below never
// drift from what checkout/the policy pages actually show.
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const [store, returnSettings] = await Promise.all([
    getStoreSettings(),
    getReturnSettings(),
  ]);
  const whatsappDigits = store.whatsapp?.replace(/[^\d]/g, "");

  const FAQS = [
    {
      q: "How long does delivery take?",
      a: "Most orders arrive within 3–7 business days. You can follow your parcel any time from the Track Order page.",
    },
    {
      q: "Do you offer free shipping?",
      a:
        store.freeShippingEnabled && store.freeShippingThreshold > 0
          ? `Yes — shipping is free on orders above ${formatPrice(store.freeShippingThreshold)}.`
          : "Shipping charges are shown at checkout based on your order and delivery location.",
    },
    {
      q: "What is your return policy?",
      a: `As our products are food items, we accept returns for damaged, defective or incorrect items${returnSettings.returnsEnabled ? ` reported within ${returnSettings.returnWindowDays} days of delivery` : ""}. See our Returns & Refunds Policy for details.`,
    },
    {
      q: "How can I track my order?",
      a: "Use your order number and the email you checked out with on the Track Order page — no login needed.",
    },
  ];

  const details = [
    { icon: Mail, label: "Email", value: store.supportEmail, href: `mailto:${store.supportEmail}` },
    { icon: Phone, label: "Phone", value: store.supportPhone, href: `tel:${store.supportPhone.replace(/\s/g, "")}` },
    store.address ? { icon: MapPin, label: "Address", value: store.address } : null,
    store.businessHours ? { icon: Clock, label: "Hours", value: store.businessHours } : null,
    whatsappDigits
      ? { icon: MessageCircle, label: "WhatsApp", value: store.whatsapp!, href: `https://wa.me/${whatsappDigits}` }
      : null,
  ].filter((d): d is { icon: typeof Mail; label: string; value: string; href?: string } => d != null);

  return (
    <div className={CONTENT_PAGE_CLASS}>
      {/* FAQPage marks up the real on-page Q&A below (helps AI/search
          understanding); breadcrumb for consistency with other pages. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqSchema(FAQS))} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Contact", path: "/contact" },
          ]),
        )}
      />
      <PageHeader
        crumbs={[{ name: "Home", href: "/" }, { name: "Contact" }]}
        eyebrow="Contact"
        title="Get in touch"
        lede="Questions about a product, an order, or nutrition advice? Our team is here to help."
      />

      <div className="mt-10 grid gap-12 sm:mt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-16 xl:gap-24">
        <div className="space-y-12">
          <section aria-labelledby="contact-details">
            <h2 id="contact-details" className="sr-only">
              Contact details
            </h2>
            <dl className="grid gap-x-8 border-t border-border sm:grid-cols-2">
              {details.map((d) => (
                <div key={d.label} className="flex items-start gap-3.5 border-b border-border py-4">
                  <d.icon className="mt-0.5 size-5 shrink-0 text-foreground/60" strokeWidth={1.6} aria-hidden />
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {d.label}
                    </dt>
                    <dd className="break-words text-[15px] font-medium">
                      {d.href ? (
                        <a
                          href={d.href}
                          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                          {...(d.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        >
                          {d.value}
                        </a>
                      ) : (
                        d.value
                      )}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>

          {/* Only render when there is something real to show — an empty
              "coming soon" box reads unfinished. Address-only stores keep the
              address in the details list above instead of a placeholder map. */}
          {store.mapsEmbedUrl && (
            <section aria-labelledby="contact-map">
              <h2 id="contact-map" className="font-heading text-subheading font-medium">
                Find us
              </h2>
              <div className="mt-4 overflow-hidden rounded-xl border border-border">
                <iframe
                  src={store.mapsEmbedUrl}
                  title="Store location"
                  className="h-64 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </section>
          )}

          <section aria-labelledby="contact-faq">
            <h2 id="contact-faq" className="font-heading text-subheading font-medium">
              Frequently asked
            </h2>
            <FaqList items={FAQS} className="mt-3" />
            <Link
              href="/faq"
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              All FAQs <ArrowRight className="size-4" />
            </Link>
          </section>
        </div>

        <section aria-labelledby="contact-form" className="lg:sticky lg:top-28 lg:self-start">
          <h2 id="contact-form" className="mb-4 font-heading text-subheading font-medium">
            Send us a message
          </h2>
          <ContactForm />
        </section>
      </div>
    </div>
  );
}
