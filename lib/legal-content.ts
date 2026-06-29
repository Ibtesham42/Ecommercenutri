/**
 * Default professional content for the legal/policy pages (privacy, terms,
 * shipping). These render until an admin overrides them via the CMS
 * (`ContentPage` rows — see lib/queries/content.ts). Keeping the defaults in
 * code means the pages always render with sane content, even with an empty DB.
 *
 * Brand-neutral placeholders: review with legal counsel before launch.
 */

export type LegalSection = { heading: string; body: string[] };

export type LegalPageContent = {
  slug: LegalSlug;
  title: string;
  intro: string;
  sections: LegalSection[];
};

export const LEGAL_SLUGS = ["privacy", "terms", "shipping"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}

export const LEGAL_CONTENT: Record<LegalSlug, LegalPageContent> = {
  shipping: {
    slug: "shipping",
    title: "Shipping & Returns",
    intro:
      "We want your wholesome nutrition to reach you quickly, safely and fresh. Here is how we ship orders and handle returns.",
    sections: [
      {
        heading: "Order processing",
        body: [
          "Orders are processed within 1–2 business days of payment confirmation. You will receive an email update each time your order status changes.",
          "Orders placed on weekends or public holidays are processed on the next business day.",
        ],
      },
      {
        heading: "Delivery timelines",
        body: [
          "Standard delivery typically takes 3–7 business days depending on your location within India. Metro cities are usually faster than remote pin codes.",
          "Free shipping is available on orders above ₹499. A flat shipping fee of ₹49 applies to orders below this threshold.",
        ],
      },
      {
        heading: "Tracking your order",
        body: [
          "You can check your order status any time from the Track Order page using your order number and email — no account required.",
          "Logged-in customers can also view full order history under Account → Orders.",
        ],
      },
      {
        heading: "Returns & replacements",
        body: [
          "Because our products are consumable food items, we accept returns only for items that arrive damaged, defective or incorrect.",
          "If something is wrong with your order, contact us within 48 hours of delivery with your order number and a photo of the issue, and we will arrange a replacement or refund.",
        ],
      },
      {
        heading: "Refunds",
        body: [
          "Approved refunds are credited to your original payment method within 5–7 business days. Shipping fees are non-refundable unless the return is due to our error.",
        ],
      },
    ],
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    intro:
      "Your privacy matters to us. This policy explains what information we collect, how we use it, and the choices you have.",
    sections: [
      {
        heading: "Information we collect",
        body: [
          "Account details you provide (name, email, phone), shipping addresses, and order history.",
          "Payment information is processed securely by our payment partner; we do not store your full card details on our servers.",
          "Usage data such as pages viewed and products browsed, used to improve the experience and our recommendations.",
        ],
      },
      {
        heading: "How we use your information",
        body: [
          "To process and deliver your orders, provide customer support, and send order-related notifications.",
          "To personalise product recommendations and, where you opt in, to send marketing updates.",
          "To detect, prevent and address fraud, abuse and security issues.",
        ],
      },
      {
        heading: "Sharing your information",
        body: [
          "We share data only with the service providers needed to run the store — for example payment, delivery, email and analytics partners — under appropriate confidentiality obligations.",
          "We never sell your personal information.",
        ],
      },
      {
        heading: "Your choices",
        body: [
          "You can access or update your profile and addresses from your account at any time.",
          "You may unsubscribe from marketing emails using the link in any such email.",
          "To request deletion of your account or data, contact our support team.",
        ],
      },
      {
        heading: "Contact",
        body: [
          "For any privacy questions or requests, reach us through the Contact page and we will respond promptly.",
        ],
      },
    ],
  },
  terms: {
    slug: "terms",
    title: "Terms of Service",
    intro:
      "These terms govern your use of our website and the purchase of products. By using the site you agree to them.",
    sections: [
      {
        heading: "Use of the site",
        body: [
          "You agree to use the site lawfully and not to misuse it, attempt to disrupt it, or access it through automated means without permission.",
          "You are responsible for keeping your account credentials confidential.",
        ],
      },
      {
        heading: "Products & pricing",
        body: [
          "We strive to describe products and display prices accurately. Prices and availability may change without notice.",
          "If a pricing or description error is discovered after you order, we will contact you and may cancel and refund the affected order.",
        ],
      },
      {
        heading: "Orders & payment",
        body: [
          "An order is confirmed once payment is successfully processed. We reserve the right to refuse or cancel any order, including for suspected fraud or stock issues.",
          "All prices are inclusive of applicable taxes unless stated otherwise.",
        ],
      },
      {
        heading: "Health disclaimer",
        body: [
          "Product and nutrition information, including any AI-assisted guidance, is provided for general informational purposes and is not a substitute for professional medical advice. Consult a qualified professional for specific dietary or health concerns.",
        ],
      },
      {
        heading: "Limitation of liability",
        body: [
          "To the maximum extent permitted by law, we are not liable for indirect or consequential damages arising from your use of the site or products.",
        ],
      },
      {
        heading: "Changes to these terms",
        body: [
          "We may update these terms from time to time. Continued use of the site after changes take effect constitutes acceptance of the revised terms.",
        ],
      },
    ],
  },
};

/** Render a built-in legal page's structured default to an HTML string — used to
 *  pre-fill the admin editor so an override starts from the existing copy. */
export function legalDefaultHtml(slug: LegalSlug): string {
  const c = LEGAL_CONTENT[slug];
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const parts: string[] = [`<p>${esc(c.intro)}</p>`];
  for (const section of c.sections) {
    parts.push(`<h2>${esc(section.heading)}</h2>`);
    for (const p of section.body) parts.push(`<p>${esc(p)}</p>`);
  }
  return parts.join("\n");
}
