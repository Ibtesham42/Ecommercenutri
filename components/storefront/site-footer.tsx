import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { Logo } from "@/components/storefront/logo";
import { NewsletterForm } from "@/components/storefront/newsletter-form";
import { FooterSection } from "@/components/storefront/footer-section";
import { FooterInstallLink } from "@/components/storefront/footer-install-link";
import { PaymentMarks } from "@/components/storefront/payment-marks";
import { KachniRule } from "@/components/storefront/mithila-fish";
import { InstagramIcon, FacebookIcon, YoutubeIcon } from "@/components/storefront/social-icons";
import { siteConfig } from "@/config/site";
import { getStoreSettings } from "@/lib/queries/settings";
import { getPwaSettings } from "@/lib/pwa-settings";

/** Brand statement — from the Nutriyet brand documents (no product claims). */
const BRAND_LINE =
  "Authentic Indian foods, rooted in Bihar and Mithila — makhana, desi spices and everyday staples, thoughtfully prepared and carefully packed.";

const footerCols = [
  {
    title: "Shop",
    links: [
      { label: "All products", href: "/products" },
      { label: "Categories", href: "/categories" },
      { label: "Best sellers", href: "/products?sort=best-sellers" },
      { label: "New arrivals", href: "/new-arrivals" },
      { label: "Offers", href: "/offers" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Our story", href: "/about" },
      { label: "Journal", href: "/blog" },
      { label: "Bulk & B2B", href: "/b2b" },
      { label: "Corporate gifting", href: "/corporate-gifting" },
      { label: "Affiliate program", href: "/affiliate" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Help & support", href: "/support" },
      { label: "FAQ", href: "/faq" },
      { label: "Track an order", href: "/track" },
      { label: "Shipping policy", href: "/shipping" },
      { label: "Returns & refunds", href: "/returns-refunds" },
      { label: "Ask Nutriyet AI", href: "/assistant" },
    ],
  },
];

const legalLinks = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Cookies", href: "/cookie-policy" },
  { label: "Disclaimer", href: "/disclaimer" },
];

// Below md the links sit in accordions — `block py-2.5` gives each a 44px tap row.
const linkClass =
  "rounded-sm text-[14px] text-surface-deep-foreground/75 transition-colors hover:text-surface-deep-foreground hover:underline hover:underline-offset-4 max-md:block max-md:py-2.5 md:inline-block md:py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/60";

const socialClass =
  "grid size-11 place-items-center rounded-full border border-surface-deep-foreground/20 text-surface-deep-foreground/80 transition-colors hover:border-surface-deep-foreground/60 hover:text-surface-deep-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/60";

export async function SiteFooter() {
  const [store, pwa] = await Promise.all([getStoreSettings(), getPwaSettings()]);
  const waDigits = store.whatsapp?.replace(/[^\d]/g, "");
  const socials = [
    { href: store.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: store.facebook, label: "Facebook", Icon: FacebookIcon },
    { href: store.youtube, label: "YouTube", Icon: YoutubeIcon },
  ].filter((s) => s.href);

  return (
    <footer
      data-heat="footer"
      className="mt-16 bg-surface-deep text-surface-deep-foreground max-md:pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:mt-24"
    >
      <div className="shop-container pt-12 lg:pt-16">
        {/* Newsletter — folded into the footer, not a floating card. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-end lg:gap-16">
          <div>
            <h2 className="font-heading text-[1.75rem] leading-[1.1] font-normal tracking-[-0.015em] text-surface-deep-foreground sm:text-[2.125rem]">
              From our roots to your routine.
            </h2>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-surface-deep-foreground/75">
              New launches, recipes and member offers from the Nutriyet kitchen.
            </p>
          </div>
          <div className="space-y-2.5">
            <NewsletterForm source="footer" tone="footer" />
            <p className="text-[13px] text-surface-deep-foreground/60">No spam, ever. Unsubscribe any time.</p>
          </div>
        </div>

        <KachniRule className="kachni-on-deep my-10 lg:my-14" />

        <div className="grid gap-x-10 md:grid-cols-3 md:gap-y-12 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,0.8fr))]">
          <div className="space-y-5 pb-8 md:col-span-3 md:pb-0 lg:col-span-1 lg:pr-8">
            <Logo
              logoUrl={store.logo}
              name={store.siteName}
              height={store.logoHeight}
              mobileHeight={store.logoHeightMobile}
              maxWidth={store.logoMaxWidth}
              accentClassName="text-gold"
              className="gap-2.5 text-2xl font-medium"
              onDark
            />
            <p className="max-w-sm text-[14px] leading-relaxed text-surface-deep-foreground/75">{BRAND_LINE}</p>
            {(store.address || store.businessHours) && (
              <div className="space-y-0.5 text-[14px] text-surface-deep-foreground/75">
                {store.address && <p>{store.address}</p>}
                {store.businessHours && <p>{store.businessHours}</p>}
              </div>
            )}
            {socials.length > 0 && (
              <div className="flex items-center gap-2.5">
                {socials.map(({ href, label, Icon }) => (
                  <a key={label} href={href!} aria-label={label} className={socialClass}>
                    <Icon className="size-[18px]" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {footerCols.map((col, i) => (
            <FooterSection
              key={col.title}
              title={col.title}
              className={i === 0 ? "max-md:border-t max-md:border-white/10" : undefined}
            >
              <ul className="space-y-1 max-md:-mt-1 max-md:space-y-0">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
                {col.title === "Help" && (
                  <li>
                    <FooterInstallLink
                      copy={{ title: pwa.title, description: pwa.description }}
                      className={`${linkClass} text-left max-md:w-full`}
                    />
                  </li>
                )}
              </ul>
            </FooterSection>
          ))}
        </div>

        {/* Contact · assurance · accepted payments */}
        <div className="mt-8 flex flex-col gap-5 border-t border-white/10 py-7 md:mt-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-7">
            {store.supportEmail && (
              <a
                href={`mailto:${store.supportEmail}`}
                className="inline-flex min-h-11 items-center gap-2.5 rounded-sm text-[14px] text-surface-deep-foreground/85 transition-colors hover:text-surface-deep-foreground"
              >
                <Mail className="size-4 text-gold" strokeWidth={1.6} aria-hidden />
                {store.supportEmail}
              </a>
            )}
            {waDigits && (
              <a
                href={`https://wa.me/${waDigits}?text=${encodeURIComponent(`Hi ${siteConfig.name}, I have a question.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2.5 rounded-sm text-[14px] text-surface-deep-foreground/85 transition-colors hover:text-surface-deep-foreground"
              >
                <MessageCircle className="size-4 text-gold" strokeWidth={1.6} aria-hidden />
                WhatsApp support
              </a>
            )}
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <p className="text-[13px] text-surface-deep-foreground/75">
              Secure payments via Razorpay <span aria-hidden className="px-1.5 text-gold">·</span> Pan-India delivery{" "}
              <span aria-hidden className="px-1.5 text-gold">·</span> Easy returns
            </p>
            <PaymentMarks />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="shop-container flex flex-col gap-3 py-5 text-[13px] text-surface-deep-foreground/60 lg:flex-row lg:items-center lg:justify-between">
          <p>
            © {new Date().getFullYear()} {store.siteName} · A brand of Brand Mithila Ventures Private Limited
          </p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap items-center gap-x-6">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center rounded-sm transition-colors hover:text-surface-deep-foreground lg:min-h-0"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
