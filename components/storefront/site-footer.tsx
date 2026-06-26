import Link from "next/link";
import { Truck, ShieldCheck, Leaf, RotateCcw } from "lucide-react";
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
    <footer className="mt-16 border-t bg-muted/30">
      <div className="border-b">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-4 px-4 py-6 lg:grid-cols-4">
          {trustItems.map((t) => (
            <div key={t.label} className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/10 to-gold/10 text-primary">
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
          />
          <p className="max-w-xs text-sm text-muted-foreground">
            {siteConfig.description}
          </p>
          {(store.businessHours || store.address) && (
            <div className="space-y-1 text-sm text-muted-foreground">
              {store.address && <p>{store.address}</p>}
              {store.businessHours && <p>{store.businessHours}</p>}
            </div>
          )}
          <div className="flex items-center gap-3">
            <a
              href={store.instagram}
              aria-label="Instagram"
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              <InstagramIcon className="size-5" />
            </a>
            <a
              href={store.facebook}
              aria-label="Facebook"
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              <FacebookIcon className="size-5" />
            </a>
            <a
              href={store.youtube}
              aria-label="YouTube"
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              <YoutubeIcon className="size-5" />
            </a>
          </div>
        </div>

        {footerCols.map((col) => (
          <div key={col.title} className="space-y-3">
            <h3 className="text-sm font-semibold">{col.title}</h3>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-sm text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {store.siteName}. All rights reserved.
          </p>
          <p>
            Made with care for your health · {store.supportEmail}
          </p>
        </div>
      </div>
    </footer>
  );
}
