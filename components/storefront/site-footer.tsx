import Link from "next/link";
import { Truck, ShieldCheck, Leaf, RotateCcw, Lock, Mail } from "lucide-react";
import { Logo } from "@/components/storefront/logo";
import { NewsletterForm } from "@/components/storefront/newsletter-form";
import { FooterSection } from "@/components/storefront/footer-section";
import { PaymentMarks } from "@/components/storefront/payment-marks";
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

// Below md the links sit in accordions — `block py-2.5` gives each a ~40px tap row.
const linkClass =
  "rounded-sm text-[14px] max-md:block max-md:py-2.5 text-surface-deep-foreground/70 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/60";

const socialClass =
  "grid size-11 place-items-center md:size-10 rounded-full border border-surface-deep-foreground/20 text-surface-deep-foreground/80 transition-colors hover:border-gold/60 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/60";

export async function SiteFooter() {
  const store = await getStoreSettings();
  return (
    <footer className="mt-12 max-sm:mt-10 max-sm:bg-surface-deep max-sm:pt-8" data-heat="footer">
      {/* Newsletter card — from sm it overlaps the top edge of the green chrome
          by a fixed 4rem (the green block's -mt-16) so the seam lands mid-card.
          The stacked phone card is too tall for a clean seam, so there it sits
          wholly inside the green (the footer itself takes the fill). */}
      <div className="shop-container relative z-10">
        <div className="grid items-center gap-5 rounded-2xl border border-border bg-oat px-5 py-6 shadow-elev-2 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-10 lg:px-10 lg:py-8">
          <div className="flex items-start gap-5">
            <Leaf
              aria-hidden
              strokeWidth={1.5}
              className="mt-1 hidden size-10 shrink-0 text-primary lg:block"
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
      <div className="surface-rich sm:-mt-16 sm:pt-16 text-surface-deep-foreground max-md:pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <div className="shop-container grid gap-x-10 pt-12 md:grid-cols-3 md:gap-y-12 md:pb-12 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.8fr))_minmax(0,1.1fr)] lg:pt-14">
          {/* Brand */}
          <div className="space-y-5 pb-8 md:col-span-3 md:pb-0 lg:col-span-1">
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
              <ul className="space-y-2.5 max-md:-mt-1 max-md:space-y-0">
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

          {/* Trust promises stay visible on phones (a 2×2 badge grid rather than
              a fourth accordion); at md they span the row under the link columns. */}
          <div className="py-8 md:col-span-3 md:border-t md:border-white/10 md:pt-10 md:pb-0 lg:col-span-1 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
            <h3 className="text-[15px] font-semibold text-surface-deep-foreground">Our promise</h3>
            <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6 lg:grid-cols-1 lg:gap-3.5">
              {trustItems.map((t) => (
                <li
                  key={t.label}
                  className="flex items-center gap-2.5 max-md:rounded-xl max-md:border max-md:border-white/10 max-md:bg-white/[0.03] max-md:p-3 md:gap-3.5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border border-gold/45 text-gold md:size-10">
                    <t.icon className="size-4 md:size-[18px]" strokeWidth={1.6} aria-hidden />
                  </span>
                  <span className="text-[13px] leading-snug font-medium md:text-[14px]">{t.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Contact + accepted payments */}
        <div className="shop-container">
          <div className="flex flex-col gap-4 border-t border-white/10 py-6 md:flex-row md:items-center md:justify-between">
            {store.supportEmail && (
              <a
                href={`mailto:${store.supportEmail}`}
                className="inline-flex min-h-10 items-center gap-2.5 self-start rounded-sm text-[14px] text-surface-deep-foreground/80 transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/60"
              >
                <Mail className="size-4 text-gold" strokeWidth={1.75} aria-hidden />
                {store.supportEmail}
              </a>
            )}
            <div className="flex flex-col gap-3 md:items-end">
              <span className="inline-flex items-center gap-2 text-[13px] font-medium text-surface-deep-foreground/80">
                <Lock className="size-4 text-gold" strokeWidth={1.75} aria-hidden />
                Pay securely via Razorpay
              </span>
              <PaymentMarks />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10">
          <div className="shop-container flex flex-col items-start gap-3 py-5 text-[13px] text-surface-deep-foreground/60 lg:flex-row lg:items-center lg:justify-between">
            <p>
              © {new Date().getFullYear()} {store.siteName}. All rights reserved.
            </p>
            <nav aria-label="Legal">
              <ul className="grid grid-cols-2 gap-x-6 sm:flex sm:flex-wrap sm:items-center lg:gap-x-0">
                {legalLinks.map((link) => (
                  <li
                    key={link.href}
                    className="lg:not-last:after:mx-3 lg:not-last:after:text-surface-deep-foreground/25 lg:not-last:after:content-['|']"
                  >
                    <Link href={link.href} className="inline-flex min-h-10 items-center rounded-sm transition-colors lg:min-h-0 hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/60">
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
