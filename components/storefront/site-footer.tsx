import Link from "next/link";
import { Truck, ShieldCheck, Leaf, RotateCcw, Send } from "lucide-react";
import { Logo } from "@/components/storefront/logo";
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
      { label: "Contact", href: "/contact" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help & Support", href: "/support" },
      { label: "Track Order", href: "/track" },
      { label: "Shipping & Returns", href: "/shipping" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

export async function SiteFooter() {
  const store = await getStoreSettings();
  return (
    <footer className="mt-16 bg-surface-deep text-surface-deep-foreground">
      {/* Newsletter CTA */}
      <div className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-md">
            <h3 className="font-heading text-2xl font-semibold">
              Eat clean, stay in the know
            </h3>
            <p className="mt-1.5 text-sm text-surface-deep-foreground/70">
              Join the Nutriyet list for new launches, recipes and member-only
              offers. No spam, ever.
            </p>
          </div>
          <form className="flex w-full max-w-md items-center gap-2">
            <label htmlFor="footer-newsletter" className="sr-only">
              Email address
            </label>
            <input
              id="footer-newsletter"
              type="email"
              placeholder="Your email address"
              className="h-12 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-surface-deep-foreground placeholder:text-surface-deep-foreground/50 outline-none transition focus:border-gold/60 focus:ring-2 focus:ring-gold/30"
            />
            <button
              type="button"
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-bold text-gold-foreground transition-transform hover:brightness-105 active:scale-95"
            >
              Subscribe
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Trust bar */}
      <div className="border-b border-white/10">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-4 px-4 py-6 lg:grid-cols-4">
          {trustItems.map((t) => (
            <div key={t.label} className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-gold">
                <t.icon className="size-5" />
              </span>
              <span className="text-sm font-medium">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo
            logoUrl={store.logo}
            name={store.siteName}
            height={store.logoHeight}
            mobileHeight={store.logoHeightMobile}
            maxWidth={store.logoMaxWidth}
            accentClassName="text-gold"
            onDark
          />
          <p className="max-w-xs text-sm text-surface-deep-foreground/70">
            {siteConfig.description}
          </p>
          {(store.businessHours || store.address) && (
            <div className="space-y-1 text-sm text-surface-deep-foreground/70">
              {store.address && <p>{store.address}</p>}
              {store.businessHours && <p>{store.businessHours}</p>}
            </div>
          )}
          <div className="flex items-center gap-3">
            <a
              href={store.instagram}
              aria-label="Instagram"
              className="text-surface-deep-foreground/70 transition-colors hover:text-gold"
            >
              <InstagramIcon className="size-5" />
            </a>
            <a
              href={store.facebook}
              aria-label="Facebook"
              className="text-surface-deep-foreground/70 transition-colors hover:text-gold"
            >
              <FacebookIcon className="size-5" />
            </a>
            <a
              href={store.youtube}
              aria-label="YouTube"
              className="text-surface-deep-foreground/70 transition-colors hover:text-gold"
            >
              <YoutubeIcon className="size-5" />
            </a>
          </div>
        </div>

        {footerCols.map((col) => (
          <div key={col.title} className="space-y-3">
            <h3 className="text-sm font-semibold text-surface-deep-foreground">
              {col.title}
            </h3>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-surface-deep-foreground/70 transition-colors hover:text-gold"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-sm text-surface-deep-foreground/60 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {store.siteName}. All rights reserved.
          </p>
          <p>Made with care for your health · {store.supportEmail}</p>
        </div>
      </div>
    </footer>
  );
}
