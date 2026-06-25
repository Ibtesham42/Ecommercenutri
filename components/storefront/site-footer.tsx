import Link from "next/link";
import { Logo } from "@/components/storefront/logo";
import {
  InstagramIcon,
  FacebookIcon,
  YoutubeIcon,
} from "@/components/storefront/social-icons";
import { siteConfig } from "@/config/site";
import { getStoreSettings } from "@/lib/queries/settings";

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
      { label: "Track Order", href: "/account/orders" },
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
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            {siteConfig.description}
          </p>
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
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <p>
            Made with care for your health · {store.supportEmail}
          </p>
        </div>
      </div>
    </footer>
  );
}
