"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Heart, Menu, User, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CategoryMegaMenu,
  CategoryThumb,
  navLinkClass,
  type CategoryNavNode,
} from "@/components/storefront/category-mega-menu";
import { Logo } from "@/components/storefront/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { CartIcon } from "@/components/storefront/cart-icon";
import { SearchBox } from "@/components/storefront/search-box";
import { MobileSearchTrigger } from "@/components/storefront/mobile-search-trigger";
import { DeliverTo } from "@/components/storefront/deliver-to";
import { NotificationBell, type BellNotification } from "@/components/account/notification-bell";
import { SigninSpotlight } from "@/components/storefront/onboarding/signin-spotlight";

/** The single primary row — five destinations, all existing routes. Best
 *  sellers / New arrivals / Offers live in the Categories flyout + drawer;
 *  Contact under Help; the AI assistant in search, the drawer and the footer. */
const PRIMARY_NAV = [
  { title: "Shop", href: "/products" },
  { title: "Categories", href: "/categories" },
  { title: "Our Story", href: "/about" },
  { title: "Journal", href: "/blog" },
  { title: "Bulk / B2B", href: "/b2b" },
] as const;

const DRAWER_COLLECTIONS = [
  { title: "Best sellers", href: "/products?sort=best-sellers" },
  { title: "New arrivals", href: "/new-arrivals" },
  { title: "Offers", href: "/offers" },
] as const;

const DRAWER_HELP = [
  { title: "Track order", href: "/track" },
  { title: "Help & support", href: "/support" },
  { title: "Contact us", href: "/contact" },
] as const;

/** Quiet icon button used across the header (44px tall touch target). */
const iconBtn =
  "relative grid h-11 w-9 shrink-0 place-items-center rounded-md text-foreground/80 transition-colors hover:text-foreground min-[400px]:w-10 lg:size-10 [&_svg]:size-[21px] lg:[&_svg]:size-5";

