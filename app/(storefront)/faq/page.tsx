import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata, faqSchema, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { getStoreSettings, getReturnSettings } from "@/lib/queries/settings";
import { formatPrice, slugify } from "@/lib/format";
import { CONTENT_PAGE_CLASS, PageHeader, ReadingLayout } from "@/components/storefront/page-header";
import { TableOfContents } from "@/components/storefront/table-of-contents";
import { FaqList, type FaqItem } from "@/components/storefront/faq-list";

export const metadata: Metadata = buildMetadata({
  title: "Frequently Asked Questions",
  description: "Answers to common questions about Nutriyet orders, delivery, storage, returns and more.",
  path: "/faq",
});

// Pulls live store settings (free-shipping threshold, return window) so
// answers never drift from what checkout/the policy pages actually show.
export const dynamic = "force-dynamic";

type FaqGroup = { heading: string; items: FaqItem[] };

export default async function FaqPage() {
  const [store, returnSettings] = await Promise.all([
    getStoreSettings(),
    getReturnSettings(),
  ]);

  const groups: FaqGroup[] = [
    {
      heading: "About Nutriyet",
      items: [
        {
          q: "What is Nutriyet?",
          a: "Nutriyet is an Indian food brand rooted in the traditions of Bihar and Mithila, bringing makhana, spices and other everyday pantry staples to households across India — thoughtfully prepared and honestly labelled.",
        },
        {
          q: "Does Nutriyet use preservatives?",
          a: "We aim to keep formulations as simple as appropriate for each product. Whether a specific product contains preservatives — and any related claims — depends on that product's formulation, so please check the ingredient list on the individual product page and packaging.",
        },
        {
          q: "Are Nutriyet products vegetarian?",
          a: "Vegetarian/non-vegetarian status is shown on each individual product's page and packaging, since this can vary by product and formulation — please check before purchasing or consuming.",
        },
        {
          q: "Are Nutriyet products made in small batches?",
          a: "Where applicable, yes — we favour smaller, carefully managed batches over mass production, to help maintain consistency and freshness.",
        },
        {
          q: "How does Nutriyet ensure product quality?",
          a: "We pay attention to the full journey — ingredient selection, processing, packaging, storage and delivery — and we're always working to make our product information clear and honest.",
        },
      ],
    },
    {
      heading: "Storage & freshness",
      items: [
        {
          q: "How should Makhana be stored?",
          a: "Keep it in a cool, dry place away from direct sunlight and moisture, and reseal the pack tightly after opening — Makhana can lose its characteristic crunch if exposed to humidity.",
        },
        {
          q: "How should spices be stored?",
          a: "Store in a cool, dry place away from heat, moisture and direct sunlight, and keep the pack sealed after each use for the best flavour and aroma.",
        },
        {
          q: "What is the shelf life of Nutriyet products?",
          a: "Shelf life varies by product and is printed on the individual product's packaging — always check the date marking before use.",
        },
        {
          q: "Are Nutriyet products suitable for children?",
          a: "Suitability can depend on the specific product, its ingredients and a child's age or allergies. Please check the ingredient and allergen information on the product label, and consult a healthcare professional for infants or children with specific dietary needs.",
        },
        {
          q: "Do Nutriyet products contain allergens?",
          a: "This varies by product. Please check the allergen declaration on the individual product page and packaging before consuming, especially if you have a known food allergy.",
        },
      ],
    },
    {
      heading: "Delivery & orders",
      items: [
        {
          q: "Do you deliver across India?",
          a: "We aim to deliver across India through our courier partners, subject to serviceability for your address. You'll see exact delivery availability, charges and an estimated timeline at checkout before you pay.",
        },
        {
          q: "Do you offer free shipping?",
          a:
            store.freeShippingEnabled && store.freeShippingThreshold > 0 ? (
              <>Yes — free shipping applies on orders above {formatPrice(store.freeShippingThreshold)}.</>
            ) : (
              "Shipping charges are shown at checkout based on your order and delivery location."
            ),
        },
        {
          q: "Do you offer international shipping?",
          a: (
            <>
              Not yet — we&apos;re currently focused on delivering across India. For international
              enquiries, reach out via our{" "}
              <Link href="/contact" className="font-medium text-primary hover:underline">
                Contact page
              </Link>{" "}
              and we&apos;ll let you know if this changes.
            </>
          ),
        },
        {
          q: "How can I track my order?",
          a: (
            <>
              Use your order number and the email you checked out with on the{" "}
              <Link href="/track" className="font-medium text-primary hover:underline">
                Track Order
              </Link>{" "}
              page — no login needed. Signed-in customers can also see full order history under My Account.
            </>
          ),
        },
        {
          q: "What is your return policy?",
          a: (
            <>
              Because our products are food items, we accept returns only for items that arrive damaged,
              defective, incorrect or missing{returnSettings.returnsEnabled ? ` — reported within ${returnSettings.returnWindowDays} days of delivery` : ""}.
              See our full{" "}
              <Link href="/returns-refunds" className="font-medium text-primary hover:underline">
                Returns &amp; Refunds Policy
              </Link>{" "}
              for details.
            </>
          ),
        },
      ],
    },
    {
      heading: "Bulk, business & gifting",
      items: [
        {
          q: "How can I place a bulk order?",
          a: (
            <>
              Visit our{" "}
              <Link href="/b2b" className="font-medium text-primary hover:underline">
                Bulk &amp; Business
              </Link>{" "}
              page and submit an enquiry — our team will get back to you about pricing, quantities and
              fulfilment.
            </>
          ),
        },
        {
          q: "Do you offer corporate gifting?",
          a: (
            <>
              Yes — see our{" "}
              <Link href="/corporate-gifting" className="font-medium text-primary hover:underline">
                Corporate Gifting
              </Link>{" "}
              page or submit a{" "}
              <Link href="/b2b" className="font-medium text-primary hover:underline">
                business enquiry
              </Link>{" "}
              with your requirements.
            </>
          ),
        },
        {
          q: "How can I become a distributor?",
          a: (
            <>
              Submit your details through our{" "}
              <Link href="/b2b" className="font-medium text-primary hover:underline">
                Bulk &amp; Business
              </Link>{" "}
              form — our team will review and get in touch about territory, terms and product range.
            </>
          ),
        },
      ],
    },
    {
      heading: "Still need help?",
      items: [
        {
          q: "How can I contact Nutriyet customer care?",
          a: (
            <>
              Reach us by email at{" "}
              <a href={`mailto:${store.supportEmail}`} className="font-medium text-primary hover:underline">
                {store.supportEmail}
              </a>
              {store.whatsapp ? (
                <>
                  {" "}or via WhatsApp
                </>
              ) : null}
              , or use the{" "}
              <Link href="/contact" className="font-medium text-primary hover:underline">
                Contact page
              </Link>
              . Keep your order number handy for faster help.
            </>
          ),
        },
      ],
    },
  ];

  // Flatten for the FAQPage schema — plain-text versions of the answers
  // (schema.org wants text, not JSX; links are simplified to the question's
  // essential answer).
  const schemaItems = groups.flatMap((g) =>
    g.items.map((item) => ({
      q: item.q,
      a: typeof item.a === "string" ? item.a : flattenToText(item.a),
    })),
  );

  const sections = groups.map((g) => ({ ...g, id: slugify(g.heading) }));

  return (
    <div className={CONTENT_PAGE_CLASS}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqSchema(schemaItems))} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbSchema([{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }]),
        )}
      />
      <PageHeader
        crumbs={[{ name: "Home", href: "/" }, { name: "FAQ" }]}
        eyebrow="Help centre"
        title="Frequently asked questions"
        lede={
          <>
            Answers to the questions we hear most. Can&apos;t find what you need?{" "}
            <Link href="/contact" className="font-medium text-foreground underline underline-offset-4">
              Get in touch
            </Link>
            .
          </>
        }
      />

      <ReadingLayout
        rail={
          <TableOfContents
            variant="rail"
            headings={sections.map((g) => ({ id: g.id, text: g.heading, level: 2 as const }))}
          />
        }
      >
        <div className="space-y-12">
          {sections.map((group) => (
            <section key={group.id} aria-labelledby={group.id}>
              <h2 id={group.id} className="scroll-mt-28 font-heading text-subheading font-medium">
                {group.heading}
              </h2>
              <FaqList items={group.items} className="mt-3" />
            </section>
          ))}
        </div>
      </ReadingLayout>
    </div>
  );
}

/** Best-effort plain-text extraction from a small, known JSX answer shape —
 *  only used to feed the FAQPage schema a text string. */
function flattenToText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenToText).join("");
  if (typeof node === "object" && "props" in node) {
    return flattenToText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}
