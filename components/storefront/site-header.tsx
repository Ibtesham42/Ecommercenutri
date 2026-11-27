"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Heart, Menu, User, ArrowRight, Download, Package, LifeBuoy, MessageCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  CategoryMegaMenu,
  CategoryThumb,
  navLinkClass,
  type CategoryNavNode,
} from "@/components/storefront/category-mega-menu";
import { Logo } from "@/components/storefront/logo";
import { MithilaFish } from "@/components/storefront/mithila-fish";
import { ThemeToggle } from "@/components/theme-toggle";
import { CartIcon } from "@/components/storefront/cart-icon";
import { SearchBox } from "@/components/storefront/search-box";
import { MobileSearchTrigger } from "@/components/storefront/mobile-search-trigger";
import { DeliverTo } from "@/components/storefront/deliver-to";
import { NotificationBell, type BellNotification } from "@/components/account/notification-bell";
import { SigninSpotlight } from "@/components/storefront/onboarding/signin-spotlight";
import { useInstallApp, type InstallCopy } from "@/components/storefront/install-app";
import { PWA_DEFAULTS } from "@/lib/pwa-config";
import { siteConfig } from "@/config/site";

/** Inline nav after "Shop" (tablet + desktop). Collections join from xl. */
const PRIMARY_NAV = [
  { title: "Best sellers", href: "/products?sort=best-sellers", from: "xl" },
  { title: "New arrivals", href: "/new-arrivals", from: "xl" },
  { title: "Our Story", href: "/about" },
  { title: "Journal", href: "/blog" },
  { title: "Bulk & B2B", href: "/b2b" },
] as const;

const DRAWER_COLLECTIONS = [
  { title: "Best sellers", href: "/products?sort=best-sellers" },
  { title: "New arrivals", href: "/new-arrivals" },
  { title: "Offers", href: "/offers" },
] as const;

const DRAWER_DISCOVER = [
  { title: "Our Story", href: "/about" },
  { title: "Journal", href: "/blog" },
  { title: "Bulk & B2B enquiries", href: "/b2b" },
] as const;

