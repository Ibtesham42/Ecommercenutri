"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Heart, ShoppingCart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CartCount } from "@/components/storefront/cart-count";

/**
 * Sticky bottom tab bar — mobile only (`md:hidden`). Thumb-friendly primary
 * navigation with a raised center AI button, matching the premium grocery-app
 * feel. Pure presentation + routing: cart badge reuses the existing `CartCount`
 * (Zustand store) and active state derives from the pathname. No new logic.
 *
 * Hidden on product-detail pages, which render their own sticky add-to-cart bar
 * at the same screen edge (they would otherwise overlap).
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  // Hidden on pages that render their own sticky bottom action bar (they would
  // otherwise overlap): product detail (/products/<slug>), cart and checkout.
  const onProductDetail =
    pathname.startsWith("/products/") && pathname !== "/products";
  const onOwnBottomBar =
    onProductDetail || pathname === "/cart" || pathname.startsWith("/checkout");
  if (onOwnBottomBar) return null;

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      aria-label="Primary"
      // Pinned to the bottom of the viewport. IMPORTANT: no `transform` here —
      // on iOS Safari a transform (even translateZ(0)) on a position:fixed
      // element makes it scroll with the page instead of staying pinned. Solid
      // background (no backdrop-blur) avoids scroll repaint jitter; safe-area
      // padding fills the iPhone home-indicator gap so there's no white gap.
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background shadow-[0_-2px_8px_rgba(20,40,26,0.06)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        <Tab href="/" label="Home" active={isActive("/", true)}>
          <Home className="size-[22px]" />
        </Tab>
        <Tab
          href="/categories"
          label="Categories"
          active={isActive("/categories")}
        >
          <LayoutGrid className="size-[22px]" />
        </Tab>

        {/* Center AI launcher (raised FAB). */}
        <div className="flex justify-center">
          <Link
            href="/assistant"
            aria-label="Ask Nutriyet AI"
            aria-current={isActive("/assistant") ? "page" : undefined}
            className="-mt-7 grid size-14 place-items-center rounded-full border-4 border-background bg-surface-deep text-gold shadow-elev-2 transition-transform active:scale-95"
          >
            <Sparkles className="size-6" />
          </Link>
        </div>

        <Tab
          href="/account/wishlist"
          label="Wishlist"
          active={isActive("/account/wishlist")}
        >
          <Heart className="size-[22px]" />
        </Tab>
        <Tab href="/cart" label="Cart" active={isActive("/cart")}>
          <span className="relative inline-grid place-items-center">
            <ShoppingCart className="size-[22px]" />
            <CartCount />
          </span>
        </Tab>
      </div>
    </nav>
  );
}

function Tab({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1 py-1.5 text-[10.5px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      <span className={cn(active && "font-semibold")}>{label}</span>
    </Link>
  );
}
