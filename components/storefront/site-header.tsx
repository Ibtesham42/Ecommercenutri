"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Heart, Menu, ShoppingCart, User } from "lucide-react";
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
import { CartCount } from "@/components/storefront/cart-count";
import { SearchBox } from "@/components/storefront/search-box";

export function SiteHeader({
  logoUrl,
  siteName,
  logoHeight,
  logoHeightMobile,
  logoMaxWidth,
}: {
  logoUrl?: string | null;
  siteName?: string;
  logoHeight?: number | null;
  logoHeightMobile?: number | null;
  logoMaxWidth?: number | null;
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

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b p-4">
              <SheetTitle asChild>
                <Logo logoUrl={logoUrl} name={siteName} {...logoSize} />
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 p-3">
              {siteConfig.mainNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActiveNav(item.href) ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent",
                    isActiveNav(item.href) && "bg-accent text-foreground",
                  )}
                >
                  {item.title}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Logo logoUrl={logoUrl} name={siteName} {...logoSize} />

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {siteConfig.mainNav.map((item) => {
            const active = isActiveNav(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground",
                  active
                    ? "bg-accent font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="mx-4 hidden flex-1 lg:block lg:max-w-sm xl:max-w-md">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex"
            aria-label="Wishlist"
          >
            <Link href="/account/wishlist">
              <Heart className="size-5" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Account">
            <Link href="/account">
              <User className="size-5" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Cart"
          >
            <Link href="/cart">
              <ShoppingCart className="size-5" />
              <CartCount />
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>

      {/* Full-width search row below the header on mobile/tablet. Desktop (lg+)
          uses the inline search bar inside the header row above. */}
      <div className="border-t lg:hidden">
        <div className="mx-auto w-full max-w-7xl px-4 py-2.5">
          <SearchBox />
        </div>
      </div>
    </header>
  );
}