/** Quiet 44px icon button used across the header. */
const iconBtn =
  "relative grid size-11 shrink-0 place-items-center text-foreground/85 transition-colors hover:text-foreground [&_svg]:size-[21px]";

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
  installCopy = PWA_DEFAULTS,
  whatsapp,
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
  /** Heading + intro of the Install App instructions (admin-editable). */
  installCopy?: InstallCopy;
  /** Store WhatsApp number — drawer support link. */
  whatsapp?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const install = useInstallApp(installCopy);
  const showInstall = !install.state.standalone;
  const pathname = usePathname();
  // Query-bearing links share a path with their base link, so they're never
  // path-highlighted (useSearchParams would deopt this layout-mounted header).
  const isActiveNav = (href: string) => {
    if (href.includes("?")) return false;
    return pathname === href || pathname.startsWith(href + "/");
  };
  const shopActive = pathname.startsWith("/products") || pathname.startsWith("/categories");
  const logoSize = { height: logoHeight, mobileHeight: logoHeightMobile, maxWidth: logoMaxWidth };
  const close = () => setOpen(false);
  const accountHref = isLoggedIn ? "/account" : "/login";
  const waDigits = whatsapp?.replace(/[^\d]/g, "");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      {/* ----------------------------------------------------------- phone -- */}
      {/* Menu · centred logo · cart. Search lives in the bottom tab bar. */}
      <div className="grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-1.5 min-[375px]:px-2 md:hidden">
        <div className="flex items-center">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button type="button" className={iconBtn} aria-label="Open menu">
                <Menu strokeWidth={1.5} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(88vw,24rem)] gap-0 border-r-0 bg-popover p-0">
              <SheetHeader className="h-14 justify-center border-b border-border px-4 py-0 pr-14">
                <SheetTitle asChild>
                  <Logo
                    logoUrl={logoUrl}
                    name={siteName}
                    className="min-w-0 gap-2 text-xl font-medium [&_img]:max-h-8"
                    {...logoSize}
                  />
                </SheetTitle>
              </SheetHeader>

              <nav aria-label="Menu" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {categories.length > 0 && (
                  <div className="px-4 pt-5">
                    <p className="eyebrow flex items-center gap-2.5">
                      <MithilaFish />
                      Shop
                    </p>
                    <ul className="mt-2">
                      {categories.map((category) => {
                        const active = isActiveNav(`/categories/${category.slug}`);
                        return (
                          <li key={category.id} className="border-b border-border">
                            <Link
                              href={`/categories/${category.slug}`}
                              onClick={close}
                              aria-current={active ? "page" : undefined}
                              className="flex min-h-14 items-center gap-3.5 py-1.5"
                            >
                              <CategoryThumb name={category.name} image={category.image} />
                              <span
                                className={cn(
                                  "min-w-0 flex-1 font-heading text-[1.0625rem] leading-snug",
                                  active ? "text-primary" : "text-foreground",
                                )}
                              >
                                {category.name}
                              </span>
                              <span className="text-xs tabular-nums text-muted-foreground">
                                {category.productCount}
                              </span>
                            </Link>
                            {category.children.length > 0 && (
                              <ul className="-mt-1 space-y-1 pb-3 pl-[3.6rem]">
                                {category.children.map((child) => (
                                  <li key={child.id}>
                                    <Link
                                      href={`/categories/${child.slug}`}
                                      onClick={close}
                                      className="block py-1 text-sm text-muted-foreground hover:text-foreground"
                                    >
                                      {child.name}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                      <li>
                        <Link
                          href="/products"
                          onClick={close}
                          className="flex min-h-12 items-center justify-between text-[15px] font-semibold text-foreground"
                        >
                          All products <ArrowRight className="size-4" aria-hidden />
                        </Link>
                      </li>
                    </ul>
                  </div>
                )}

                <DrawerGroup label="Collections" items={DRAWER_COLLECTIONS} onNavigate={close} isActive={isActiveNav} />
                <DrawerGroup label="Discover" items={DRAWER_DISCOVER} onNavigate={close} isActive={isActiveNav} />

                <div className="mt-auto grid gap-0.5 border-t border-border px-4 pb-6 pt-3">
                  <DrawerAction href={accountHref} onClick={close} icon={User}>
                    {isLoggedIn ? "My account" : "Sign in or create account"}
                  </DrawerAction>
                  <DrawerAction href="/account/wishlist" onClick={close} icon={Heart}>
                    Wishlist
                  </DrawerAction>
                  <DrawerAction href="/track" onClick={close} icon={Package}>
                    Track an order
                  </DrawerAction>
                  <DrawerAction href="/support" onClick={close} icon={LifeBuoy}>
                    Help &amp; support
                  </DrawerAction>
                  {waDigits && (
                    <a
                      href={`https://wa.me/${waDigits}?text=${encodeURIComponent(`Hi ${siteConfig.name}, I have a question.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={drawerActionClass}
                    >
                      <MessageCircle aria-hidden strokeWidth={1.6} />
                      WhatsApp support
                    </a>
                  )}
                  <DrawerAction href="/assistant" onClick={close} icon={Sparkles}>
                    Ask Nutriyet AI
                  </DrawerAction>
                  {showInstall && (
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        void install.start();
                      }}
                      className={drawerActionClass}
                    >
                      <Download aria-hidden strokeWidth={1.6} />
                      Install the app
                    </button>
                  )}
                  <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
                    <DeliverTo
                      className="px-0 py-0 text-sm hover:bg-transparent"
                      freeShippingThreshold={freeShippingThreshold}
                      freeShippingEnabled={freeShippingEnabled}
                    />
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
          // Cap the admin logo height inside the 56px row so mark + wordmark
          // always fit between the side columns.
          className="min-h-11 min-w-0 justify-self-center gap-2 text-[1.3125rem] font-medium [&_img]:max-h-[34px]"
          wordmarkClassName="hidden min-[340px]:inline"
          {...logoSize}
        />

        <div className="flex items-center justify-end">
          <Link href="/cart" className={iconBtn} aria-label="Cart">
            <CartIcon />
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------ tablet + desktop -- */}
      <div className="shop-container hidden h-16 items-center gap-6 md:flex lg:h-[4.75rem] lg:gap-8 xl:gap-10">
        <Logo
          logoUrl={logoUrl}
          name={siteName}
          className="shrink-0 gap-2.5 text-[1.375rem] font-medium lg:text-[1.625rem] [&_img]:max-h-[38px] lg:[&_img]:max-h-[42px]"
          {...logoSize}
        />

        <nav
          aria-label="Primary"
          data-heat="header-nav"
          className="flex min-w-0 items-center gap-5 lg:flex-1 lg:justify-center lg:gap-7 xl:gap-8"
        >
          <CategoryMegaMenu categories={categories} active={shopActive} />
          {categories.length === 0 && (
            <Link href="/products" className={navLinkClass(shopActive)}>
              Shop
            </Link>
          )}
          {PRIMARY_NAV.map((item) => {
            const active = isActiveNav(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(navLinkClass(active), "from" in item && "hidden xl:inline-flex")}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center lg:ml-0">
          <div className="mr-2 hidden w-52 lg:block xl:w-64 2xl:w-72" data-heat="search-bar">
            <SearchBox
              placeholder="Search products"
              inputClassName="h-10 rounded-[2px] border-[color:var(--input)] bg-transparent pl-10 pr-9 text-sm shadow-none placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="lg:hidden" data-heat="search-bar">
            <MobileSearchTrigger variant="icon" className={iconBtn} />
          </div>
          {isLoggedIn ? (
            <Link href="/account" className={iconBtn} aria-label="Account">
              <User strokeWidth={1.5} />
            </Link>
          ) : (
            <SigninSpotlight>
              <Link href="/login" className={iconBtn} aria-label="Sign in">
                <User strokeWidth={1.5} />
              </Link>
            </SigninSpotlight>
          )}
          <Link href="/account/wishlist" className={iconBtn} aria-label="Wishlist">
            <Heart strokeWidth={1.5} />
          </Link>
          {notifications && <NotificationBell initialUnread={unreadCount} items={notifications} />}
          <Link href="/cart" className={cn(iconBtn, "-mr-2.5")} aria-label="Cart">
            <CartIcon />
          </Link>
        </div>
      </div>
      {/* Outside the drawer: closing the sheet must not unmount it. */}
      {install.dialog}
    </header>
  );
}

const drawerActionClass =
  "flex min-h-11 items-center gap-3 text-[15px] text-foreground transition-colors hover:text-primary [&_svg]:size-[18px] [&_svg]:text-sage-deep";

function DrawerAction({
  href,
  onClick,
  icon: Icon,
  children,
}: {
  href: string;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} onClick={onClick} className={drawerActionClass}>
      <Icon aria-hidden strokeWidth={1.6} />
      {children}
    </Link>
  );
}

function DrawerGroup({
  label,
  items,
  onNavigate,
  isActive,
}: {
  label: string;
  items: readonly { title: string; href: string }[];
  onNavigate: () => void;
  isActive: (href: string) => boolean;
}) {
  return (
    <div className="px-4 pt-6">
      <p className="eyebrow">{label}</p>
      <ul className="mt-1.5">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center text-[15px] transition-colors hover:text-primary",
                  active ? "font-semibold text-primary" : "text-foreground",
                )}
              >
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
