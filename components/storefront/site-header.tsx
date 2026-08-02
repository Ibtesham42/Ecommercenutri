"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Heart,
  Menu,
  User,
  Home,
  ShoppingBag,
  LayoutGrid,
  Star,
  Sparkles,
  Building2,
  Info,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { siteConfig } from "@/config/site";
import { Logo } from "@/components/storefront/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { CartIcon } from "@/components/storefront/cart-icon";
import { SearchBox } from "@/components/storefront/search-box";
import { MobileSearchTrigger } from "@/components/storefront/mobile-search-trigger";
import { DeliverTo } from "@/components/storefront/deliver-to";
import { NotificationBell, type BellNotification } from "@/components/account/notification-bell";
import { SigninSpotlight } from "@/components/storefront/onboarding/signin-spotlight";

/** Icon per drawer nav item, keyed by href (drawer-only — the shared
 *  `siteConfig.mainNav` stays a plain title/href list for the desktop nav,
 *  department chips and footer). */
const NAV_ICONS: Record<string, LucideIcon> = {
  "/": Home,
  "/products": ShoppingBag,
  "/categories": LayoutGrid,
  "/products?sort=best-sellers": Star,
  "/assistant": Sparkles,
  "/b2b": Building2,
  "/about": Info,
  "/contact": Phone,
};

export function SiteHeader({
  logoUrl,
  siteName,
  logoHeight,
  logoHeightMobile,
  logoMaxWidth,
  notifications,
  unreadCount = 0,
  isLoggedIn = false,
}: {
  logoUrl?: string | null;
  siteName?: string;
  logoHeight?: number | null;
  logoHeightMobile?: number | null;
  logoMaxWidth?: number | null;
  notifications?: BellNotification[];
  unreadCount?: number;
  isLoggedIn?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Active when on the item's route. Home matches "/" exactly; section links
  // match their path and any sub-route. Query-bearing links (e.g. Best Sellers)
  // share a path with their base link, so we don't path-highlight them (would
  // need useSearchParams, which deopts this layout-mounted client component).
  const isActiveNav = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href.includes("?")) return false;
    return pathname === href || pathname.startsWith(href + "/");
  };
  const logoSize = {
    height: logoHeight,
    mobileHeight: logoHeightMobile,
    maxWidth: logoMaxWidth,
  };
  // Icon/ghost buttons on the light cream header chrome (all breakpoints).
  const onDeep = "text-foreground/80 hover:bg-accent hover:text-foreground";

  return (
    <header className="header-chrome sticky top-0 z-50 w-full shadow-elev-1">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-4 sm:gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-11 lg:hidden", onDeep)}
              aria-label="Open menu"
            >
              <Menu className="size-[22px]" />
            </Button>
          </SheetTrigger>
          {/* The drawer keeps the light surface for legibility. */}
          <SheetContent side="left" className="w-72 gap-0 p-0">
            <SheetHeader className="border-b bg-accent/40 p-4">
              <SheetTitle asChild>
                <Logo logoUrl={logoUrl} name={siteName} className="min-w-0" {...logoSize} />
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 p-3">
              {siteConfig.mainNav.map((item) => {
                const Icon = NAV_ICONS[item.href] ?? Home;
                const active = isActiveNav(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/80 hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg bg-accent/70",
                        active && "bg-primary/15 text-primary",
                      )}
                    >
                      <Icon className="size-[18px]" />
                    </span>
                    <span className={cn(active && "font-semibold")}>{item.title}</span>
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <Logo
          logoUrl={logoUrl}
          name={siteName}
          className="min-w-0 shrink"
          wordmarkClassName="hidden sm:inline"
          {...logoSize}
        />

        {/* Desktop (lg+) search lives in this primary row and gets a generous,
            stable slot — the nav moved to its own row below, so there's no space
            competition and the field can never collapse. */}
        <div className="mx-4 hidden flex-1 lg:block lg:max-w-xl xl:max-w-2xl" data-heat="search-bar">
          <SearchBox />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <DeliverTo className="mr-1 hidden xl:flex" />
          {notifications && (
            <NotificationBell initialUnread={unreadCount} items={notifications} />
          )}
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={cn("hidden size-11 sm:inline-flex sm:size-10", onDeep)}
            aria-label="Wishlist"
          >
            <Link href="/account/wishlist">
              <Heart className="size-[22px] sm:size-5" />
            </Link>
          </Button>
          {isLoggedIn ? (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className={cn("size-11 sm:size-10", onDeep)}
              aria-label="Account"
            >
              <Link href="/account">
                <User className="size-[22px] sm:size-5" />
              </Link>
            </Button>
          ) : (
            <SigninSpotlight>
              {/* Filled brand pill — the one loud CTA in the header, so new
                  visitors can't miss the account entry point. */}
              <Button
                asChild
                size="sm"
                className="btn-rich h-11 gap-1.5 rounded-full px-4 text-sm font-bold shadow-elev-2 sm:h-10"
              >
                <Link href="/login">
                  <User className="size-[18px]" />
                  <span>Sign in</span>
                </Link>
              </Button>
            </SigninSpotlight>
          )}
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={cn("relative size-11 sm:size-10", onDeep)}
            aria-label="Cart"
          >
            <Link href="/cart">
              <CartIcon />
            </Link>
          </Button>
          <div className={cn("grid size-11 place-items-center rounded-md sm:size-10", onDeep)}>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Row 2 — desktop nav bar (lg+). Search-forward primary row above keeps the
          nav in its own slim row, Amazon/Flipkart-style. */}
      <nav className="hidden border-t border-border/60 lg:block" data-heat="header-nav">
        <div className="mx-auto flex h-11 w-full max-w-7xl items-center gap-0.5 px-4">
          {siteConfig.mainNav.map((item) => {
            const active = isActiveNav(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-foreground/70 hover:bg-accent hover:text-foreground",
                )}
              >
                {item.title}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Full-width search row + deliver-to on mobile/tablet. Desktop (lg+) uses
          the inline search bar inside the header row above. The mobile row is a
          trigger that opens the full-screen SearchOverlay (app-style search). */}
      <div className="lg:hidden">
        <div className="mx-auto w-full max-w-7xl space-y-2 px-4 pb-2.5">
          <div data-heat="search-bar">
            <MobileSearchTrigger />
          </div>
          <DeliverTo />
        </div>
      </div>

      {/* Department chips — quick catalog jumps. Mobile/tablet only (desktop has
          the inline nav). Horizontal scroll-snap rail on the light chrome. */}
      <div className="border-t border-border/60 lg:hidden" data-heat="header-nav">
        <div className="scroll-rail mx-auto w-full max-w-7xl gap-2 px-4 py-2.5">
          {siteConfig.mainNav
            .filter((item) => item.href !== "/")
            .map((item) => {
              const active = isActiveNav(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "border-gold/60 bg-gold/15 text-gold-foreground"
                      : "border-border bg-card text-foreground/75 shadow-sm hover:border-primary/30 hover:text-primary",
                  )}
                >
                  {item.title}
                </Link>
              );
            })}
        </div>
      </div>
    </header>
  );
}
