import Link from "next/link";
import { Truck, ShieldCheck, Leaf, RotateCcw, Lock, Mail } from "lucide-react";
import { Logo } from "@/components/storefront/logo";
import { NewsletterForm } from "@/components/storefront/newsletter-form";
import { FooterSection } from "@/components/storefront/footer-section";
import {
  InstagramIcon,
  FacebookIcon,
  YoutubeIcon,
} from "@/components/storefront/social-icons";
import { siteConfig } from "@/config/site";
import { getStoreSettings } from "@/lib/queries/settings";

const trustItems = [
  { icon: Truck, label: "Fast, fresh delivery" },
  { icon: ShieldCheck, label: "Secure payments" },
  { icon: Leaf, label: "100% natural" },
  { icon: RotateCcw, label: "Easy returns" },
];

const footerCols = [
  {
    title: "Shop",
    links: [
      { label: "All Products", href: "/products" },
      { label: "Categories", href: "/categories" },
      { label: "Best Sellers", href: "/products?sort=best-sellers" },
      { label: "New Arrivals", href: "/products?sort=newest" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "AI Assistant", href: "/assistant" },
      { label: "Affiliate Program", href: "/affiliate" },
      { label: "Corporate Gifting", href: "/corporate-gifting" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help & Support", href: "/support" },
      { label: "FAQ", href: "/faq" },
      { label: "Track Order", href: "/track" },
      { label: "Shipping & Returns", href: "/shipping" },
      { label: "Returns & Refunds", href: "/returns-refunds" },
    ],
  },
];

// Policy pages live in the bottom bar (the conventional spot) rather than
// padding out the Support column.
const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Policy", href: "/cookie-policy" },
  { label: "Disclaimer", href: "/disclaimer" },
];

// Mirrors the methods the checkout advertises for Razorpay — keep in sync.
const paymentMethods = ["UPI", "Cards", "Net banking", "Wallets"];

const linkClass =
  "rounded-sm text-[14px] text-surface-deep-foreground/70 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/60";

const socialClass =
  "grid size-10 place-items-center rounded-full border border-surface-deep-foreground/20 text-surface-deep-foreground/80 transition-colors hover:border-gold/60 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/60";

