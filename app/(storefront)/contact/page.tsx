import type { Metadata } from "next";
import { Mail, Phone, MapPin, Clock, MessageCircle } from "lucide-react";
import { buildMetadata, faqSchema, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { getStoreSettings } from "@/lib/queries/settings";
import { ContactForm } from "@/components/storefront/contact-form";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = buildMetadata({
  title: "Contact us",
  description: "Get in touch with the Nutriyet team — we're happy to help.",
  path: "/contact",
});

const FAQS = [
  {
    q: "How long does delivery take?",
    a: "Most orders arrive within 3–7 business days. You can follow your parcel any time from the Track Order page.",
  },
  {
    q: "Do you offer free shipping?",
    a: "Yes — shipping is free on all orders above ₹499. A flat ₹49 applies below that.",
  },
  {
    q: "What is your return policy?",
    a: "As our products are food items, we accept returns for damaged, defective or incorrect items reported within 48 hours of delivery. See Shipping & Returns for details.",
  },
  {
    q: "How can I track my order?",
    a: "Use your order number and the email you checked out with on the Track Order page — no login needed.",
  },
];

// Reads admin-editable store contact details — render per request.
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const store = await getStoreSettings();
  const whatsappDigits = store.whatsapp?.replace(/[^\d]/g, "");

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
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
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
      <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: "Contact" }]} />

      <header className="mt-6 max-w-2xl">
        <h1 className="text-3xl font-bold sm:text-4xl">Get in touch</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Questions about a product, an order, or nutrition advice? Our team is here to help.
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-8">
          <section className="grid gap-3 sm:grid-cols-2">
            {details.map((d) => {
              const content = (
                <div className="flex items-start gap-3 rounded-xl border p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <d.icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {d.label}
                    </p>
                    <p className="mt-0.5 break-words text-sm font-medium">{d.value}</p>
                  </div>
                </div>
              );
              return d.href ? (
                <a key={d.label} href={d.href} className="transition-colors hover:[&_p]:text-primary">
                  {content}
                </a>
              ) : (
                <div key={d.label}>{content}</div>
              );
            })}
          </section>

          {/* Only render when there is something real to show — an empty
              "coming soon" box reads unfinished. Address-only stores get a
              clean address card instead of a placeholder map. */}
          {(store.mapsEmbedUrl || store.address) && (
            <section>
              <h2 className="text-lg font-semibold">Find us</h2>
              <div className="mt-3 overflow-hidden rounded-2xl border">
                {store.mapsEmbedUrl ? (
                  <iframe
                    src={store.mapsEmbedUrl}
                    title="Store location"
                    className="h-64 w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex items-start gap-3 bg-accent/30 p-4">
                    <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
                    <p className="text-sm font-medium">{store.address}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold">Frequently asked</h2>
            <Accordion type="single" collapsible className="mt-2">
              {FAQS.map((f) => (
                <AccordionItem key={f.q} value={f.q}>
                  <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="mb-3 text-lg font-semibold">Send us a message</h2>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