export function SiteHeader({
  logoUrl,
  siteName,
  logoHeight,
  logoHeightMobile,
  logoMaxWidth,
  notifications,
  unreadCount = 0,
  isLoggedIn = false,
  categories = [],
  freeShippingThreshold,
  freeShippingEnabled = true,
}: {
  logoUrl?: string | null;
  siteName?: string;
  logoHeight?: number | null;
  logoHeightMobile?: number | null;
  logoMaxWidth?: number | null;
  notifications?: BellNotification[];
  unreadCount?: number;
  isLoggedIn?: boolean;
  categories?: CategoryNavNode[];
  /** Paise — StoreSetting.freeShippingThreshold, passed through to DeliverTo. */
  freeShippingThreshold?: number | null;
  freeShippingEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Query-bearing links share a path with their base link, so they're never
  // path-highlighted (useSearchParams would deopt this layout-mounted header).
  const isActiveNav = (href: string) => {
    if (href.includes("?")) return false;
    return pathname === href || pathname.startsWith(href + "/");
  };
  const logoSize = {
    height: logoHeight,
    mobileHeight: logoHeightMobile,
    maxWidth: logoMaxWidth,
  };
  const close = () => setOpen(false);
  const accountHref = isLoggedIn ? "/account" : "/login";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      {/* ---------------------------------------------------------- mobile -- */}
      {/* Equal flexible side columns keep the wordmark truly centred. */}
      <div className="grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-2 min-[375px]:px-3 lg:hidden">
        <div className="flex items-center">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button type="button" className={cn(iconBtn, "-ml-1")} aria-label="Open menu">
                <Menu strokeWidth={1.6} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(86vw,22rem)] gap-0 p-0">
              <SheetHeader className="border-b border-border px-5 py-4 pr-14">
                <SheetTitle asChild>
                  <Logo
                    logoUrl={logoUrl}
                    name={siteName}
                    className="min-w-0 text-xl font-semibold"
                    {...logoSize}
                  />
                </SheetTitle>
              </SheetHeader>

              <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <ul className="px-5 pt-2">
                  {PRIMARY_NAV.map((item) => {
                    const active = isActiveNav(item.href);
                    if (item.href === "/categories" && categories.length > 0) {
                      return (
                        <li key={item.href} className="border-b border-border/70">
                          <Accordion type="single" collapsible>
                            <AccordionItem value="categories" className="border-b-0">
                              <AccordionTrigger
                                className={cn(
                                  "py-3.5 font-heading text-[1.375rem] font-normal leading-tight hover:no-underline",
                                  active ? "text-primary" : "text-foreground",
                                )}
                              >
                                {item.title}
                              </AccordionTrigger>
                              <AccordionContent className="pb-4">
                                <ul className="space-y-3">
                                  {categories.map((category) => (
                                    <li key={category.id}>
                                      <Link
                                        href={`/categories/${category.slug}`}
                                        onClick={close}
                                        className="flex items-center gap-3 text-[15px] text-foreground !no-underline hover:text-primary"
                                      >
                                        <CategoryThumb
                                          name={category.name}
                                          image={category.image}
                                          className="size-10"
                                        />
                                        {category.name}
                                      </Link>
                                      {category.children.length > 0 && (
                                        <ul className="mt-2 space-y-1.5 pl-[3.25rem]">
                                          {category.children.map((child) => (
                                            <li key={child.id}>
                                              <Link
                                                href={`/categories/${child.slug}`}
                                                onClick={close}
                                                className="text-sm text-muted-foreground !no-underline hover:text-foreground"
                                              >
                                                {child.name}
                                              </Link>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </li>
                                  ))}
                                  <li>
                                    <Link
                                      href="/categories"
                                      onClick={close}
                                      className="inline-flex items-center gap-1 text-sm font-medium text-primary !no-underline"
                                    >
                                      View all categories <ArrowRight className="size-3.5" />
                                    </Link>
                                  </li>
                                </ul>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </li>
                      );
                    }
                    return (
                      <li key={item.href} className="border-b border-border/70">
                        <Link
                          href={item.href}
                          onClick={close}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "block py-3.5 font-heading text-[1.375rem] leading-tight transition-colors",
                            active ? "text-primary" : "text-foreground hover:text-primary",
                          )}
                        >
                          {item.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                <DrawerGroup label="Collections" items={DRAWER_COLLECTIONS} onNavigate={close} />
                <DrawerGroup label="Help" items={DRAWER_HELP} onNavigate={close} />

                <div className="mt-auto space-y-4 border-t border-border bg-oat/50 px-5 py-5">
                  <DeliverTo
                    className="px-0 py-0 text-sm hover:bg-transparent"
                    freeShippingThreshold={freeShippingThreshold}
                    freeShippingEnabled={freeShippingEnabled}
                  />
                  <Link
                    href={accountHref}
                    onClick={close}
                    className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
                  >
                    <User className="size-4" strokeWidth={1.75} />
                    {isLoggedIn ? "My account" : "Sign in or create account"}
                  </Link>
                  <div className="flex items-center justify-between">
                    <Link
                      href="/assistant"
                      onClick={close}
                      className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Ask Nutriyet AI
                    </Link>
                    <ThemeToggle />
                  </div>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        <Logo
          logoUrl={logoUrl}
          name={siteName}
          // Cap the admin logo height inside the 56px row so the mark +
          // wordmark always fit between the side columns (desktop is uncapped).
          className="min-h-11 min-w-0 justify-self-center gap-1.5 text-lg font-semibold min-[400px]:text-xl [&_img]:max-h-9"
          wordmarkClassName="hidden min-[360px]:inline"
          {...logoSize}
        />

        <div className="flex items-center justify-end" data-heat="search-bar">
          <MobileSearchTrigger variant="icon" className={iconBtn} />
          <Link href="/account/wishlist" className={iconBtn} aria-label="Wishlist">
            <Heart strokeWidth={1.6} />
          </Link>
          <Link href="/cart" className={cn(iconBtn, "-mr-1")} aria-label="Cart">
            <CartIcon />
          </Link>
        </div>
      </div>

      {/* --------------------------------------------------------- desktop -- */}
      <div className="mx-auto hidden h-20 w-full max-w-7xl items-center gap-6 px-4 lg:flex xl:gap-10">
        <Logo
          logoUrl={logoUrl}
          name={siteName}
          className="shrink-0 text-2xl font-semibold"
          {...logoSize}
        />

        <nav aria-label="Primary" data-heat="header-nav" className="flex items-center gap-5 xl:gap-7 2xl:gap-9">
          {PRIMARY_NAV.map((item) => {
            const active = isActiveNav(item.href);
            if (item.href === "/categories" && categories.length > 0) {
              return <CategoryMegaMenu key={item.href} categories={categories} active={active} />;
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(navLinkClass(active), "whitespace-nowrap")}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <div className="mr-2 w-52 xl:mr-4 xl:w-80 2xl:w-96" data-heat="search-bar">
            <SearchBox inputClassName="h-10 border-border bg-oat/50 text-sm shadow-none placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:shadow-none focus-visible:ring-2 focus-visible:ring-primary/15" />
          </div>
          {isLoggedIn ? (
            <Link href="/account" className={iconBtn} aria-label="Account">
              <User strokeWidth={1.6} />
            </Link>
          ) : (
            <SigninSpotlight>
              <Link href="/login" className={iconBtn} aria-label="Sign in">
                <User strokeWidth={1.6} />
              </Link>
            </SigninSpotlight>
          )}
          <Link href="/account/wishlist" className={iconBtn} aria-label="Wishlist">
            <Heart strokeWidth={1.6} />
          </Link>
          {notifications && (
            <NotificationBell initialUnread={unreadCount} items={notifications} />
          )}
          <Link href="/cart" className={cn(iconBtn, "-mr-2")} aria-label="Cart">
            <CartIcon />
          </Link>
        </div>
      </div>
    </header>
  );
}

function DrawerGroup({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: readonly { title: string; href: string }[];
  onNavigate: () => void;
}) {
  return (
    <div className="px-5 pt-6">
      <p className="eyebrow">{label}</p>
      <ul className="mt-3 space-y-2.5 pb-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className="text-[15px] text-foreground/85 transition-colors hover:text-primary"
            >
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