export async function SiteFooter() {
  const store = await getStoreSettings();
  return (
    <footer className="mt-12" data-heat="footer">
      {/* Newsletter card — overlaps the top edge of the green chrome by a fixed
          4rem (the green block's -mt-16), so the seam lands mid-card on
          desktop and near the bottom of the taller stacked card on phones. */}
      <div className="shop-container relative z-10">
        <div className="grid items-center gap-5 rounded-2xl border border-border bg-oat px-5 py-6 shadow-elev-2 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-10 lg:px-10 lg:py-8">
          <div className="flex items-start gap-5">
            <Leaf
              aria-hidden
              strokeWidth={1.5}
              className="mt-1 hidden size-10 shrink-0 text-primary sm:block"
            />
            <div>
              <h3 className="font-heading text-2xl leading-tight font-medium tracking-tight text-foreground sm:text-[1.75rem]">
                Eat clean, stay in the know
              </h3>
              <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                Join the Nutriyet list for new launches, recipes and member-only offers.
              </p>
            </div>
          </div>
          <div className="space-y-2.5">
            <NewsletterForm source="footer" tone="light" />
            <p className="text-[13px] text-muted-foreground">No spam, ever.</p>
          </div>
        </div>
      </div>

      {/* Below md a fixed bar (tab bar, or the PDP/cart/checkout sticky bar) covers the
          bottom of the viewport; the padding keeps the last footer lines clear of it. */}
      <div className="surface-rich -mt-16 pt-16 text-surface-deep-foreground max-md:pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <div className="shop-container grid gap-x-10 pt-12 pb-4 md:grid-cols-4 md:gap-y-12 md:pb-12 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.8fr))_minmax(0,1.1fr)] lg:pt-14">
          {/* Brand */}
          <div className="space-y-5 pb-8 md:col-span-4 md:pb-0 lg:col-span-1">
            <Logo
              logoUrl={store.logo}
              name={store.siteName}
              height={store.logoHeight}
              mobileHeight={store.logoHeightMobile}
              maxWidth={store.logoMaxWidth}
              accentClassName="text-gold"
              onDark
            />
            <p className="max-w-sm text-[14px] leading-relaxed text-surface-deep-foreground/70">
              {store.metaDescription || siteConfig.description}
            </p>
            {(store.businessHours || store.address) && (
              <div className="space-y-1 text-[14px] text-surface-deep-foreground/70">
                {store.address && <p>{store.address}</p>}
                {store.businessHours && <p>{store.businessHours}</p>}
              </div>
            )}
            <div className="flex items-center gap-3">
              <a href={store.instagram} aria-label="Instagram" className={socialClass}>
                <InstagramIcon className="size-[18px]" />
              </a>
              <a href={store.facebook} aria-label="Facebook" className={socialClass}>
                <FacebookIcon className="size-[18px]" />
              </a>
              <a href={store.youtube} aria-label="YouTube" className={socialClass}>
                <YoutubeIcon className="size-[18px]" />
              </a>
            </div>
          </div>

          {footerCols.map((col, i) => (
            <FooterSection
              key={col.title}
              title={col.title}
              className={
                i === 0
                  ? "max-md:border-t max-md:border-white/10 lg:border-l lg:border-white/10 lg:pl-10"
                  : undefined
              }
            >
              <ul className="space-y-2.5 max-md:space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterSection>
          ))}

          <FooterSection title="Our promise" className="lg:border-l lg:border-white/10 lg:pl-10">
            <ul className="space-y-3.5">
              {trustItems.map((t) => (
                <li key={t.label} className="flex items-center gap-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-gold/45 text-gold">
                    <t.icon className="size-[18px]" strokeWidth={1.6} aria-hidden />
                  </span>
                  <span className="text-[14px] font-medium">{t.label}</span>
                </li>
              ))}
            </ul>
          </FooterSection>
        </div>

        {/* Contact + accepted payments */}
        <div className="shop-container">
          <div className="flex flex-col gap-5 border-t border-white/10 py-6 lg:flex-row lg:items-center lg:justify-between">
            {store.supportEmail && (
              <a
                href={`mailto:${store.supportEmail}`}
                className="inline-flex items-center gap-2.5 self-start rounded-sm text-[14px] text-surface-deep-foreground/80 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/60"
              >
                <Mail className="size-4 text-gold" strokeWidth={1.75} aria-hidden />
                {store.supportEmail}
              </a>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className="inline-flex items-center gap-2 text-[13px] font-medium text-surface-deep-foreground/80">
                <Lock className="size-4 text-gold" strokeWidth={1.75} aria-hidden />
                Pay securely via Razorpay
              </span>
              <ul
                aria-label="Accepted payment methods"
                className="flex items-center divide-x divide-surface-deep/15 rounded-lg bg-surface-deep-foreground px-1 py-1.5"
              >
                {paymentMethods.map((m) => (
                  <li key={m} className="px-2.5 text-[12px] font-semibold text-surface-deep">
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10">
          <div className="shop-container flex flex-col items-center gap-3 py-5 text-[13px] text-surface-deep-foreground/60 lg:flex-row lg:justify-between">
            <p>
              © {new Date().getFullYear()} {store.siteName}. All rights reserved.
            </p>
            <nav aria-label="Legal">
              <ul className="grid grid-cols-2 gap-x-8 gap-y-2 text-center lg:flex lg:items-center lg:gap-0">
                {legalLinks.map((link) => (
                  <li
                    key={link.href}
                    className="lg:not-last:after:mx-3 lg:not-last:after:text-surface-deep-foreground/25 lg:not-last:after:content-['|']"
                  >
                    <Link href={link.href} className="rounded-sm transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/60">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <p className="inline-flex items-center gap-2">
              <Leaf className="size-3.5 text-gold" strokeWidth={1.75} aria-hidden />
              Made with care for your health
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
